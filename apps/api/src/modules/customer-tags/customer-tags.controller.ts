import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerTagsService } from './customer-tags.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('CustomerTags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/customer-tags')
export class CustomerTagsController {
  constructor(private service: CustomerTagsService) {}

  @Get()
  list(@Param('outletId') outletId: string, @PreferredLanguage() lang: string | null) {
    return this.service.list(outletId, lang);
  }

  @Post()
  create(@Param('outletId') outletId: string, @Body() body: { name: string; color?: string }) {
    return this.service.create(outletId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; color?: string }) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put(':tagId/prices/:itemId')
  setItemPrice(
    @Param('tagId') tagId: string,
    @Param('itemId') itemId: string,
    @Query('variantId') variantId: string | undefined,
    @Body() body: { price: number; gstRate?: number | null },
  ) {
    const gst = body.gstRate === undefined ? undefined : body.gstRate === null ? null : Number(body.gstRate);
    return this.service.setItemPrice(tagId, itemId, Number(body.price), variantId, gst);
  }

  @Delete(':tagId/prices/:itemId')
  clearItemPrice(
    @Param('tagId') tagId: string,
    @Param('itemId') itemId: string,
    @Query('variantId') variantId: string | undefined,
  ) {
    return this.service.clearItemPrice(tagId, itemId, variantId);
  }
}
