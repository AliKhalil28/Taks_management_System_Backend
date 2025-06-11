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

  res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully."));
});

// Get all tasks
const getAllTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      search,
      sortBy = "dueDate",
      sortOrder = "asc",
    } = req.query;

    // Build query object - START WITH USER FILTER
    const query = { userId: req.user._id };

    // Add status filter - THIS IS MISSING IN YOUR BACKEND
    if (status && status !== "all") {
      query.status = status;
    }

    // Add priority filter - THIS IS MISSING IN YOUR BACKEND
    if (priority && priority !== "all") {
      query.priority = priority;
    }

    // Add search filter - THIS IS MISSING IN YOUR BACKEND
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const tasks = await Task.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalTasks = await Task.countDocuments(query);
    const totalPages = Math.ceil(totalTasks / limit);

    res.json({
      statusCode: 200,
      success: true,
      message: "Tasks retrieved successfully.",
      data: {
        tasks,
        totalTasks,
        currentPage: parseInt(page),
        totalPages,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: error.message,
    });
  }
};

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

const updateTaskStatus = asyncHandler(async (req, res) => {
  // Get updated status from req body
  const { status } = req.body;
  const userId = req.params.id;

  // Check if user authenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated");
  }

  // find user and update task status
  const task = await Task.findOneAndUpdate(
    {
      userId: req.user._id,
      _id: userId,
    },

    {
      status,
    },
    {
      new: true,
    }
  );

  // Validate task update
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  // Send Response
  res.status(200).json(new ApiResponse(200, task, "Task status updated."));
});

export {
  createTask,
  getAllTasks,
  getTaskById,
  updateTaskById,
  deleteTaskById,
  updateTaskStatus,
};
