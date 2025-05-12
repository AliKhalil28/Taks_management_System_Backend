import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserDetails,
  getAllUsers,
  updateUserProfile,
  changeUserPassword,
  refreshAccessToken,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.route("/register").post(registerUser);
router.route("/login").get(loginUser);

//Secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeUserPassword);
router.route("/profile").get(verifyJWT, getUserDetails);
router.route("/update-profile").patch(verifyJWT, updateUserProfile);
router.route("/").get(verifyJWT, getAllUsers);

export default router;
