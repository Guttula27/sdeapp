import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessesService, CreateBusinessDto } from './businesses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private service: BusinessesService) {}

  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number, @PreferredLanguage() lang?: string | null) {
    return this.service.findAll(page, limit, lang);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    return this.service.findOne(id, lang);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.service.getDashboard(id);
  }

  @Get(':id/roles')
  roles(@Param('id') id: string) {
    return this.service.getRoles(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateBusinessDto>) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.service.toggleStatus(id);
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
}
