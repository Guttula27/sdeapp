import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QrService } from './qr.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('QR Codes')
@Controller('qr')
export class QrController {
  constructor(private service: QrService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('outlet/:outletId')
  generateOutlet(@Param('outletId') outletId: string) {
    const customerUrl = process.env.CUSTOMER_URL || 'http://localhost:5174';
    return this.service.generateOutletQR(outletId, customerUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('table/:tableId')
  generateTable(@Param('tableId') tableId: string, @Query('outletId') outletId: string) {
    const customerUrl = process.env.CUSTOMER_URL || 'http://localhost:5174';
    return this.service.generateTableQR(tableId, outletId, customerUrl);
  }

  @Public()
  @Get('validate/:code')
  validate(@Param('code') code: string) {
    return this.service.validateQR(code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('outlet/:outletId')
  getOutletQRs(@Param('outletId') outletId: string) {
    return this.service.getOutletQRs(outletId);
  }
}
