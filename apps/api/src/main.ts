import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { winstonAppConfig } from './config/logger/winston.config';

async function bootstrap() {
  // Boot Nest with Winston as the framework logger so every
  // `Logger.log()` / framework boot message flows through the same
  // pipeline as our app + audit logs.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonAppConfig),
  });

  // Replace Express's default body parsers (100 KB) with 16 MB ceilings so
  // base64-data-URL image uploads on item / outlet / business endpoints
  // don't 413 before reaching the route. The matching DB column was widened
  // from TEXT (64 KB) to MEDIUMTEXT (16 MB) in 20260615120000; this raises
  // the wire ceiling to the same headroom.
  app.useBodyParser('json',       { limit: '16mb' });
  app.useBodyParser('urlencoded', { limit: '16mb', extended: true });

  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Standard browser-side security headers (HSTS, X-Content-Type-Options,
  // Referrer-Policy, X-Frame-Options, etc.). Two opt-outs:
  //   • CSP — disabled here because Swagger UI uses inline scripts and
  //     a tight default policy would break it. Tune per deployment if
  //     you want to enforce CSP (production with Swagger off is the
  //     natural place).
  //   • Cross-Origin-Embedder-Policy — disabled because we serve images
  //     and webhook payloads to clients that don't send CORP headers.
  // HSTS itself is safe to keep on: browsers ignore it over plain HTTP,
  // so it's a no-op in local dev and takes effect once HTTPS is in
  // front in production.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // gzip every response above the default ~1 KB threshold. The single
  // biggest win is on the menu / reports / orders endpoints where the
  // JSON structural overhead (names, descriptions, variants, prices,
  // IDs) compresses 70-80 %. Inline base64 image bytes compress less
  // (~25 %) since the underlying JPEG is already entropy-dense, but
  // the gain still adds up when there are many small images. Filter
  // skips responses that explicitly opt out via the `x-no-compression`
  // header — useful for hooks that need byte-exact payloads.
  app.use(compression({
    filter: (req: any, res: any) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }));

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      process.env.CUSTOMER_URL || 'http://localhost:5174',
    ],
    credentials: true,
  });

  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger UI exposes the full API surface (endpoints, schemas, auth
  // requirements) — fine for local dev, but a recon gift for an attacker
  // in production. Default to OFF in production; opt in by setting
  // ENABLE_SWAGGER=true (e.g. behind an IP allowlist or temporarily for
  // a debugging session).
  const swaggerEnabled = process.env.ENABLE_SWAGGER === 'true'
    || (process.env.ENABLE_SWAGGER !== 'false' && process.env.NODE_ENV !== 'production');

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('PayNPik API')
      .setDescription('Multi-tenant restaurant SaaS platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Health check
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api/v1/health', (_req: any, res: any) => res.json({ status: 'ok', timestamp: new Date() }));

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`PayNPik API running on: http://localhost:${port}/api/v1`);
  if (swaggerEnabled) {
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  } else {
    console.log('Swagger docs: disabled (set ENABLE_SWAGGER=true to enable)');
  }
}

bootstrap();
