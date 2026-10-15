import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Rfc7807ExceptionFilter } from './common/rfc7807-exception.filter';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV !== 'production',
    }),
  );

  // Enable CORS with credentials for React SPA
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.CORS_ORIGIN,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global RFC 7807 Exception Filter
  app.useGlobalFilters(new Rfc7807ExceptionFilter());

  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);
  logger.log(`CRM SaaS API running on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error('Fatal API bootstrap error:', err);
  process.exit(1);
});
