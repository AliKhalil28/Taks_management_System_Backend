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
  // Extract query parameters
  const {
    page = 1,
    limit = 10,
    query,
    sortByPriority,
    sortByStatus,
    sortByDueDate,
  } = req.query;

  // Validate pagination parameters
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);

  if (isNaN(pageNumber) || pageNumber < 1) {
    throw new ApiError(400, "Invalid page number.");
  }
  if (isNaN(limitNumber) || limitNumber < 1) {
    throw new ApiError(400, "Invalid limit number.");
  }

  // Ensure user authenticated
  if (!req.user) {
    throw new ApiError(401, "User not authenticated.");
  }

  // Build match query
  const matchQuery = { userId: req.user._id };
  if (query) {
    matchQuery.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  // Build Aggregation pipeline
  const pipeline = [{ $match: matchQuery }];

  // Build the sort criteria for priority, status, and dueDate
  const addFields = {};

  // Sort by prirority
  if (sortByPriority) {
    const priorityOrder =
      sortByPriority.toLowerCase() === "desc"
        ? {
            High: 3,
            Medium: 2,
            Low: 1,
          }
        : { High: 1, Medium: 2, Low: 3 };
    addFields.prioritySort = {
      $cond: [
        {
          $eq: ["$priority", "High"],
        },
        priorityOrder.High,
        {
          $cond: [
            { $eq: ["$priority", "Medium"] },
            priorityOrder.Medium,
            priorityOrder.Low,
          ],
        },
      ],
    };
  }

  // Sort by Status
  if (sortByStatus) {
    const statusOrder =
      sortByStatus.toLowerCase() === "desc"
        ? { pending: 3, "in-progress": 2, completed: 1 }
        : { pending: 1, "in-progress": 2, completed: 3 };
    addFields.statusSort = {
      $cond: [
        { $eq: ["$status", "pending"] },
        statusOrder.pending,
        {
          $cond: [
            { $eq: ["$status", "in-progress"] },
            statusOrder["in-progress"],
            statusOrder.completed,
          ],
        },
      ],
    };
  }

  // Add the computed fields to the pipeline
  if (Object.keys(addFields).length > 0) {
    pipeline.push({ $addFields: addFields });
  }

  // Build Sort Criteria
  const sortCriteria = {};

  if (sortByPriority) {
    sortCriteria.prioritySort =
      sortByPriority.toLowerCase() === "desc" ? -1 : 1;
  }

  if (sortByStatus) {
    sortCriteria.statusSort = sortByStatus.toLowerCase() === "desc" ? -1 : 1;
  }

  // Sort by dueDate
  if (sortByDueDate) {
    sortCriteria.dueDate = sortByDueDate.toLowerCase() === "desc" ? -1 : 1;
  }

  // Default sort by createdAy if no sorting specified
  if (!sortByPriority && !sortByStatus && !sortByDueDate) {
    sortCriteria.createdAt = -1;
  }

  // Add sort staage to pipiline
  if (Object.keys(sortCriteria).length > 0) {
    pipeline.push({ $sort: sortCriteria });
  }

  const options = {
    page: pageNumber,
    limit: limitNumber,
    customLabels: {
      totalDocs: "totalTasks",
      docs: "tasks",
      totalPages: "totalPages",
      page: "currentPage",
      nextPage: "nextPage",
      prevPage: "prevPage",
      hasNextPage: "hasNextPage",
      hasPrevPage: "hasPrevPage",
    },
  };

  // Execute the aggregation with pagination
  const result = await Task.aggregatePaginate(
    Task.aggregate(pipeline),
    options
  );
  if (!result) {
    throw new ApiError(500, "Failed to retrieve tasks.");
  }

  // Send Response
  res
    .status(200)
    .json(new ApiResponse(200, result, "Tasks retrieved successfully."));
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
