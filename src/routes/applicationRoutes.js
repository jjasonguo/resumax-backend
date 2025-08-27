import express from "express";
import { automateApplication, getApplicationStatus, getQueueStatus, emergencyStop } from "../controllers/applicationController.js";

const router = express.Router();

// Start application automation
router.post("/automate", automateApplication);

// Get application status
router.get("/status/:applicationId", getApplicationStatus);

// Get queue status (for monitoring rate limits)
router.get("/queue-status", getQueueStatus);

// Emergency stop (for admin use - halts all API requests)
router.post("/emergency-stop", emergencyStop);

export default router;

