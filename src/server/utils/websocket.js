const ws = require('ws');
const logger = require('./logger');

let wss = null;

function initWebSocket(server) {
  wss = new ws.WebSocketServer({ server });
  logger.info(logger.categories.STARTUP, 'WebSocket Server initialized');

  wss.on('connection', (socket, req) => {
    socket.isAlive = true;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    logger.info(logger.categories.API, `New WebSocket connection from ${clientIp}`);

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (message) => {
      try {
        const payload = JSON.parse(message);
        if (payload.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        logger.debug(logger.categories.API, 'Failed to parse incoming WS message', err);
      }
    });

    socket.on('close', () => {
      logger.info(logger.categories.API, `WebSocket connection closed from ${clientIp}`);
    });

    socket.on('error', (err) => {
      logger.error(logger.categories.API, `WebSocket client error: ${err.message}`, err);
    });
  });

  // Heartbeat interval to clear stale connections
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        logger.info(logger.categories.API, 'Terminating inactive WebSocket client connection');
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

function broadcast(event, data = {}) {
  if (!wss) {
    logger.warn(logger.categories.API, 'WebSocket server not initialized; broadcast skipped');
    return;
  }
  const payload = JSON.stringify({ event, data });
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === ws.OPEN) {
      client.send(payload);
      count++;
    }
  });
  logger.debug(logger.categories.API, `Broadcasted event '${event}' to ${count} clients`);
}

module.exports = {
  initWebSocket,
  broadcast
};
