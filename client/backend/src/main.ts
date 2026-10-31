import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('client-api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });
  const corsOrigin = process.env.CLIENT_FRONTEND_URL || (!isProd ? 'http://localhost:3003' : undefined);
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((s) => s.trim()) : false,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('OYNA Client API')
    .setDescription('Player-facing API for OYNA client portal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (!isProd) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('client-api/docs', app, document);
  }

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Client backend running on http://localhost:${port}/client-api`);
  console.log(`Swagger docs: http://localhost:${port}/client-api/docs`);
}

bootstrap();
