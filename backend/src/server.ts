import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { attachChatSocket } from "./chat/chat.socket.js";

const PORT = process.env.PORT || 4000;
const server = createServer(app);

attachChatSocket(server);

server.listen(PORT, () => {
  console.log(`🚗 DriveNow backend running on port ${PORT}`);
});