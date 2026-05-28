import type { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { Socket } from "socket.io";
import { ChatMessage } from "./models/ChatMessage";
import mongoose, { connectMongo } from "./mongoClient";
import { verifyAccessToken } from "./utils/jwt";

function parseCorsOrigins(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : undefined;
}

export function initChatSocket(server: HttpServer) {
  // ensure MongoDB is connected
  connectMongo().catch(() => {
    console.error("ChatSocket: could not connect to MongoDB");
  });

  const corsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN) ?? (process.env.NODE_ENV === "production" ? false : true);

  const io = new IOServer(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      next(new Error("unauthorized"));
      return;
    }

    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch (err) {
      console.error("Socket auth error", err);
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const currentUser = socket.data.user;

    const userId = currentUser.id;
    const username = currentUser.username;

    console.log(`Socket connected: user=${username}`);

    socket.on("join_room", (roomId: string) => {
      const room = roomId || "general";
      socket.join(room);
    });

    socket.on("send_message", async (payload: { roomId?: string; content: string }) => {
      const room = payload.roomId || "general";
      const content = payload.content ?? "";

      try {
        const saved = await ChatMessage.create({
          roomId: room,
          userId,
          username,
          content,
        });

        io.to(room).emit("new_message", saved);
      } catch (err) {
        console.error("Failed to save chat message", err);
        socket.emit("error", "failed_to_save");
      }
    });

    socket.on("get_history", async (roomId: string) => {
      const room = roomId || "general";
      try {
        const history = await ChatMessage.find({ roomId: room })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
          .exec();

        // send in chronological order
        socket.emit("chat_history", history.reverse());
      } catch (err) {
        console.error("Failed to fetch chat history", err);
        socket.emit("error", "failed_to_fetch_history");
      }
    });

    socket.on("disconnect", () => {
      // nothing special for now
    });
  });

  return io;
}

export default initChatSocket;
