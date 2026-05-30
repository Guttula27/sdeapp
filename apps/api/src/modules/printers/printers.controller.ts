import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Printers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/printers')
export class PrintersController {
  constructor(private service: PrintersService) {}

  @Get()
  list(@Param('outletId') outletId: string) {
    return this.service.list(outletId);
  }

  @Post()
  create(
    @Param('outletId') outletId: string,
    @Body() body: { name: string; connection?: string; address?: string; model?: string },
  ) {
    return this.service.create(outletId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; connection?: string; address?: string | null; model?: string | null },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
