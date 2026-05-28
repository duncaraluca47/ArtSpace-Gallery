import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { getAccessToken } from "../app/services/authToken";

type ChatMessage = {
  _id?: string;
  messageId: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string | Date;
};

export function useChat(roomId = "general") {
  const { user, isReady, tokenVersion } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isReady || !user) {
      setConnected(false);
      setMessages([]);
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL?.trim().replace(/\/$/, "") ?? "";
    const url = backendUrl || window.location.origin;
    const token = getAccessToken();

    if (!token) {
      setConnected(false);
      setMessages([]);
      return;
    }

    const socket = io(url, {
      withCredentials: true,
      autoConnect: true,
      auth: {
        token,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_room", roomId);
      socket.emit("get_history", roomId);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("chat_history", (history: ChatMessage[]) => {
      setMessages(history || []);
    });

    socket.on("new_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("error", (err: any) => {
      // optionally handle errors
      console.error("Chat socket error:", err);
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
    };
  }, [isReady, roomId, tokenVersion, user]);

  const sendMessage = (content: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("send_message", { roomId, content });
  };

  return { messages, sendMessage, connected };
}

export default useChat;
