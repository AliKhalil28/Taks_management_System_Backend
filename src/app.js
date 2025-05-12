import express from "express";
import cors from "cors";
import cookiesParser from "cookie-parser";
import multer from "multer";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ limit: "16kb", extended: true }));
app.use(cookiesParser());
app.use(multer().none());
app.use(express.static("public"));

// Import routes
import userRouter from "./routes/user.routes.js";
import taskRouter from "./routes/task.routes.js";

// Routes Declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/tasks", taskRouter);

export { app };
