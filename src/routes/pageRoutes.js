import express from "express";
import { fetchPageTitle } from "../controllers/pageController.js";

const router = express.Router();

router.post("/title", fetchPageTitle);

export default router;


