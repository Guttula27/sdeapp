import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LanguagesService, UpsertLanguageDto } from './languages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TranslationsService } from '../translations/translations.service';

@ApiTags('Languages')
@Controller('languages')
export class LanguagesController {
  constructor(
    private service: LanguagesService,
    private translations: TranslationsService,
  ) {}

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

  // One-shot DB cleanup: removes every Translation row whose value is
  // stub-tagged (e.g. "[te] Masala Dosa"). Use this after a deploy
  // where translations had been polluted by the dev stub provider
  // bleeding into production. Returns { deleted: <count> }. The next
  // backfill / menu write recreates the rows using the real provider.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('repair-stub-tagged')
  repairStubTagged() {
    return this.translations.repairStubTagged();
  }

  // Operator-facing translation diagnostic: tries each concrete
  // provider with a sample string and reports back what happened.
  // Usage: POST /languages/diagnose-translation { text?, to? }
  //   - text defaults to "Welcome to VEZEOR"
  //   - to defaults to "te"
  // Returns per-provider { ok, durationMs, output|error } so the
  // admin can see which provider is reachable from inside the API
  // container, and whether the configured chain falls back to source.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('diagnose-translation')
  diagnose(@Body() body: { text?: string; to?: string } = {}) {
    return this.translations.diagnose(body?.text ?? '', body?.to ?? '');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':code')
  remove(@CurrentUser() user: any, @Param('code') code: string) {
    return this.service.remove(user, code);
  }
}
