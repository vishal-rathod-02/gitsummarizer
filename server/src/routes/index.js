import express from "express";
import healthRoutes from "./healthRoutes.js";
import summaryRoutes from "./summaryRoutes.js";
import authRoutes from "./authRoutes.js";

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/summaries", summaryRoutes);
router.use("/auth", authRoutes);

export default router;
