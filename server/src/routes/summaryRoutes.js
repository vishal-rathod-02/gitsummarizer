import express from "express";
import { optionalAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/security.js";
import {
  generateSummary,
  listSummaryHistory,
  getSummaryById,
  deleteSummaryById
} from "../controllers/summaryController.js";

const router = express.Router();

// Stricter rate limit on summary generation to protect upstream GitHub and AI quotas
const generationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30
});

router.post("/", generationRateLimiter, optionalAuth, generateSummary);
router.get("/", optionalAuth, listSummaryHistory);
router.get("/:id", optionalAuth, getSummaryById);
router.delete("/:id", optionalAuth, deleteSummaryById);

export default router;
