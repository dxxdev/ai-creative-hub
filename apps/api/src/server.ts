import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "ai-creative-hub-api" });
});

// TODO: auth route'lari shu yerga ulanadi (apps/api/src/routes/auth.ts)
// app.use("/api/auth", authRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route topilmadi" });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Serverda kutilmagan xatolik" });
});

app.listen(PORT, () => {
  console.log(`✅ API server ishga tushdi: http://localhost:${PORT}`);
});