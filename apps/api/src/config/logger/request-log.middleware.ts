import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';

// Per-request access log: one line per response with method, path,
// status, latency, and the authenticated user id (if any). Sits
// before the auth guard so we still see 401s; the user id only
// appears once the guard populates req.user.
@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Health and Swagger noise — skip so they don't drown the log.
    if (req.path === '/api/v1/health' || req.path.startsWith('/api/docs')) {
      return next();
    }
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const userId = (req as any).user?.id ?? null;
      this.logger.info('http', {
        context: 'HTTP',
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms,
        userId,
      });
    });
    next();
  }
}
