import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Refresh token httpOnly cookie orqali yuboriladi (PRD 1.3.1, band 8)
  app.use(cookieParser());

  // Barcha DTO'lar uchun global validatsiya: noma'lum maydonlarni tashlab yuboradi,
  // primitivlarni to'g'ri tiplarga o'giradi, xato bo'lsa 400 qaytaradi.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true, // refresh token cookie'si uchun zarur
  });

  app.setGlobalPrefix("api");

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API ${port}-portda ishga tushdi: http://localhost:${port}/api`);
}

bootstrap();