import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AddClusterMemberDto, ClustersService } from './clusters.service';

// Auth-gated cluster admin routes. The public-facing customer endpoint
// /clusters/by-code/:publicCode is intentionally below the guard so the
// customer QR shell can fetch the bundle without a session.
@ApiTags('Clusters')
@Controller('clusters')
export class ClustersController {
  constructor(private service: ClustersService) {}

  // ─── Public (no auth) ─────────────────────────────────────
  @Get('public')
  listPublic() {
    return this.service.listPublic();
  }

  @Get('by-code/:publicCode')
  byCode(@Param('publicCode') publicCode: string) {
    return this.service.getPublicBundle(publicCode);
  }

  // ─── Admin (auth required) ────────────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddClusterMemberDto) {
    return this.service.addMember(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:outletId')
  removeMember(@Param('id') id: string, @Param('outletId') outletId: string) {
    return this.service.removeMember(id, outletId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/reorder')
  reorder(@Param('id') id: string, @Body() body: { ordering: { outletId: string; displayOrder: number }[] }) {
    return this.service.reorderMembers(id, body.ordering || []);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/qr')
  generateQr(@Param('id') id: string, @Query('customerUrl') customerUrl?: string) {
    // Falls back to the env-configured customer app URL when the admin
    // hasn't passed one explicitly.
    const base = customerUrl || process.env.CUSTOMER_APP_URL || 'http://localhost:5174';
    return this.service.generateQr(id, base);
  }
}
