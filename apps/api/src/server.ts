import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { env } from "./config/env.js";
import "./lib/redis.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(
    `✅ API server ishga tushdi (${env.NODE_ENV}): http://localhost:${env.PORT}`
  );
});