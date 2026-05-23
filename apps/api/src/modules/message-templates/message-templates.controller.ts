import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TemplateApprovalStatus, TemplateChannel, TemplateScope } from '@prisma/client';
import {
  ApproveProviderDto,
  MessageTemplatesService,
  RejectTemplateDto,
  UpsertTemplateDto,
} from './message-templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Message Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private service: MessageTemplatesService) {}

  // ─── Listing ─────────────────────────────────────────
  @Get()
  list(
    @CurrentUser() user: any,
    @Query('channel') channel?: TemplateChannel,
    @Query('status') status?: TemplateApprovalStatus,
    @Query('scope') scope?: TemplateScope,
  ) {
    return this.service.list(user, { channel, status, scope });
  }

  // Platform-admin pending queue. Declared before `:id` so it isn't shadowed.
  @Get('pending')
  pending() {
    return this.service.pendingQueue();
  }

  // ─── Author CRUD ─────────────────────────────────────
  @Post()
  create(@CurrentUser() user: any, @Body() dto: UpsertTemplateDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: Partial<UpsertTemplateDto>) {
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  // ─── Approval workflow ───────────────────────────────
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.submit(id, user);
  }

  @Post(':id/forward-to-provider')
  forward(@Param('id') id: string, @Body() dto: ApproveProviderDto) {
    return this.service.forwardToProvider(id, dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: Partial<ApproveProviderDto> = {}) {
    return this.service.markApproved(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectTemplateDto) {
    return this.service.reject(id, dto);
  }
}
