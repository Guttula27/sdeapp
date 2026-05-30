import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// One cart line in a cluster checkout. Identical to the standard order line
// except it carries `outletId` so the backend can group by destination outlet
// and route each group into its own child Order.
class ClusterCartItemToppingDto {
  @IsString() toppingId!: string;
  @IsString() @IsOptional() optionId?: string;
}

class ClusterCartItemDto {
  @IsString() outletId!: string;
  @IsString() itemId!: string;
  @IsString() @IsOptional() variantId?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @IsOptional() notes?: string;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ClusterCartItemToppingDto)
  toppings?: ClusterCartItemToppingDto[];
}

export class CreateClusterOrderDto {
  @IsString() clusterBusinessId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ClusterCartItemDto)
  items!: ClusterCartItemDto[];
  // Optional: customer is at a table in the cluster's shared seating. Stored
  // as plain id on ClusterOrder; child Orders inherit a corresponding tableId
  // when the table belongs to that child's outlet.
  @IsString() @IsOptional() tableId?: string;
  @IsBoolean() @IsOptional() isParcel?: boolean;
  @IsString() @IsOptional() notes?: string;
}

export class VerifyClusterPaymentDto {
  @IsString() razorpayPaymentId!: string;
  @IsString() razorpaySignature!: string;
}
