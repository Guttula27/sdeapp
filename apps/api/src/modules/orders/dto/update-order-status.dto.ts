import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  // Optional client-captured timestamp of when the staff actually
  // pressed the button. Used by offline replays so the server records
  // the real action time, not the eventual sync time. When omitted,
  // the server uses now().
  @IsISO8601()
  @IsOptional()
  actedAt?: string;
}
