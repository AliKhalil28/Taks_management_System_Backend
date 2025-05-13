import { Router } from "express";
import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTaskById,
  deleteTaskById,
  updateTaskStatus,
} from "../controllers/task.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);

router.route("/").post(createTask).get(getAllTasks);
router
  .route("/:id")
  .get(getTaskById)
  .patch(updateTaskById)
  .delete(deleteTaskById);
router.route("/status/:id").patch(updateTaskStatus);

export default router;
