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

  app.enableCors({
    origin: process.env.CLIENT_FRONTEND_URL || 'http://localhost:3003',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('OYNA Client API')
    .setDescription('Player-facing API for OYNA client portal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('client-api/docs', app, document);

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Client backend running on http://localhost:${port}/client-api`);
  console.log(`Swagger docs: http://localhost:${port}/client-api/docs`);
}

bootstrap();
