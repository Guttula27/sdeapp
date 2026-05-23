import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ToppingsService } from './toppings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('Toppings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/toppings')
export class ToppingsController {
  constructor(private service: ToppingsService) {}

  @Get()
  list(@Param('outletId') outletId: string, @PreferredLanguage() lang: string | null) {
    return this.service.list(outletId, lang);
  }

  @Post()
  create(@Param('outletId') outletId: string, @Body() body: any) {
    return this.service.create(outletId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Item-level link management (under /items for clarity)
  @Put('item/:itemId')
  setItemToppings(
    @Param('itemId') itemId: string,
    @Body() body: { links: { toppingId: string; priceAdd?: number; isRequired?: boolean }[] },
  ) {
    return this.service.setItemToppings(itemId, body.links || []);
  }
}
