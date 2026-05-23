import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  MessageTemplate,
  Prisma,
  TemplateApprovalStatus,
  TemplateCategory,
  TemplateChannel,
  TemplateScope,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';

export class UpsertTemplateDto {
  @IsEnum(TemplateChannel) channel!: TemplateChannel;
  @IsString() name!: string;
  @IsString() body!: string;
  @IsOptional() @IsEnum(TemplateCategory) category?: TemplateCategory;
  @IsOptional() @IsString() trigger?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsEnum(TemplateScope) scope?: TemplateScope; // platform admin may pass PLATFORM
}

export class RejectTemplateDto {
  @IsString() reason!: string;
}

export class ApproveProviderDto {
  @IsString() providerKey!: string;
  @IsOptional() @IsString() providerTemplateId?: string;
}

// Extract {{varName}} tokens once at write-time so the UI doesn't have to re-parse.
const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
function extractVariables(body: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = VAR_RE.exec(body)) !== null) set.add(m[1]);
  return [...set];
}

type Caller = { id: string; businessId?: string | null; outletId?: string | null };

@Injectable()
export class MessageTemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Derive template scope from the caller. Outlet admin → OUTLET, business owner
   * (no outletId) → BUSINESS, platform admin (neither) → PLATFORM. Callers may
   * still create at a wider scope when the controller passes it through, but
   * the service guards against narrowing scope unsafely.
   */
  private scopeForCaller(caller: Caller, requested?: TemplateScope): {
    scope: TemplateScope;
    businessId: string | null;
    outletId: string | null;
  } {
    if (requested === TemplateScope.PLATFORM) {
      if (caller.businessId || caller.outletId) {
        throw new ForbiddenException('Only platform admin can create PLATFORM templates');
      }
      return { scope: 'PLATFORM', businessId: null, outletId: null };
    }
    if (caller.outletId) return { scope: 'OUTLET', businessId: caller.businessId ?? null, outletId: caller.outletId };
    if (caller.businessId) return { scope: 'BUSINESS', businessId: caller.businessId, outletId: null };
    return { scope: 'PLATFORM', businessId: null, outletId: null };
  }

  /**
   * List templates visible to caller. Business owners see PLATFORM + their
   * business templates; outlet admins also see their own outlet templates.
   * Platform admins see everything.
   */
  list(caller: Caller, opts: { channel?: TemplateChannel; status?: TemplateApprovalStatus; scope?: TemplateScope } = {}) {
    const where: Prisma.MessageTemplateWhereInput = {};
    if (opts.channel) where.channel = opts.channel;
    if (opts.status) where.approvalStatus = opts.status;

    const scopeFilter: Prisma.MessageTemplateWhereInput[] = [{ scope: 'PLATFORM' }];
    if (caller.businessId) scopeFilter.push({ scope: 'BUSINESS', businessId: caller.businessId });
    if (caller.outletId) scopeFilter.push({ scope: 'OUTLET', outletId: caller.outletId });

    if (!caller.businessId && !caller.outletId) {
      // platform admin: no scope filter
    } else {
      where.OR = scopeFilter;
    }
    if (opts.scope) where.scope = opts.scope;

    return this.prisma.messageTemplate.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  /** Approval queue for platform admin — everything not yet APPROVED/REJECTED, including platform-authored drafts. */
  pendingQueue() {
    return this.prisma.messageTemplate.findMany({
      where: { approvalStatus: { in: ['PENDING_PLATFORM', 'PENDING_PROVIDER'] } },
      orderBy: [{ submittedAt: 'asc' }],
      include: {
        business: { select: { id: true, name: true } },
        outlet: { select: { id: true, name: true } },
      },
    });
  }

  async create(caller: Caller, dto: UpsertTemplateDto): Promise<MessageTemplate> {
    const scope = this.scopeForCaller(caller, dto.scope);
    if (!dto.name?.trim()) throw new BadRequestException('Template name is required');
    if (!dto.body?.trim()) throw new BadRequestException('Template body is required');

    const variables = extractVariables(dto.body);
    return this.prisma.messageTemplate.create({
      data: {
        scope: scope.scope,
        channel: dto.channel,
        name: dto.name.trim(),
        body: dto.body,
        category: dto.category ?? 'TRANSACTIONAL',
        trigger: dto.trigger,
        language: dto.language ?? 'en',
        variables,
        businessId: scope.businessId,
        outletId: scope.outletId,
        createdById: caller.id,
        approvalStatus: 'DRAFT',
      },
    });
  }

  private async loadOwned(id: string, caller: Caller): Promise<MessageTemplate> {
    const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    // Platform admin (no business/outlet) can touch anything; otherwise scope must match.
    const isPlatform = !caller.businessId && !caller.outletId;
    if (!isPlatform) {
      if (t.scope === 'OUTLET' && t.outletId !== caller.outletId) {
        throw new ForbiddenException();
      }
      if (t.scope === 'BUSINESS' && t.businessId !== caller.businessId) {
        throw new ForbiddenException();
      }
      if (t.scope === 'PLATFORM') {
        throw new ForbiddenException('Cannot modify platform templates');
      }
    }
    return t;
  }

  async update(id: string, caller: Caller, dto: Partial<UpsertTemplateDto>): Promise<MessageTemplate> {
    const t = await this.loadOwned(id, caller);
    if (t.approvalStatus === 'APPROVED' || t.approvalStatus === 'PENDING_PROVIDER') {
      throw new BadRequestException('Approved or provider-pending templates cannot be edited. Clone and resubmit instead.');
    }
    const newBody = dto.body ?? t.body;
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.channel ? { channel: dto.channel } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.body ? { body: dto.body, variables: extractVariables(newBody) } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.language ? { language: dto.language } : {}),
        // any edit resets approval state
        approvalStatus: 'DRAFT',
        rejectionReason: null,
        submittedAt: null,
        reviewedAt: null,
      },
    });
  }

  async remove(id: string, caller: Caller) {
    await this.loadOwned(id, caller);
    return this.prisma.messageTemplate.delete({ where: { id } });
  }

  async submit(id: string, caller: Caller) {
    const t = await this.loadOwned(id, caller);
    if (t.approvalStatus !== 'DRAFT' && t.approvalStatus !== 'REJECTED') {
      throw new BadRequestException('Only drafts or rejected templates can be submitted');
    }
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        approvalStatus: 'PENDING_PLATFORM',
        submittedAt: new Date(),
        reviewedAt: null,
        rejectionReason: null,
      },
    });
  }

  /** Platform admin forwards a submission to the provider (e.g. Meta WhatsApp BSP). */
  async forwardToProvider(id: string, dto: ApproveProviderDto) {
    const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    if (t.approvalStatus !== 'PENDING_PLATFORM') {
      throw new BadRequestException('Only platform-pending templates can be forwarded');
    }
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        approvalStatus: 'PENDING_PROVIDER',
        providerKey: dto.providerKey,
        providerTemplateId: dto.providerTemplateId ?? null,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
  }

  /** Either a platform admin marking the template as provider-approved, or directly approving an SMS/Email template that needs no provider. */
  async markApproved(id: string, dto: Partial<ApproveProviderDto>) {
    const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    if (t.approvalStatus === 'APPROVED') return t;
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        ...(dto.providerKey ? { providerKey: dto.providerKey } : {}),
        ...(dto.providerTemplateId ? { providerTemplateId: dto.providerTemplateId } : {}),
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
  }

  async reject(id: string, dto: RejectTemplateDto) {
    const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: dto.reason,
        reviewedAt: new Date(),
      },
    });
  }
}
