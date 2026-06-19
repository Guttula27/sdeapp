import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';

@ApiTags('Push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  /**
   * Customer client calls this once `getToken` resolves (Capacitor
   * PushNotifications listener) or once the browser SW subscribes
   * (Web Push, follow-up). Idempotent — same token from the same
   * user just bumps updatedAt.
   *
   * Body shape:
   *   {
   *     kind: 'FCM' | 'WEBPUSH',
   *     token: string,        // FCM registration id, or VAPID endpoint
   *     platform?: 'android' | 'ios' | 'web' | string,
   *   }
   */
  @Post('register')
  async register(
    @CurrentUser('id') userId: string,
    @Body() body: { kind: 'FCM' | 'WEBPUSH'; token: string; platform?: string | null },
  ) {
    return this.push.registerToken({
      userId,
      kind: body?.kind || 'FCM',
      token: body?.token,
      platform: body?.platform ?? null,
    });
  }

  /**
   * Called when the user explicitly turns notifications off in the
   * app, or when the OS-level permission is revoked and the client
   * detects it. Removes the row so the server stops trying to push
   * to a token that won't be received.
   */
  @Delete('register')
  async unregister(
    @CurrentUser('id') userId: string,
    @Body() body: { token: string },
  ) {
    return this.push.unregisterToken(userId, body?.token);
  }
}
