import express from "express"
import {getAllTest, createTest, updateTest,deleteTest} from "../controllers/testController.js"

const router = express.Router();

router.get("/", getAllTest);
router.post("/", createTest);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

export default router; 


