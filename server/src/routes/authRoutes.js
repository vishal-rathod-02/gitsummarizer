import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/security.js";
import {
  register,
  login,
  logout,
  me
} from "../controllers/authController.js";

const router = express.Router();

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 25
});

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
