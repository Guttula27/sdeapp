import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { scopeFor } from '../../common/permissions/scope';
import { TranslationBackfillService } from '../translations/translation-backfill.service';

export interface UpsertLanguageDto {
  code: string;
  name: string;
  nativeName: string;
  isEnabled?: boolean;
}

@Injectable()
export class LanguagesService {
  private readonly logger = new Logger(LanguagesService.name);

  constructor(
    private prisma: PrismaService,
    private backfill: TranslationBackfillService,
  ) {}

  /**
   * Fire-and-forget backfill. Adding (or re-enabling) a language with
   * existing entities produces a half-translated UI unless we walk
   * every translatable row and push it through the translation
   * provider. We trigger this in the background so the admin gets a
   * fast response; progress shows in the API logs.
   */
  private kickBackfill(languageCode: string) {
    this.backfill.run(languageCode).catch((e) => {
      this.logger.warn(`background backfill for ${languageCode} threw: ${e?.message ?? e}`);
    });
  }

  private assertPlatform(user: any) {
    if (scopeFor(user).kind !== 'platform') {
      throw new ForbiddenException('Only platform admins can manage languages');
    }
  }

  /** Public: list enabled languages (used by everyone for the language selector). */
  listEnabled() {
    return this.prisma.language.findMany({
      where: { isEnabled: true },
      orderBy: { code: 'asc' },
    });
  }

  /** Platform admin: list everything, including disabled. */
  listAll(user: any) {
    this.assertPlatform(user);
    return this.prisma.language.findMany({ orderBy: { code: 'asc' } });
  }

  async create(user: any, dto: UpsertLanguageDto) {
    this.assertPlatform(user);
    const code = (dto.code || '').trim().toLowerCase();
    if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(code)) {
      throw new BadRequestException('Code must be an ISO 639-1/3 code, optionally with a region (e.g. "hi" or "pt-BR")');
    }
    if (!dto.name?.trim() || !dto.nativeName?.trim()) {
      throw new BadRequestException('Name and native name are required');
    }
    const existing = await this.prisma.language.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Language already exists');
    const created = await this.prisma.language.create({
      data: {
        code,
        name: dto.name.trim(),
        nativeName: dto.nativeName.trim(),
        isEnabled: dto.isEnabled ?? true,
      },
    });
    // Newly-added language is enabled by default → backfill every
    // existing translatable entity so the UI doesn't render a
    // half-translated screen on the first request.
    if (created.isEnabled) this.kickBackfill(created.code);
    return created;
  }

  async update(user: any, code: string, dto: Partial<UpsertLanguageDto>) {
    this.assertPlatform(user);
    const existing = await this.prisma.language.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Language not found');

    const updated = await this.prisma.language.update({
      where: { code },
      data: {
        name: dto.name?.trim() ?? existing.name,
        nativeName: dto.nativeName?.trim() ?? existing.nativeName,
        isEnabled: dto.isEnabled ?? existing.isEnabled,
      },
    });
    // Disabled → enabled transition: existing entities are missing
    // translations for this code. Fire the backfill so the next
    // render of any item / outlet shows native text instead of
    // falling back to English.
    if (dto.isEnabled === true && !existing.isEnabled) {
      this.kickBackfill(updated.code);
    }
    return updated;
  }

  /**
   * Admin-triggered re-run of the backfill for a given language.
   * Useful when the original create-time backfill couldn't reach the
   * translation provider (transient Lingva outage) or when new
   * entities have piled up since the language was added.
   */
  async regenerate(user: any, code: string) {
    this.assertPlatform(user);
    if (code === 'en') throw new BadRequestException('English is the source — nothing to regenerate');
    const existing = await this.prisma.language.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Language not found');
    if (!existing.isEnabled) {
      throw new BadRequestException('Enable the language before regenerating translations');
    }
    this.kickBackfill(code);
    return { ok: true, message: `Backfill started for ${existing.name}; check API logs for progress.` };
  }

  async remove(user: any, code: string) {
    this.assertPlatform(user);
    if (code === 'en') throw new BadRequestException('The source language (English) cannot be removed');
    const existing = await this.prisma.language.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Language not found');
    // Cascade on Translation rows is handled by the FK.
    await this.prisma.language.delete({ where: { code } });
    return { message: 'Language deleted' };
  }
}
