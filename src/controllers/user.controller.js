import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Generate access and refresh token
const generateAccessAndRefreshToken = async (userId) => {
  try {
    // fetch user from database
    const user = await User.findOne(userId);

    // Fetch access and refresh token
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // save refresh token to user document
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

// Register a new user
const registerUser = asyncHandler(async (req, res) => {
  //Get user details from request body
  const { email, username, fullName, password } = req.body;

  // Validate user details
  if (
    [email, username, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new ApiError(400, "User with email or username already exists");
  }

  // Create new user
  const user = await User.create({
    email,
    username: username.trim().toLowerCase(),
    fullName,
    password,
  });

  // select user details to return
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Check if user was created successfully
  if (!createdUser) {
    throw new ApiError(500, "User creation failed");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: createdUser,
        token: accessToken, // Add this for mobile
        accessToken: accessToken, // Add this for mobile
        refreshToken: refreshToken, // Add this for mobile
      },
      "User created successfully"
    )
  );
});

// Login user
const loginUser = asyncHandler(async (req, res) => {
  // Get user detail from requst body
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, "Please provide username and password");
  }

  // Validate user details
  if ([username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // Check if user exists
  const user = await User.findOne({ username });

  // Check if user exists
  if (!user) {
    throw new ApiError(401, "Invalid username or password");
  }

  // Check if password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid Credentials");
  }

  //Get acess and refresh token
  const { refreshToken, accessToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // Get LoggedIn User details
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    // secure: true,
    secure: process.env.NODE_ENV === "production", // Only secure in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Allow cross-site cookies in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.NODE_ENV === "production" ? undefined : "localhost",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          token: accessToken, // Add this for mobile
          accessToken: accessToken, // Add this for mobile
          refreshToken: refreshToken, // Add this for mobile
        },
        "User logged In Successfully"
      )
    );
});

// Logout user
const logoutUser = asyncHandler(async (req, res) => {
  // Get user id from request
  const userId = req.user._id;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "User not found");
  }

  // Clear refresh token
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", null, options)
    .cookie("refreshToken", null, options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Refresh Access Token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken ||
    req.body?.refreshToken ||
    req.body?.token ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
      domain: process.env.NODE_ENV === "production" ? undefined : "localhost",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken, token: accessToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Change user password
const changeUserPassword = asyncHandler(async (req, res) => {
  // Get old and new password from request body
  const { oldPassword, newPassword } = req.body;

  // Validate user details
  const user = await User.findById(req.user._id);

  // Check if provided password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid old password");
  }

  // Check if new password is same as old password
  if (oldPassword === newPassword) {
    throw new ApiError(400, "New password cannot be same as old password");
  }

  // Update user password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Get user details
const getUserDetails = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User details fetched successfully"));
});

// Update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
  // Get user details from request body
  const { email, username, fullName } = req.body;
  const userId = req.user._id;

  // Validate user details
  if ([email, username, fullName].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // Update user details
  const user = await User.findOneAndUpdate(
    req.user._id,
    {
      $set: {
        email,
        username,
        fullName,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  // Return response
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User profile updated successfully"));
});

// Get All Users
const getAllUsers = asyncHandler(async (req, res) => {
  // Get all users
  const users = await User.find({}).select("-password -refreshToken");

  // Return response
  return res
    .status(200)
    .json(new ApiResponse(200, users, "Users fetched successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getUserDetails,
  updateUserProfile,
  getAllUsers,
};
