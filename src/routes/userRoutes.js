import express from "express";
import {
  // User CRUD operations
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  deleteUser,
  getAllUsers,
  
  // Clerk-based operations
  getUserByClerkId,
  createUserWithClerk,
  updateUserByClerkId,
  getUserNameByClerkId,
  
  // Project operations
  addProject,
  updateProject,
  deleteProject,
  
  // Work experience operations
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  
  // Search and analytics
  searchUsersBySkills,
  getUsersByCompany
} from "../controllers/userController.js";

const router = express.Router();

// Middleware to parse JSON
router.use(express.json());

// User CRUD Routes
router.post("/", createUser);
router.get("/", getAllUsers);
router.get("/:id", getUser);
router.get("/email/:email", getUserByEmail);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

// Clerk-based Routes
router.post("/clerk", createUserWithClerk);
router.get("/clerk/:clerkUserId", getUserByClerkId);
router.get("/clerk/:clerkUserId/name", getUserNameByClerkId);
router.put("/clerk/:clerkUserId", updateUserByClerkId);

// Project Routes
router.post("/:id/projects", addProject);
router.put("/:id/projects/:projectId", updateProject);
router.delete("/:id/projects/:projectId", deleteProject);

// Work Experience Routes
router.post("/:id/work-experiences", addWorkExperience);
router.put("/:id/work-experiences/:experienceId", updateWorkExperience);
router.delete("/:id/work-experiences/:experienceId", deleteWorkExperience);

// Search and Analytics Routes
router.get("/search/skills", searchUsersBySkills);
router.get("/company/:company", getUsersByCompany);

export default router; 