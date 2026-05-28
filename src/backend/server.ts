import fs from "fs";
import http from "http";
import https from "https";
import { WebSocketServer } from "ws";
import { createApp } from "./app";
import { initChatSocket } from "../chatSocket";

const PORT = Number(process.env.PORT ?? 4443);
const HOST = process.env.HOST ?? "0.0.0.0";
const { app, fakeDataGenerator } = createApp();
const useHttps = process.env.USE_HTTPS !== "false" && fs.existsSync("certs/key.pem") && fs.existsSync("certs/cert.pem");

const server = useHttps
  ? https.createServer(
      {
        key: fs.readFileSync("certs/key.pem"),
        cert: fs.readFileSync("certs/cert.pem"),
      },
      app,
    )
  : http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Socket.IO chat alongside the existing WebSocket server
try {
  initChatSocket(server);
} catch (err) {
  console.error("Failed to initialize chat socket:", err);
}

// Handle WebSocket connections for real-time fake data updates
wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");
  fakeDataGenerator.subscribe(ws);

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("Client disconnected from WebSocket");
  });
});

server.listen(PORT, HOST, () => {
  const protocol = useHttps ? "https" : "http";
  const websocketProtocol = useHttps ? "wss" : "ws";

  console.log(`ArtSpace backend API running on ${protocol}://${HOST}:${PORT}`);
  console.log(`WebSocket server available at ${websocketProtocol}://${HOST}:${PORT}`);
});
