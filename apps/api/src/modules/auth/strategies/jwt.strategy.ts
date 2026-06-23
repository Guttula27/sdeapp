import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
    });
  }

  async validate(payload: { sub: string; phone: string; resp?: string[] }) {
    // Fast path: token already carries the resolved permission set.
    // Skip the role.responsibilities + user.responsibilities joins
    // entirely — the stress test caught those doing 27k *NO INDEX*
    // scans per run (see docs/performance-hardening-plan.md A5/C10).
    // The synthesised role.responsibilities array preserves the shape
    // existing callers read (`r.responsibility.name`).
    if (Array.isArray(payload.resp)) {
      const user = await this.authService.validateUserCore(payload.sub);
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
      const synthetic = payload.resp.map((name) => ({ responsibility: { name } }));
      return {
        ...user,
        role: user.role ? { ...user.role, responsibilities: synthetic } : null,
      };
    }
    // Legacy path: tokens minted before the `resp` claim landed. Falls
    // through to the original DB-join shape so old sessions keep
    // working until they expire. Remove this branch after one full
    // refresh window (7 days).
    const user = await this.authService.validateUser(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    return user;
  }
}
