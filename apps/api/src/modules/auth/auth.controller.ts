import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/customer-otp.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Tight per-IP cap on public auth surfaces (login, OTP request/verify,
// forgot-password). Sits below the global 100/min so a single IP
// brute-forcing credentials or OTPs hits this first. Full per-phone
// lockout + failed-attempt counter is the deeper fix tracked in
// Phase 5 (G4, G6) of docs/performance-hardening-plan.md.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('customer/request-otp')
  requestCustomerOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestCustomerOtp(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('customer/verify-otp')
  verifyCustomerOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyCustomerOtp(dto);
  }

  // Staff/admin forgot-password — phone + OTP reset flow.
  // Public on purpose: an unauthenticated user has to be able to start
  // the reset before they have a valid session.
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('admin/forgot-password/request')
  requestStaffPasswordReset(@Body() body: { phone: string }) {
    return this.authService.requestStaffPasswordReset(body?.phone);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('admin/forgot-password/reset')
  resetStaffPassword(@Body() body: { phone: string; otp: string; newPassword: string }) {
    return this.authService.resetStaffPassword(body?.phone, body?.otp, body?.newPassword);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return user;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser('id') userId: string, @Req() req: any) {
    const token = req.headers.authorization?.split(' ')[1];
    return this.authService.logout(userId, token);
  }
}
