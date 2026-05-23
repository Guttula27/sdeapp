import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesService, CreateRoleDto, ToggleResponsibilityDto } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private service: RolesService) {}

  @Get('responsibilities')
  listResponsibilities(@CurrentUser() user: any) {
    return this.service.listResponsibilities(user);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateRoleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: Partial<Pick<CreateRoleDto, 'name' | 'description'>>,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/responsibilities')
  toggle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ToggleResponsibilityDto,
  ) {
    return this.service.toggleResponsibility(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
