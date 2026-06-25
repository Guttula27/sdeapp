import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { OrderItemStatus } from '@prisma/client';

export class UpdateItemStatusDto {
  @IsEnum(OrderItemStatus)
  status: OrderItemStatus;

  // Client-captured timestamp of the action. Used by offline replays
  // so the per-item status history reflects when the kitchen actually
  // pressed Ready, not when the outbox eventually flushed.
  @IsISO8601()
  @IsOptional()
  actedAt?: string;
}
