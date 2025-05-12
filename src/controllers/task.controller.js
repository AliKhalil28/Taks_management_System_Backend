import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Task } from "../models/task.model.js";
import { User } from "../models/user.model.js";

// Create a new task
const createTask = asyncHandler(async (req, res) => {
  //Extract task details from request body
  const { title, description, status, dueDate, priority } = req.body;

  // Validate required fields
  if (!title || !dueDate || !priority) {
    throw new ApiError(400, "Title, due date, and priority are required.");
  }

  // Validate optional fields
  if (status && !["pending", "in-progress", "completed"].includes(status)) {
    throw new ApiError(400, "Invalid status value.");
  }

  if (priority && !["High", "Medium", "Low"].includes(priority)) {
    throw new ApiError(400, "Invalid priority value.");
  }

  // Ensure user athenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated.");
  }

  // Create the task document
  const task = await Task.create({
    title,
    description,
    status: status || "pending",
    dueDate,
    priority,
    userId: req.user._id,
  });

  // validate task creation
  if (!task) {
    throw new ApiError(500, "Failed to create task.");
  }

  // Send response
  res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully."));
});

// Get all tasks
const getAllTasks = asyncHandler(async (req, res) => {
  // Ensure user authenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated.");
  }

  // Get all tasks for the authenticated user
  const tasks = await Task.find({ userId: req.user._id });
  if (!tasks || tasks.length === 0) {
    throw new ApiError(404, "No tasks found.");
  }

  // Send response
  res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks retrieved successfully."));
});

// Get a task by ID
const getTaskById = asyncHandler(async (req, res) => {
  // Ensure user authenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated.");
  }

  // validate task ID
  const taskId = req.params.id;
  if (!taskId) {
    throw new ApiError(400, "Task ID is required.");
  }

  // Find the task by ID
  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  // Send Response
  res
    .status(200)
    .json(new ApiResponse(200, task, "Task retrieved successfully."));
});

// Update a task by ID
const updateTaskById = asyncHandler(async (req, res) => {
  // Ensure user authenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated.");
  }

  // Validate task ID
  const taskId = req.params.id;
  if (!taskId) {
    throw new ApiError(400, "Task ID is required.");
  }

  // Validate task details
  const { title, description, status, dueDate, priority } = req.body;

  if (!title && !dueDate && !priority) {
    throw new ApiError(400, "At least one field is required to update.");
  }

  // Validate optional fields
  if (status && !["pending", "in-progress", "completed"].includes(status)) {
    throw new ApiError(400, "Invalid status value.");
  }

  if (priority && !["High", "Medium", "Low"].includes(priority)) {
    throw new ApiError(400, "Invalid priority value.");
  }

  // Find and update the task
  const task = await Task.findByIdAndUpdate(
    taskId,
    {
      title,
      description,
      status: status || "pending",
      dueDate,
      priority,
    },
    { new: true }
  );

  // Validate task update
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  // Send response
  res
    .status(200)
    .json(new ApiResponse(200, task, "Task updated successfully."));
});

// Delete a task by ID
const deleteTaskById = asyncHandler(async (req, res) => {
  // Ensure user authenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated.");
  }

  // Validate task ID
  const taskId = req.params.id;
  if (!taskId) {
    throw new ApiError(400, "Task ID is required.");
  }

  // Find and delete the task
  const task = await Task.findByIdAndDelete(taskId);

  // Send response
  res.status(200).json(new ApiResponse(200, {}, "Task deleted successfully."));
});

export { createTask, getAllTasks, getTaskById, updateTaskById, deleteTaskById };
