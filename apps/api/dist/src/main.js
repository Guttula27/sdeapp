"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const transform_interceptor_1 = require("./common/interceptors/transform.interceptor");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:5173',
            process.env.CUSTOMER_URL || 'http://localhost:5174',
        ],
        credentials: true,
    });
    app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new transform_interceptor_1.TransformInterceptor());
    const config = new swagger_1.DocumentBuilder()
        .setTitle('PayNPik API')
        .setDescription('Multi-tenant restaurant SaaS platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));
    const port = process.env.API_PORT || 3001;
    await app.listen(port);
    console.log(`PayNPik API running on: http://localhost:${port}/api/v1`);
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map