import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SplitBillsService, SplitShareInput } from './split-bills.service';

@ApiTags('SplitBills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SplitBillsController {
  constructor(private service: SplitBillsService) {}

  // ── Operator (admin web) ────────────────────────────────

  @Post('outlets/:outletId/orders/:orderId/split-shares')
  createSplit(
    @Param('outletId') outletId: string,
    @Param('orderId') orderId: string,
    @Body() body: { shares: SplitShareInput[] },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createSplit(outletId, orderId, body.shares, userId);
  }

  @Get('outlets/:outletId/orders/:orderId/split-shares')
  list(@Param('orderId') orderId: string) {
    return this.service.getShareList(orderId);
  }

  @Post('split-shares/:id/resend')
  resend(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.resendShare(id, userId);
  }

  @Post('split-shares/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.cancelShare(id, userId, body?.reason);
  }

  @Post('split-shares/:id/mark-cash')
  markCash(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.markShareCash(id, userId, body?.notes);
  }

  // ── Customer (customer PWA) ─────────────────────────────

  /** "My Bills" — every share assigned to the auth'd user's phone. */
  @Get('me/split-shares')
  listMine(@CurrentUser('id') userId: string) {
    return this.service.listMySharesForCustomer(userId);
  }

  /**
   * Share detail for the auth'd customer. Server validates the share's
   * phone matches the user's, stamps VIEWED on first read, and returns
   * enough context to render the pay page (parent order summary,
   * outlet info, the diner's share amount).
   */
  @Get('split-shares/:id')
  getShare(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.getShareForCustomer(id, userId);
  }
}
