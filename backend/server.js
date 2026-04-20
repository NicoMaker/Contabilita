const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { initDB, getLocalIP, getPublicIP } = require('./modules/database'); // Importata getPublicIP
const setupSocketHandlers = require('./modules/socketHandlers');
const downloadDbRouter = require('./modules/downloadDb');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
});

app.set("io", io);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

app.use('/api', downloadDbRouter);

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    socketConnections: io.engine.clientsCount,
  });
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

// Logica di avvio con recupero IP
initDB().then(async () => {
  const localIP = getLocalIP();
  const publicIP = await getPublicIP();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server avviato con successo!`);
    console.log(`🌐 IP Pubblico: http://${publicIP}:${PORT}`);
    console.log(`🏠 IP Locale:   http://${localIP}:${PORT}`);
    console.log(`📍 Localhost:  http://localhost:${PORT}`);
    console.log(`\n--------------------------------------`);
  });
});