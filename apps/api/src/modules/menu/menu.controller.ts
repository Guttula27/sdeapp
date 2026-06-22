import { Controller, ForbiddenException, Get, Post, Put, Patch, Delete, Param, Body, UseGuards, Req, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('Menu')
@Controller('outlets/:outletId/menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  // Public cached read with ETag-driven 304 revalidation already
  // handles flood protection: warm clients get sub-3 ms revalidations.
  // Strict per-IP bucketing (60/min as in the doc's G5) is set up
  // explicitly in Phase 5 when named throttlers land; for now the
  // global 100/min bucket would penalise a customer whose PWA
  // legitimately fires a few cache misses in succession.
  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getMenu(
    @Param('outletId') outletId: string,
    @Req() req: any,
    @Res() res: Response,
    @PreferredLanguage() lang: string | null,
    @Query('tableId') tableId?: string,
    @Query('includeHidden') includeHidden?: string,
    // Customer apps pass slim=true to get a trimmed list payload (no
    // toppings/bundleChildren/gallery/pricing-override rows). The full
    // item is fetched on-demand from GET /items/:itemId when the user
    // taps to open a detail/picker modal.
    @Query('slim') slim?: string,
  ) {
    // NOTE: this endpoint takes over response handling (no passthrough)
    // so it can issue a clean 304 (empty body) on revalidation —
    // returning undefined under passthrough mode trips the global
    // TransformInterceptor into writing `{success,data,timestamp}` and
    // then this method calling res.end() causes ERR_HTTP_HEADERS_SENT.
    // The 200 branch reproduces the standard envelope shape inline.

    // includeHidden is honored only for staff users (those tied to a
    // business or outlet). Customer/anon callers always get the public
    // (display-filtered) view regardless of query string.
    const isStaff = !!(req?.user?.businessId || req?.user?.outletId);
    const allowHidden = isStaff && includeHidden === 'true';
    const slimMode = slim === 'true';

    // ETag bound to the outlet menu-version counter. A menu edit calls
    // invalidateOutlet() which INCRs the version → every variant's ETag
    // rotates atomically. Different (lang × audience × slim) buckets get
    // distinct ETags so a customer revalidating a slim payload doesn't
    // get 304'd against a staff full payload.
    const version = await this.menuService.getMenuVersion(outletId);
    const etag = `W/"m:${outletId}:${version}:${lang || 'en'}:${allowHidden ? 'all' : 'pub'}:${slimMode ? 's' : 'f'}"`;

    // Cache-Control tiering by audience:
    //   • includeHidden (admin edit view) — no caching; admins must see
    //     every save instantly.
    //   • staff but not includeHidden — short cache + must-revalidate so
    //     mid-shift menu toggles surface quickly.
    //   • anonymous / customer — 30 s fresh + 5 min stale-while-revalidate
    //     so the customer PWA can paint instantly from cache and
    //     reconcile in the background.
    const cacheControl = allowHidden
      ? 'no-store'
      : isStaff
        ? 'private, max-age=10, must-revalidate'
        : 'private, max-age=30, stale-while-revalidate=300';

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', cacheControl);

    // Fast revalidation path — skip the entire DB read + projection
    // when the client's cached payload is still current. RFC 7232:
    // 304 MUST NOT contain a message body.
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    const data = await this.menuService.getMenu(outletId, req?.user?.id, tableId, lang, {
      includeHidden: allowHidden,
      slim: slimMode,
    });
    // Mirror the global TransformInterceptor envelope so the contract
    // with the SPAs doesn't change when this route bypasses the
    // interceptor.
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }

  // Detail endpoint for the slim list. Returns the single item with all
  // the heavy fields (itemToppings + their options, bundleChildren,
  // images gallery, customerTagPrices, tableTypePrices) so the customer
  // can render the picker/modal. Same per-request projection layer as
  // /menu, so effectivePrice / isFavorite / inSchedule stay consistent.
  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('items/:itemId')
  getItemDetail(
    @Param('outletId') outletId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
    @PreferredLanguage() lang: string | null,
    @Query('tableId') tableId?: string,
  ) {
    return this.menuService.getItemDetail(outletId, itemId, req?.user?.id, tableId, lang);
  }

  @SkipThrottle()
  @Public()
  @Get('popular')
  getPopular(@Param('outletId') outletId: string) {
    return this.menuService.getPopularItems(outletId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('categories')
  createCategory(@Param('outletId') outletId: string, @Body() body: any) {
    return this.menuService.createCategory(outletId, body);
  }

  // MUST precede `categories/:id` — Express/Nest matches in declaration order
  // and would otherwise capture the literal "reorder" as :id.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('categories/reorder')
  reorderCategories(
    @Param('outletId') outletId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderCategories({ outletId }, body?.orderedIds ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateCategory(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.menuService.deleteCategory(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('categories/:categoryId/subcategories')
  createSubcategory(@Param('categoryId') categoryId: string, @Body() body: any) {
    return this.menuService.createSubcategory(categoryId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('subcategories/:id')
  updateSubcategory(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateSubcategory(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('subcategories/:id')
  deleteSubcategory(@Param('id') id: string) {
    return this.menuService.deleteSubcategory(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subcategories/:subcategoryId/items')
  createItem(@Param('subcategoryId') subcategoryId: string, @Body() body: any) {
    return this.menuService.createItem(subcategoryId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateItem(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('items/:id/availability')
  toggleAvailability(@Param('id') id: string) {
    return this.menuService.toggleItemAvailability(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('items/:id/visibility')
  toggleVisibility(@Param('id') id: string) {
    return this.menuService.toggleItemVisibility(id);
  }

  // Stock management for limited-quantity items.
  // - addQuantity: increment current stock (preferred path — staff add more)
  // - setQuantity: absolute reset (corrections, recounts)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('items/:id/stock')
  adjustStock(@Param('id') id: string, @Body() body: { addQuantity?: number; setQuantity?: number }) {
    return this.menuService.adjustItemStock(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.menuService.deleteItem(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('items/:itemId/variants')
  createVariant(@Param('itemId') itemId: string, @Body() body: any) {
    return this.menuService.createVariant(itemId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('variants/:id')
  updateVariant(@Param('id') id: string, @Body() body: any) {
    return this.menuService.updateVariant(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('variants/:id')
  deleteVariant(@Param('id') id: string) {
    return this.menuService.deleteVariant(id);
  }

  // Outlet-to-outlet menu import was removed by product decision — outlets
  // import only from the parent business template. The corresponding service
  // method is also gone.

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('import-from-business/:businessId')
  importFromBusiness(
    @Param('outletId') outletId: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: any,
    @Body() body: { categoryIds?: string[]; subcategoryIds?: string[]; itemIds?: string[] } = {},
  ) {
    // Authorization: outlet admins can only import to their own outlet.
    // Business owners can import to any outlet within their business.
    // Platform admins are unrestricted.
    if (user?.outletId && user.outletId !== outletId) {
      throw new ForbiddenException('You can only import to your own outlet');
    }
    if (user?.businessId && user.businessId !== businessId) {
      throw new ForbiddenException('You can only import from your own business');
    }
    return this.menuService.importFromBusiness(outletId, businessId, {
      categoryIds: body?.categoryIds,
      subcategoryIds: body?.subcategoryIds,
      itemIds: body?.itemIds,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('items/:itemId/images')
  addItemImage(
    @Param('itemId') itemId: string,
    @Body() body: { url: string },
  ) {
    return this.menuService.addItemImage(itemId, body.url);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('items/:itemId/images/:imageId')
  removeItemImage(@Param('imageId') imageId: string) {
    return this.menuService.removeItemImage(imageId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('items/:itemId/images/order')
  reorderItemImages(
    @Param('itemId') itemId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderItemImages(itemId, body.orderedIds);
  }

  // ── Reorder endpoints (outlet tier) ───────────────────────
  // categories/reorder is declared higher up the file (above categories/:id)
  // to win route matching. Subcategory and item reorder paths are deep
  // enough that no shallower :id route can swallow them.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('categories/:categoryId/subcategories/reorder')
  reorderSubcategories(
    @Param('categoryId') categoryId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderSubcategories(categoryId, body?.orderedIds ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('subcategories/:subcategoryId/items/reorder')
  reorderItems(
    @Param('subcategoryId') subcategoryId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.menuService.reorderItems(subcategoryId, body?.orderedIds ?? []);
  }

  // ── Per-day availability slots ────────────────────────────
  // PUT replaces the full slot set for the level. Empty array clears
  // the override (level inherits from its ancestors). Shape per slot:
  // { dayOfWeek: 1..7, startMinute: 0..1440, endMinute: 0..1440 }.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('categories/:id/timings')
  replaceCategoryTimings(
    @Param('id') id: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> },
  ) {
    return this.menuService.replaceCategoryTimings(id, body?.slots ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('subcategories/:id/timings')
  replaceSubcategoryTimings(
    @Param('id') id: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> },
  ) {
    return this.menuService.replaceSubcategoryTimings(id, body?.slots ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('items/:id/timings')
  replaceItemTimings(
    @Param('id') id: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> },
  ) {
    return this.menuService.replaceItemTimings(id, body?.slots ?? []);
  }
}
