import { Controller, Get, Post, Patch, Param, Body, UseGuards, Delete, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OutletsService, CreateOutletDto, CreateSectionDto, CreateTableDto } from './outlets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';

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
  findByBusiness(@Param('businessId') businessId: string, @PreferredLanguage() lang: string | null) {
    return this.service.findByBusiness(businessId, lang);
  }

  // Static-path routes must be declared before the dynamic `:id` route below,
  // otherwise `:id` swallows them (Nest registers routes in declaration order).
  @Public()
  @Get('public-list')
  publicList() {
    return this.service.listPublic();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    return this.service.findOne(id, lang);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.service.getDashboard(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateOutletDto>) {
    return this.service.update(id, dto);
  }

  @Post(':outletId/sections')
  createSection(@Param('outletId') outletId: string, @Body() dto: CreateSectionDto) {
    return this.service.createSection(outletId, dto);
  }

  @Get(':outletId/sections')
  getSections(@Param('outletId') outletId: string) {
    return this.service.getSections(outletId);
  }

  @Post(':outletId/tables')
  createTable(@Param('outletId') outletId: string, @Body() dto: CreateTableDto) {
    return this.service.createTable(outletId, dto);
  }

  @Get(':id/admin')
  admin(@Param('id') id: string) {
    return this.service.findAdmin(id);
  }

  @Post(':id/images')
  addImage(@Param('id') id: string, @Body() body: { url: string }) {
    return this.service.addImage(id, body.url);
  }

  @Delete(':id/images/:imageId')
  removeImage(@Param('imageId') imageId: string) {
    return this.service.removeImage(imageId);
  }

  @Public()
  @Get(':id/open-status')
  openStatus(@Param('id') id: string) {
    return this.service.getOpenStatus(id);
  }

  @Get(':id/token-counter')
  getTokenCounter(@Param('id') id: string) {
    return this.service.getTokenCounter(id);
  }

  @Patch(':id/token-counter')
  setTokenCounter(
    @Param('id') id: string,
    @Body() body: { startNumber?: number; currentNumber?: number },
  ) {
    return this.service.setTokenCounter(id, body);
  }

  @Post(':id/token-counter/reset')
  resetTokenCounter(@Param('id') id: string) {
    return this.service.resetTokenCounter(id);
  }

  @Get(':id/hours')
  getHours(@Param('id') id: string) {
    return this.service.getHours(id);
  }

  @Put(':id/hours')
  setHours(
    @Param('id') id: string,
    @Body() body: { ranges: { dayOfWeek: number; openTime: string; closeTime: string }[] },
  ) {
    return this.service.setHours(id, body.ranges || []);
  }
}
