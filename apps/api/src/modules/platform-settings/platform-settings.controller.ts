import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { scopeFor } from '../../common/permissions/scope';
import { ForbiddenException } from '@nestjs/common';

class UpdatePlatformSettingsDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) platformFeePercent?: number;
  @IsOptional() @IsNumber() @Min(0) platformFeeMinimum?: number;
}

@ApiTags('PlatformSettings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(private service: PlatformSettingsService) {}

  // Settings are read across the whole app (e.g. payments) but only a
  // platform admin sees them in the UI. Keep the GET open to any
  // authenticated user — there's no sensitive data here (just the
  // platform-wide fee defaults that customers indirectly experience).
  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  update(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: any) {
    const scope = scopeFor(user);
    if (scope.kind !== 'platform') {
      throw new ForbiddenException('Only platform admins can update platform settings');
    }
    return this.service.update(dto);
  }
}
