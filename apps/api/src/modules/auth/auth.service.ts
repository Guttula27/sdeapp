import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../config/prisma/prisma.service';
import { EncryptionService } from '../../config/crypto/encryption.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/customer-otp.dto';

// Customer session lives one month (or until explicit logout).
const CUSTOMER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const CUSTOMER_JWT_EXPIRY = '30d';

// During the testing phase, every customer OTP is the same constant.
// TODO(otp): swap for a per-phone generated code stored in an OtpRequest table,
// expiring after 5 min, and dispatch via SMS provider.
const TEST_CUSTOMER_OTP = '123789';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryption: EncryptionService,
  ) {}

  // Centralised phone→User lookup so every callsite goes through the
  // same dual-read path: prefer the HMAC index (fast, unique, no
  // plaintext exposure), fall back to the legacy plaintext column for
  // users whose row hasn't been backfilled yet.
  private async findUserByPhone<T extends { phone?: string | null } = any>(
    phone: string,
    extras?: { include?: any; select?: any },
  ): Promise<T | null> {
    const normalized = this.encryption.normalizePhone(phone);
    const hash = this.encryption.phoneHmac(normalized);
    const args = extras ?? {};
    const byHash = await this.prisma.user.findUnique({
      where: { phoneHash: hash },
      ...(args as any),
    });
    if (byHash) return byHash as any;
    return this.prisma.user.findUnique({
      where: { phone: normalized },
      ...(args as any),
    }) as any;
  }

  async register(dto: RegisterDto) {
    const existing = await this.findUserByPhone(dto.phone);
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        ...this.encryption.buildPhoneFields(dto.phone),
        email: dto.email,
        passwordHash,
      },
      select: { id: true, name: true, phone: true, email: true, status: true, createdAt: true },
    });

    const tokens = this.generateTokens(user.id, user.phone);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user: any = await this.findUserByPhone(dto.phone, {
      include: {
        role: { include: { responsibilities: { include: { responsibility: true } } } },
        // Cluster context so the client can route Cluster Owners straight
        // to their cluster admin instead of /dashboard.
        business: { select: { id: true, name: true, isCluster: true } },
      },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.jwtService.sign({ sub: user.id }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Strip internal encryption columns too — `phoneHash` would let
    // a client reverse-lookup a phone by brute-forcing HMACs, and
    // `phoneEnc` leaks the ciphertext format. The client only needs
    // the decrypted `phone` field for display.
    const { passwordHash, phoneEnc, phoneHash, ...safeUser } = user as any;
    void passwordHash; void phoneEnc; void phoneHash; // strip-only
    const tokens = this.generateTokens(user.id, user.phone);
    return { user: safeUser, ...tokens };
  }

  async logout(userId: string, token: string) {
    await this.prisma.session.deleteMany({ where: { userId, token } });
    return { message: 'Logged out successfully' };
  }

  /* ────────────────────── Customer OTP flow ────────────────────── */

  async requestCustomerOtp(dto: RequestOtpDto) {
    const phone = (dto.phone || '').trim();
    if (!phone) throw new BadRequestException('Phone is required');

    // Block phones already attached to a staff/admin account (those have passwords).
    const existing: any = await this.findUserByPhone(phone);
    if (existing && existing.businessId) {
      throw new UnauthorizedException('Use the staff portal to sign in with this number');
    }

    // TODO(notifications): dispatch SMS containing the OTP.
    // During the testing phase the OTP is always TEST_CUSTOMER_OTP (123789).
    // eslint-disable-next-line no-console
    console.log(`[OTP] phone=${phone} otp=${TEST_CUSTOMER_OTP} (test mode)`);

    return { message: 'OTP sent', phone };
  }

  async verifyCustomerOtp(dto: VerifyOtpDto) {
    const phone = (dto.phone || '').trim();
    if (!phone) throw new BadRequestException('Phone is required');
    if (dto.otp !== TEST_CUSTOMER_OTP) throw new UnauthorizedException('Invalid OTP');

    let user: any = await this.findUserByPhone(phone, {
      include: { role: { include: { responsibilities: { include: { responsibility: true } } } } },
    });

    if (user && user.businessId) {
      throw new UnauthorizedException('Use the staff portal to sign in with this number');
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: dto.name?.trim() || `Guest ${phone.slice(-4)}`,
          ...this.encryption.buildPhoneFields(phone),
          status: 'ACTIVE',
        },
        include: { role: { include: { responsibilities: { include: { responsibility: true } } } } },
      });
    } else if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, phone: user.phone },
      { expiresIn: CUSTOMER_JWT_EXPIRY },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, phone: user.phone },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: CUSTOMER_JWT_EXPIRY },
    );

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + CUSTOMER_SESSION_MS),
      },
    });

    const { passwordHash, ...safeUser } = user as any;
    return { user: safeUser, accessToken, refreshToken };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        preferredUpiApp: true,
        preferredLanguage: true,
        profileImageUrl: true,
        alertRingtone: true,
        alertVolume: true,
        mustChangePassword: true,
        businessId: true,
        outletId: true,
        // Surface enough business context for the client to decide the
        // landing page. Cluster Owners go straight to the cluster admin
        // page instead of the standard /dashboard.
        business: { select: { id: true, name: true, isCluster: true } },
        role: {
          include: { responsibilities: { include: { responsibility: true } } },
        },
        responsibilities: { include: { responsibility: true } },
      },
    });
    if (!user) return null;

    // Apply per-user overrides so the role.responsibilities array exposes the
    // *effective* set. The web client's useUserRole hook reads this array.
    const rolePerms = user.role?.responsibilities ?? [];
    const grants  = user.responsibilities.filter((ur) => ur.granted);
    const revokes = new Set(user.responsibilities.filter((ur) => !ur.granted).map((ur) => ur.responsibility.name));

    const effective: typeof rolePerms = [];
    const seen = new Set<string>();
    for (const rp of rolePerms) {
      if (revokes.has(rp.responsibility.name)) continue;
      effective.push(rp);
      seen.add(rp.responsibility.name);
    }
    for (const g of grants) {
      if (seen.has(g.responsibility.name)) continue;
      effective.push({ roleId: user.role?.id ?? '', responsibilityId: g.responsibilityId, responsibility: g.responsibility } as any);
      seen.add(g.responsibility.name);
    }

    const { responsibilities: _overrides, ...rest } = user;
    return {
      ...rest,
      role: user.role ? { ...user.role, responsibilities: effective } : null,
    };
  }

  private generateTokens(userId: string, phone: string) {
    const payload = { sub: userId, phone };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    };
  }
}
