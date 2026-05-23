import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PreferredLanguage } from '../../common/language/preferred-language';

/**
 * Business-template menu — what an owner edits at the business level. Outlets
 * import from this set into their own menu when they want to. Templates only
 * model categories / subcategories / items / variants; outlet-specific
 * concerns (toppings, tag prices, table-type prices) live on the outlet
 * menu controller and are set up post-import.
 */
@ApiTags('Business Menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/menu')
export class BusinessMenuController {
  constructor(private menuService: MenuService) {}

  @Get()
  getMenu(
    @Param('businessId') businessId: string,
    @PreferredLanguage() lang: string | null,
  ) {
    return this.menuService.getBusinessMenu(businessId, lang);
  }

  @Post('categories')
  createCategory(@Param('businessId') businessId: string, @Body() body: any) {
    return this.menuService.createBusinessCategory(businessId, body);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateBusinessCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.menuService.deleteBusinessCategory(id);
  }

  @Post('categories/:categoryId/subcategories')
  createSubcategory(@Param('categoryId') categoryId: string, @Body() body: any) {
    return this.menuService.createBusinessSubcategory(categoryId, body);
  }

  @Patch('subcategories/:id')
  updateSubcategory(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateSubcategory(id, body);
  }

  @Post('subcategories/:subcategoryId/items')
  createItem(@Param('subcategoryId') subcategoryId: string, @Body() body: any) {
    return this.menuService.createBusinessItem(subcategoryId, body);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateItem(id, body);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.menuService.deleteItem(id);
  }

  @Post('items/:itemId/variants')
  createVariant(@Param('itemId') itemId: string, @Body() body: any) {
    return this.menuService.createVariant(itemId, body);
  }

  @Patch('variants/:id')
  updateVariant(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateVariant(id, body);
  }

  @Delete('variants/:id')
  deleteVariant(@Param('id') id: string) {
    return this.menuService.deleteVariant(id);
  }
}
