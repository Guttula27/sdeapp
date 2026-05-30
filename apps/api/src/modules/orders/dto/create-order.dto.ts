import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemToppingDto {
  @IsString()
  toppingId: string;

  @IsString()
  @IsOptional()
  optionId?: string;
}

class OrderItemDto {
  // itemId references the selected menu item. If the item is a bundle
  // (isBundle=true on the Item), the server transparently expands it into
  // N child OrderItem rows at order time — the cart sends the same shape
  // for bundles and regular items.
  @IsString()
  itemId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderItemToppingDto)
  toppings?: OrderItemToppingDto[];

  // Customer-choice bundles: the picked ItemBundleChild ids. Required when
  // the parent Item has maxBundleSelections set; ignored otherwise. The
  // server validates count + ownership before expanding.
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  bundleSelections?: string[];
}

class OrderPaymentDto {
  @IsString()
  mode: string; // 'UPI' | 'CASH' | 'CARD' …

  @IsString()
  @IsOptional()
  app?: string;        // 'GPAY' | 'PHONEPE' | 'PAYTM' | 'BHIM' | 'OTHER'

  @IsString()
  @IsOptional()
  gatewayRef?: string; // UPI txn ref the customer enters or we generate

  @IsString()
  @IsOptional()
  status?: string;     // 'SUCCESS' | 'PENDING'
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  sectionId?: string;

  @IsBoolean()
  @IsOptional()
  isParcel?: boolean;

  // Dine-in Postpaid: order is created without payment and stays open to
  // additional items until Bill Now is pressed.
  @IsBoolean()
  @IsOptional()
  isPostpaid?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;

  // Newer structured promo fields (the cart's POST /cart/quote returns these
  // by id). Coupon is one-per-bill; rewardPoints is the customer's chosen
  // burn amount and is validated server-side against their balance + cap.
  @IsString()
  @IsOptional()
  couponId?: string;

  @IsInt()
  @IsOptional()
  rewardPoints?: number;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  paymentMode?: string; // 'CASH' | 'UPI' | …  (used by staff Place Order flow)

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderPaymentDto)
  payment?: OrderPaymentDto;
}
