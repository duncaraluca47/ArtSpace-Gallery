import mongoose from "mongoose";

const mongoUrl = process.env.MONGODB_URL ?? "";

if (!mongoUrl) {
  console.warn("MONGODB_URL is not set. MongoDB will not connect.");
}

export const connectMongo = async () => {
  try {
    await mongoose.connect(mongoUrl, {
      // recommended options can be left default for mongoose v6+
    } as any);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    throw err;
  }
};

export default mongoose;
