import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { scopeFor } from '../../common/permissions/scope';

export interface UpsertLanguageDto {
  code: string;
  name: string;
  nativeName: string;
  isEnabled?: boolean;
}

@Injectable()
export class LanguagesService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.language.create({
      data: {
        code,
        name: dto.name.trim(),
        nativeName: dto.nativeName.trim(),
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async update(user: any, code: string, dto: Partial<UpsertLanguageDto>) {
    this.assertPlatform(user);
    const existing = await this.prisma.language.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Language not found');

    return this.prisma.language.update({
      where: { code },
      data: {
        name: dto.name?.trim() ?? existing.name,
        nativeName: dto.nativeName?.trim() ?? existing.nativeName,
        isEnabled: dto.isEnabled ?? existing.isEnabled,
      },
    });
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
