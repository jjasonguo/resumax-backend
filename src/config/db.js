import mongoose from "mongoose"

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("mongo connected successfully");
    } catch (error){
        console.error("error connecting", error)
        process.exit(1)
    }
}
