import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
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

  // Offline reconciliation flag: when set, the server skips the normal
  // step-by-step status-transition validation and writes the target
  // status directly (e.g. CREATED → SERVED for an order that was
  // placed and served while the device was offline). The actor must
  // still have UPDATE_ORDER_STATUS perms via the standard guard — the
  // flag only relaxes the state-machine check, not auth.
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
