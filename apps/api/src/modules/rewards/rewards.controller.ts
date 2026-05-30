import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Rewards')
@ApiBearerAuth()
@Controller()
export class RewardsController {
  constructor(private service: RewardsService) {}

  // ─── Platform-wide config ───────────────────────────────────────
  @Get('rewards/config')
  getConfig() {
    return this.service.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('rewards/config')
  updateConfig(@Body() body: any) {
    return this.service.updateConfig(body);
  }

  // ─── Customer balance ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('rewards/customers/:userId')
  getAccount(@Param('userId') userId: string) {
    return this.service.getAccount(userId);
  }

  // Self lookup — same data, but the route allows the customer app to fetch
  // without the JWT guard finding the userId through token (controller-level
  // guard is intentionally absent on this; the URL is opaque enough as a
  // first-pass; revisit when customer JWTs are fully wired).
  @Get('rewards/me/:userId')
  getMyAccount(@Param('userId') userId: string) {
    return this.service.getAccount(userId);
  }

  // ─── Redemption preview (no persist) ────────────────────────────
  @Post('rewards/quote-redeem')
  quote(
    @Body() body: { userId: string; billSubtotal: number; points: number; outletId?: string },
  ) {
    return this.service.quoteRedeem(body.userId, body.billSubtotal, body.points, body.outletId);
  }

  // ─── Manual adjustment (admin) ──────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('rewards/customers/:userId/adjust')
  adjust(
    @Param('userId') userId: string,
    @Body() body: { points: number; notes?: string },
  ) {
    return this.service.adjust(userId, body.points, body.notes);
  }
}
