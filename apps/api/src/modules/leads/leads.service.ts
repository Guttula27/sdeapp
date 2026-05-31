import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateLeadDto) {
    return this.prisma.lead.create({
      data: { ...data, source: data.source || 'landing-page' },
    });
  }

  findAll(status?: string, take?: number, skip?: number) {
    // ValidationPipe's implicit number conversion can produce NaN for
    // missing query params, which Prisma rejects. Coerce defensively.
    const t = Number.isFinite(Number(take)) ? Number(take) : 50;
    const s = Number.isFinite(Number(skip)) ? Number(skip) : 0;
    const where = status ? { status: status as any } : {};
    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: t,
      skip: s,
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async updateStatus(id: string, status: string, notes?: string) {
    await this.findOne(id);
    return this.prisma.lead.update({
      where: { id },
      data: { status: status as any, ...(notes !== undefined && { notes }) },
    });
  }

  async stats() {
    const [total, byStatus] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.groupBy({ by: ['status'], _count: { id: true } }),
    ]);
    return {
      total,
      byStatus: byStatus.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = r._count.id;
        return acc;
      }, {}),
    };
  }
}
