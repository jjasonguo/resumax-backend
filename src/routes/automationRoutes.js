import express from "express";
import { inspectFirstTextbox, fillNameInFirstTextbox } from "../controllers/automationController.js";

const router = express.Router();

router.post("/inspect", inspectFirstTextbox);
router.post("/fill-name", fillNameInFirstTextbox);

export default router;


