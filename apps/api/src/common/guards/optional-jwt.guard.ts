import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Run JWT validation but never block the request
    return super.canActivate(context);
  }

  // Return the user if valid, null if not — never throw
  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
