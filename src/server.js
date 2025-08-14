import express from "express"
import testRoutes from "./routes/testRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import resumeRoutes from "./routes/resumeRoutes.js"
import {connectDB} from "./config/db.js"
import dotenv from "dotenv"
import cors from "cors"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

console.log(process.env.MONGO_URI);

// Routes
app.use("/api/test", testRoutes)
app.use("/api/users", userRoutes)
app.use("/api/resume", resumeRoutes)

app.listen(PORT, () => {
    console.log("server started port:", PORT);
});