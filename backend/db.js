import mongoose from "mongoose";

 
const connectDb = async () => {
    if (!process.env.MONGO_URI) {
        console.error("❌ MONGO_URI is missing from .env file");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(" Connected to MongoDB");
    } catch (error) {
        console.error(" Initial connection error:", error.message);
        process.exit(1); // Force exit so you don't run a broken server
    }

}

mongoose.connection.on('error', err => console.error("⚠️ Runtime DB Error:", err));
mongoose.connection.on('disconnected', () => console.log("⚠️ DB Disconnected"));


export default connectDb; 

 