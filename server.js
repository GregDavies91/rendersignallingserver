const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

const sessions = {};

// Endpoint to host a session
app.post('/session/host', (req, res) => {
  const code = uuidv4().slice(0, 6).toUpperCase();
  sessions[code] = { clients: [] };
  const ws_url = `wss://${req.headers.host}/ws/${code}`;
  res.json({ success: true, code, ws_url });
});

// Endpoint to join a session
app.post('/session/join/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  if (sessions[code]) {
    const ws_url = `wss://${req.headers.host}/ws/${code}`;
    res.json({ success: true, ws_url });
  } else {
    res.json({ success: false, error: "Session not found" });
  }
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  // Extract the session code from URL: /ws/{code}
  const urlParts = req.url.split('/');
  const code = urlParts[urlParts.length - 1].toUpperCase();

  if (!sessions[code]) {
    ws.close();
    return;
  }

  sessions[code].clients.push(ws);

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      console.error('Invalid JSON received');
      return;
    }

    // Broadcast the received message to all other clients in the session
    sessions[code].clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        // If player just joined, send "player_joined" to others
        if (data.type === 'join') {
          client.send(JSON.stringify({
            type: 'player_joined',
            id: data.id,
            name: data.name
          }));
        }
        // For all messages, relay as-is
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    sessions[code].clients = sessions[code].clients.filter(c => c !== ws);
    if (sessions[code].clients.length === 0) {
      delete sessions[code];
      console.log(`Session ${code} closed (no clients left)`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
