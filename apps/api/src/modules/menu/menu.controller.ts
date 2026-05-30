import { Controller, ForbiddenException, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  getMenu(
    @Param('outletId') outletId: string,
    @Req() req: any,
    @PreferredLanguage() lang: string | null,
    @Query('tableId') tableId?: string,
    @Query('includeHidden') includeHidden?: string,
  ) {
    // includeHidden is honored only for staff users (those tied to a
    // business or outlet). Customer/anon callers always get the public
    // (display-filtered) view regardless of query string.
    const isStaff = !!(req?.user?.businessId || req?.user?.outletId);
    const allowHidden = isStaff && includeHidden === 'true';
    return this.menuService.getMenu(outletId, req?.user?.id, tableId, lang, {
      includeHidden: allowHidden,
    });
  }

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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('import-from/:sourceOutletId')
  importFromOutlet(
    @Param('outletId') outletId: string,
    @Param('sourceOutletId') sourceOutletId: string,
  ) {
    return this.menuService.importFromOutlet(outletId, sourceOutletId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('import-from-business/:businessId')
  importFromBusiness(
    @Param('outletId') outletId: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: any,
    @Body() body: { itemIds?: string[] } = {},
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
    return this.menuService.importFromBusiness(outletId, businessId, body?.itemIds);
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
}
