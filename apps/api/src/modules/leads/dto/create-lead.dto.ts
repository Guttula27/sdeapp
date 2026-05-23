import { IsString, IsOptional, IsEmail, IsInt, Min, Max, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  restaurantName!: string;

  @IsString()
  @Matches(/^[+0-9 \-]{7,20}$/, { message: 'Invalid phone number' })
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  outletCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}
