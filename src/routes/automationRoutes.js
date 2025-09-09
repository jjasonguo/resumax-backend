import express from "express";
import { inspectFirstTextbox } from "../controllers/automationController.js";

const router = express.Router();

router.post("/inspect", inspectFirstTextbox);

export default router;


