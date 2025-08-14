import express from "express";
import { uploadResume, getResumeData, upload } from "../controllers/resumeController.js";

const router = express.Router();

// Upload resume PDF
router.post("/upload", upload.single('resume'), uploadResume);

// Get resume data for a user
router.get("/:clerkUserId", getResumeData);

export default router;
