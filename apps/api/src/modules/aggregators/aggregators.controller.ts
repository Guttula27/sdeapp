import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AggregatorChannel } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { AggregatorsService } from './aggregators.service';

@ApiTags('Aggregators')
@Controller()
export class AggregatorsController {
  constructor(private service: AggregatorsService) {}

  // ── Inbound webhook ─────────────────────────────────────
  // Public path — the aggregator pushes orders to a URL the operator
  // copies from this page into the aggregator's dashboard. Signature
  // verification happens inside the service via the channel adapter.
  @Public()
  @Post('webhooks/aggregator/:channel/:outletId')
  async webhook(
    @Param('channel') channel: AggregatorChannel,
    @Param('outletId') outletId: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const raw = req?.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(payload);
    return this.service.handleInboundWebhook(outletId, channel, raw, payload, headers);
  }

  // ── Integration CRUD (admin) ────────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('outlets/:outletId/aggregators')
  list(@Param('outletId') outletId: string) {
    return this.service.listIntegrations(outletId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('outlets/:outletId/aggregators/:channel')
  upsert(
    @Param('outletId') outletId: string,
    @Param('channel') channel: AggregatorChannel,
    @Body() body: {
      isActive?: boolean;
      externalRestaurantId?: string | null;
      credentials?: Record<string, any> | null;
      webhookSecret?: string | null;
      notes?: string | null;
    },
  ) {
    return this.service.upsertIntegration(outletId, channel, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('outlets/:outletId/aggregators/:channel')
  remove(
    @Param('outletId') outletId: string,
    @Param('channel') channel: AggregatorChannel,
  ) {
    return this.service.deleteIntegration(outletId, channel);
  }
}
