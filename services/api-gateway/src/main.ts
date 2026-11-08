import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import {
  DEFAULT_DEV_CORS_ORIGINS,
  parseCorsOrigins,
} from './config/cors-origins.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const corsOrigins =
    parseCorsOrigins(config.get<string>('CORS_ORIGINS')) ??
    (nodeEnv === 'production' ? false : [...DEFAULT_DEV_CORS_ORIGINS]);
  app.enableCors({ origin: corsOrigins });

  const port = config.getOrThrow<number>('API_GATEWAY_PORT');
  await app.listen(port);
}

await bootstrap();
