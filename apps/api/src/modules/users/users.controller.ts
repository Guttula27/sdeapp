import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { StaffPermissionsService, SetOverridesDto } from './staff-permissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private service: UsersService,
    private staffPermissions: StaffPermissionsService,
  ) {}

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Get()
  findAll(
    @Query('businessId') businessId?: string,
    @Query('outletId') outletId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(businessId, outletId, page, limit);
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return user;
  }

  @Get('orders/history')
  getMyOrders(
    @CurrentUser('id') userId: string,
    @PreferredLanguage() lang: string | null,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getOrderHistory(userId, page, limit, lang);
  }

  @Get('me/stats')
  getMyStats(
    @CurrentUser('id') userId: string,
    @PreferredLanguage() lang: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getCustomerStats(
      userId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      lang,
    );
  }

  @Get('me/promotions')
  getMyPromotions(@CurrentUser('id') userId: string) {
    return this.service.getCustomerPromotions(userId);
  }

  @Get('me/favorites')
  listFavorites(@CurrentUser('id') userId: string, @PreferredLanguage() lang: string | null) {
    return this.service.listFavorites(userId, lang);
  }

  @Post('me/favorites/:itemId')
  addFavorite(@CurrentUser('id') userId: string, @Param('itemId') itemId: string) {
    return this.service.addFavorite(userId, itemId);
  }

  @Delete('me/favorites/:itemId')
  removeFavorite(@CurrentUser('id') userId: string, @Param('itemId') itemId: string) {
    return this.service.removeFavorite(userId, itemId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    if (body.currentPassword && body.newPassword) {
      return this.service.updatePassword(id, body.currentPassword, body.newPassword);
    }
    return this.service.update(id, body);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.service.toggleStatus(id);
  }

  @Patch('me/language')
  setMyLanguage(@CurrentUser('id') userId: string, @Body() body: { preferredLanguage: string }) {
    return this.service.setPreferredLanguage(userId, body.preferredLanguage);
  }

  @Get(':id/permissions')
  getPermissions(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.staffPermissions.getForUser(actor, id);
  }

  @Put(':id/permissions')
  setPermissions(
    @CurrentUser() actor: any,
    @Param('id') id: string,
    @Body() dto: SetOverridesDto,
  ) {
    return this.staffPermissions.setOverrides(actor, id, dto);
  }
}
