import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
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

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

// Login user
const loginUser = asyncHandler(async (req, res) => {
  // Get user detail from requst body
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Please provide email and password");
  }

  // Validate user details
  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // Check if user exists
  const user = await User.findOne({ email });

  // Check if user exists
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
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
    secure: true,
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
  // Get fresh token from cookies
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // Check if refresh token is present
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Please login to access this resource");
  }

  try {
    // Verify refresh token
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Check if user exists
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    // Check if refresh token is valid
    if (user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    // Generate new access and refresh token
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user?._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            newRefreshToken,
          },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, `Invalid refresh token ${error?.message}`);
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
        username: username.trim().toLowerCase(),
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
