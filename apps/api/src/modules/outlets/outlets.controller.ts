import { Controller, Get, Post, Patch, Param, Body, UseGuards, Delete, Put, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OutletsService, CreateOutletDto, CreateSectionDto, CreateTableDto, UpdateTableDto } from './outlets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertResponsibility } from '../../common/permissions/responsibility';

@ApiTags('Outlets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets')
export class OutletsController {
  constructor(private service: OutletsService) {}

  @Post()
  create(@Body() dto: CreateOutletDto) {
    return this.service.create(dto);
  }

  @Get('business/:businessId')
  findByBusiness(
    @Param('businessId') businessId: string,
    @PreferredLanguage() lang: string | null,
    @CurrentUser() user: any,
  ) {
    return this.service.findByBusiness(businessId, user, lang);
  }

  // Static-path routes must be declared before the dynamic `:id` route below,
  // otherwise `:id` swallows them (Nest registers routes in declaration order).
  @Public()
  @Get('public-list')
  publicList() {
    return this.service.listPublic();
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @PreferredLanguage() lang: string | null,
    @CurrentUser() user: any,
    // `mode=config` (default) returns config + hours + images only.
    // `mode=layout` adds sections.tables — many hundreds of rows for
    // a busy multi-section outlet. The map view passes layout; the
    // outlet profile page (which is most opens) takes the default.
    // `mode=full` returns both for legacy callers expecting the
    // historical shape.
    @Query('mode') mode?: 'config' | 'layout' | 'full',
  ) {
    return this.service.findOne(id, user, lang, mode);
  }

  /** Sub-resource for the layout/map view. Skips config + i18n hydration. */
  @Get(':id/layout')
  getLayout(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getLayout(id, user);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getDashboard(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateOutletDto>,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':outletId/sections')
  createSection(@Param('outletId') outletId: string, @Body() dto: CreateSectionDto) {
    return this.service.createSection(outletId, dto);
  }

  @Get(':outletId/sections')
  getSections(@Param('outletId') outletId: string) {
    return this.service.getSections(outletId);
  }

  @Get('sections/:sectionId/menus')
  listSectionMenus(@Param('sectionId') sectionId: string, @CurrentUser() user: any) {
    // Read access only needs VIEW_MENU since the response is just a
    // menu × isEnabled projection — same data they'd see on the menu
    // builder. MANAGE_SECTIONS is the right gate for the toggle below.
    assertResponsibility(user, 'VIEW_MENU');
    return this.service.listSectionMenus(sectionId);
  }

  @Patch('sections/:sectionId/menus/:menuId')
  setSectionMenuEnabled(
    @Param('sectionId') sectionId: string,
    @Param('menuId') menuId: string,
    @Body() body: { isEnabled: boolean },
    @CurrentUser() user: any,
  ) {
    assertResponsibility(user, 'MANAGE_SECTIONS');
    return this.service.setSectionMenuEnabled(sectionId, menuId, !!body?.isEnabled);
  }

  @Post(':outletId/tables')
  createTable(@Param('outletId') outletId: string, @Body() dto: CreateTableDto) {
    return this.service.createTable(outletId, dto);
  }

  @Patch(':outletId/tables/:tableId')
  updateTable(
    @Param('tableId') tableId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.service.updateTable(tableId, dto);
  }

  @Delete(':outletId/tables/:tableId')
  deleteTable(@Param('tableId') tableId: string) {
    return this.service.deleteTable(tableId);
  }

  @Get(':id/admin')
  admin(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findAdmin(id, user);
  }

  @Post(':id/images')
  addImage(
    @Param('id') id: string,
    @Body() body: { url: string },
    @CurrentUser() user: any,
  ) {
    return this.service.addImage(id, body.url, user);
  }

  @Delete(':id/images/:imageId')
  removeImage(@Param('imageId') imageId: string, @CurrentUser() user: any) {
    return this.service.removeImage(imageId, user);
  }

  @Public()
  @Get(':id/open-status')
  openStatus(@Param('id') id: string) {
    return this.service.getOpenStatus(id);
  }

  @Get(':id/token-counter')
  getTokenCounter(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getTokenCounter(id, user);
  }

  @Patch(':id/token-counter')
  setTokenCounter(
    @Param('id') id: string,
    @Body() body: { startNumber?: number; currentNumber?: number },
    @CurrentUser() user: any,
  ) {
    return this.service.setTokenCounter(id, body, user);
  }

  @Post(':id/token-counter/reset')
  resetTokenCounter(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.resetTokenCounter(id, user);
  }

  @Get(':id/hours')
  getHours(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getHours(id, user);
  }

  @Put(':id/hours')
  setHours(
    @Param('id') id: string,
    @Body() body: { ranges: { dayOfWeek: number; openTime: string; closeTime: string }[] },
    @CurrentUser() user: any,
  ) {
    return this.service.setHours(id, body.ranges || [], user);
  }
}
