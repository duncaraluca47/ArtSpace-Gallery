import mongoose from "../mongoClient";
import { v4 as uuidv4 } from "uuid";

const { Schema, model } = mongoose;

const ChatMessageSchema = new Schema(
  {
    messageId: { type: String, default: () => uuidv4(), index: true },
    roomId: { type: String, default: "general", required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date(), required: true },
  },
  { timestamps: false },
);

ChatMessageSchema.index({ roomId: 1, createdAt: 1 });

export type ChatMessageDocument = mongoose.Document & {
  messageId: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: Date;
};

export const ChatMessage = model<ChatMessageDocument>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
