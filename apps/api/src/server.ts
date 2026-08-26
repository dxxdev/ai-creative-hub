import express from "express";
import cors from "cors";
import path from "node:path";
import routes from "./routes/index.js";
import postsRouter from "./routes/posts.routes.js";
import mediaRouter from "./routes/media.routes.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { env } from "./config/env.js";
import "./lib/redis.js";
import "./queues/email.queue.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(cookieParser())
app.use(cors({
  origin: "http://localhost:3001",
  credentials: true,
}));
app.use(express.json());

app.use(
  env.PUBLIC_UPLOAD_BASE_URL,
  express.static(path.resolve(process.cwd(), env.UPLOAD_DIR))
);

app.use(routes);
app.use('/posts', postsRouter);
app.use('/media', mediaRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(
    `✅ API server ishga tushdi (${env.NODE_ENV}): http://localhost:${env.PORT}`
  );
});

export default app;