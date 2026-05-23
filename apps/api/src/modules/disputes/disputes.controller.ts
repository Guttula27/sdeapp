import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService, DisputeStatus } from './disputes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('Disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private service: DisputesService) {}

  /* ── Customer: raise dispute ─────────────────────────────── */
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: { orderId: string; description: string; claimAmount?: number },
    @CurrentUser('id') customerId: string | null,
  ) {
    return this.service.create(body.orderId, customerId, {
      description: body.description,
      claimAmount: body.claimAmount,
    });
  }

  /* ── Customer: own disputes ──────────────────────────────── */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@CurrentUser('id') customerId: string, @PreferredLanguage() lang: string | null) {
    return this.service.findByCustomer(customerId, lang);
  }

  /* ── Outlet: disputes for an outlet ─────────────────────── */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('outlet/:outletId')
  findByOutlet(
    @Param('outletId') outletId: string,
    @PreferredLanguage() lang: string | null,
    @Query('status') status?: DisputeStatus,
  ) {
    return this.service.findByOutlet(outletId, status, lang);
  }

  /* ── Outlet: dispute stats ───────────────────────────────── */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('outlet/:outletId/stats')
  getStats(@Param('outletId') outletId: string) {
    return this.service.getStats(outletId);
  }

  /* ── Get single dispute ──────────────────────────────────── */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    return this.service.findOne(id, lang);
  }

  /* ── Outlet: update dispute ──────────────────────────────── */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { status: DisputeStatus; resolution?: string; refundRequested?: boolean },
  ) {
    return this.service.update(id, body);
  }
}
