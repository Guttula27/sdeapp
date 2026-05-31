import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import * as dayjs from 'dayjs';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async getPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true } });
  }

  async createPlan(data: any) {
    return this.prisma.plan.create({ data });
  }

  async subscribe(businessId: string, planId: string, billing: 'MONTHLY' | 'ANNUAL') {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const startDate = new Date();
    const endDate = billing === 'ANNUAL'
      ? dayjs().add(1, 'year').toDate()
      : dayjs().add(1, 'month').toDate();

    const subscription = await this.prisma.subscription.create({
      data: {
        planId,
        status: 'ACTIVE',
        startDate,
        endDate,
      },
    });

    await this.prisma.business.update({
      where: { id: businessId },
      data: { subscriptionId: subscription.id },
    });

    const amount = billing === 'ANNUAL' ? Number(plan.annualCost) : Number(plan.monthlyCost);
    const gstAmount = amount * 0.18;

    await this.prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        gstAmount,
        totalAmount: amount + gstAmount,
        dueDate: new Date(),
        status: 'PENDING',
      },
    });

    return subscription;
  }

  async getBusinessSubscription(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: { include: { plan: true, invoices: true } } },
    });
    return business?.subscription;
  }

  async getInvoices(businessId?: string) {
    if (!businessId) return [];
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { subscriptionId: true },
    });
    if (!business?.subscriptionId) return [];
    return this.prisma.invoice.findMany({
      where: { subscriptionId: business.subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
