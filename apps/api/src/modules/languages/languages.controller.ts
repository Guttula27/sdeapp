import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LanguagesService, UpsertLanguageDto } from './languages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Languages')
@Controller('languages')
export class LanguagesController {
  constructor(private service: LanguagesService) {}

  // Anyone (including unauthenticated callers) can see what's available so the
  // login screen and customer PWA can render their language picker.
  @Public()
  @Get()
  listEnabled() {
    return this.service.listEnabled();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('all')
  listAll(@CurrentUser() user: any) {
    return this.service.listAll(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: any, @Body() dto: UpsertLanguageDto) {
    return this.service.create(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':code')
  update(@CurrentUser() user: any, @Param('code') code: string, @Body() dto: Partial<UpsertLanguageDto>) {
    return this.service.update(user, code, dto);
  }

  // Admin-triggered re-run of the backfill — used when an earlier
  // create-time backfill couldn't reach the translation provider
  // (e.g. a Lingva outage) or when new entities have piled up since
  // the language was added.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':code/regenerate')
  regenerate(@CurrentUser() user: any, @Param('code') code: string) {
    return this.service.regenerate(user, code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':code')
  remove(@CurrentUser() user: any, @Param('code') code: string) {
    return this.service.remove(user, code);
  }
}
