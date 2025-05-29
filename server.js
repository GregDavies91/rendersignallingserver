const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const http = require('http').createServer(app);
const wss = new WebSocket.Server({ server: http });

app.use(express.json());

const sessions = {};

app.post('/session/host', (req, res) => {
  const code = uuidv4().slice(0, 6).toUpperCase();
  const ws_url = `wss://${req.headers.host}/ws/${code}`;
  sessions[code] = { clients: [] };
  res.json({ success: true, code, ws_url });
});

app.post('/session/join/:code', (req, res) => {
  const code = req.params.code;
  if (sessions[code]) {
    const ws_url = `wss://${req.headers.host}/ws/${code}`;
    res.json({ success: true, ws_url });
  } else {
    res.json({ success: false, code: 'Session not found' });
  }
});

wss.on('connection', (ws, req) => {
  const urlParts = req.url.split('/');
  const code = urlParts[urlParts.length - 1];
  if (sessions[code]) {
    sessions[code].clients.push(ws);

    ws.on('message', (message) => {
      sessions[code].clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });

    ws.on('close', () => {
      sessions[code].clients = sessions[code].clients.filter(client => client !== ws);
      if (sessions[code].clients.length === 0) {
        delete sessions[code];
      }
    });
  } else {
    ws.close();
  }
});

http.listen(process.env.PORT || 3000, () => {
  console.log('Signaling server is running...');
});