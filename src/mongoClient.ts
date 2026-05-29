import mongoose from "mongoose";

const mongoUrl = process.env.MONGODB_URL ?? "";

if (!mongoUrl) {
  console.warn("MONGODB_URL is not set. MongoDB connection will be skipped.");
}

export const connectMongo = async () => {
  if (!mongoUrl) {
    // Nothing to do when no Mongo URL is configured (optional feature)
    return;
  }

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
