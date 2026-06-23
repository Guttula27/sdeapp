import { BadRequestException, Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TranslationsService } from './translations.service';
import { RedisService } from '../../config/redis/redis.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Outlet-admin "Languages" page API.
 *
 * Reads every translatable string for the requested entityType +
 * language, lets the admin edit any one, and persists the correction
 * with `source = 'manual'` so the next auto-translation pass leaves
 * it alone. Writes hit both the legacy translations table AND the
 * per-row JSON cell — same dual-write pattern as upsertAll() so the
 * customer menu reflects the edit on the next cache rebuild.
 */
@ApiTags('Translations admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/i18n')
export class TranslationsAdminController {
  constructor(
    private translations: TranslationsService,
    private redis: RedisService,
  ) {}

  @Get('strings')
  async listStrings(
    @Param('outletId') outletId: string,
    @Query('lang')       lang?: string,
    @Query('entityType') entityType?: string,
    @Query('search')     search?: string,
    @Query('page')       page?: string,
    @Query('limit')      limit?: string,
  ) {
    if (!lang) throw new BadRequestException('lang is required');
    if (!entityType) throw new BadRequestException('entityType is required');
    return this.translations.listOutletStrings(outletId, {
      lang, entityType, search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Put('strings')
  async upsert(
    @Param('outletId') outletId: string,
    @Body() body: {
      entityType: string;
      entityId: string;
      fieldName: string;
      languageCode: string;
      value: string;
    },
  ) {
    if (!body?.entityType || !body?.entityId || !body?.fieldName || !body?.languageCode) {
      throw new BadRequestException('entityType, entityId, fieldName, languageCode are required');
    }
    const result = await this.translations.upsertManualOverride(outletId, body);
    // Bump the outlet menu-version counter so the customer menu cache
    // rebuilds on next read with the corrected value. Without this
    // the manual edit is invisible to anyone with a warm cache until
    // the 10-min TTL expires.
    await this.redis.incr(`menu:ver:${outletId}`);
    return result;
  }
}
