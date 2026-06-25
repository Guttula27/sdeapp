import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
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
    // Admin/edit views pass includeHidden=true so items toggled to
    // not-displayed still show up in the list (otherwise the admin
    // would have no UI affordance to flip visibility back on).
    @Query('includeHidden') includeHidden?: string,
  ) {
    return this.menuService.getBusinessMenu(businessId, lang, {
      includeHidden: includeHidden === 'true',
    });
  }

  @Post('categories')
  createCategory(@Param('businessId') businessId: string, @Body() body: any) {
    return this.menuService.createBusinessCategory(businessId, body);
  }

  // MUST precede `categories/:id` — Express/Nest matches in declaration order
  // and would otherwise capture the literal "reorder" as :id.
  @Patch('categories/reorder')
  reorderCategories(
    @Param('businessId') businessId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderCategories({ businessId }, body?.orderedIds ?? []);
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

  @Delete('subcategories/:id')
  deleteSubcategory(@Param('id') id: string) {
    return this.menuService.deleteSubcategory(id);
  }

  @Post('subcategories/:subcategoryId/items')
  createItem(@Param('subcategoryId') subcategoryId: string, @Body() body: any) {
    return this.menuService.createBusinessItem(subcategoryId, body);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateItem(id, body);
  }

  // Match the outlet-tier routes so the admin SPA can flip availability
  // and visibility on business-template items. Service methods are
  // shared with the outlet path; outletId-keyed cache invalidation
  // no-ops for template rows (they have no outlet binding).
  @Patch('items/:id/availability')
  toggleAvailability(@Param('id') id: string) {
    return this.menuService.toggleItemAvailability(id);
  }

  @Patch('items/:id/visibility')
  toggleVisibility(@Param('id') id: string) {
    return this.menuService.toggleItemVisibility(id);
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

  // ── Reorder endpoints (business tier) ─────────────────────
  // categories/reorder is declared higher up the file (above categories/:id)
  // to win route matching. These two only conflict with nothing — distinct
  // path depth — so they're fine here.
  @Patch('categories/:categoryId/subcategories/reorder')
  reorderSubcategories(
    @Param('categoryId') categoryId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderSubcategories(categoryId, body?.orderedIds ?? []);
  }

  @Patch('subcategories/:subcategoryId/items/reorder')
  reorderItems(
    @Param('subcategoryId') subcategoryId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderItems(subcategoryId, body?.orderedIds ?? []);
  }

  @Put('categories/:id/timings')
  replaceCategoryTimings(
    @Param('id') id: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> },
  ) {
    return this.menuService.replaceCategoryTimings(id, body?.slots ?? []);
  }

  @Put('subcategories/:id/timings')
  replaceSubcategoryTimings(
    @Param('id') id: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> },
  ) {
    return this.menuService.replaceSubcategoryTimings(id, body?.slots ?? []);
  }

  @Put('items/:id/timings')
  replaceItemTimings(
    @Param('id') id: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> },
  ) {
    return this.menuService.replaceItemTimings(id, body?.slots ?? []);
  }
}
