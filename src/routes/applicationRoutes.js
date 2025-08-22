import express from "express";
import { automateApplication, getApplicationStatus } from "../controllers/applicationController.js";

const router = express.Router();

// Start application automation
router.post("/automate", automateApplication);

// Get application status
router.get("/status/:applicationId", getApplicationStatus);

export default router;
