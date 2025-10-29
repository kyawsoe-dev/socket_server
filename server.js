const http = require("http");
const socketIo = require("socket.io");
const app = require("./src/app");
const { setupChatSocket } = require("./src/sockets/chat.socket");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"], allowedHeaders: "*" },
});

// Initialize chat sockets
setupChatSocket(io);

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
