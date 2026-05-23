import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { StaffPermissionsService } from './staff-permissions.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, StaffPermissionsService],
  exports: [UsersService, StaffPermissionsService],
})
export class UsersModule {}
