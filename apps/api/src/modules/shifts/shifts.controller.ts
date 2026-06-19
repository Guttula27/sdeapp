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
import { ShiftsService } from './shifts.service';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/shifts')
export class ShiftsController {
  constructor(private service: ShiftsService) {}

  // ── Outlet envelope ────────────────────────────────────

  @Get('outlet/active')
  outletActive(@Param('outletId') outletId: string) {
    return this.service.findActiveOutletShift(outletId);
  }

  @Post('outlet/open')
  openOutlet(
    @Param('outletId') outletId: string,
    @Body() body: { note?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.openOutletShift(outletId, userId, body?.note);
  }

  @Post('outlet/:id/close')
  closeOutlet(
    @Param('id') id: string,
    @Body() body: { closeNote?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.closeOutletShift(id, userId, body?.closeNote);
  }

  @Get('outlet/:id/z-report')
  outletReport(@Param('id') id: string) {
    return this.service.outletShiftZReport(id);
  }

  // ── Cashier sub-shifts ────────────────────────────────

  // Current cashier's active drawer. Frontend polls this on Place Order
  // / Service Desk landing to gate "Open shift" vs "Bill Now" buttons.
  @Get('cashier/mine')
  cashierMine(
    @Param('outletId') outletId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.findActiveCashierShift(outletId, userId);
  }

  @Post('cashier/open')
  openCashier(
    @Param('outletId') outletId: string,
    @Body() body: { openingFloat: number; note?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.openCashierShift(
      outletId,
      userId,
      Number(body?.openingFloat ?? 0),
      body?.note,
    );
  }

  @Post('cashier/:id/close')
  closeCashier(
    @Param('id') id: string,
    @Body() body: { declaredCash: number; closeNote?: string },
  ) {
    return this.service.closeCashierShift(id, Number(body?.declaredCash ?? 0), body?.closeNote);
  }

  @Get('cashier/:id/z-report')
  cashierReport(@Param('id') id: string) {
    return this.service.cashierShiftZReport(id);
  }
}
