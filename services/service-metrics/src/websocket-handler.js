const WebSocket = require('ws');

function setupWebSocketServer(wss) {
  wss.on('connection', (ws) => {
    console.log('[WebSocket] new client connected');

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to service-metrics',
      timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('[WebSocket] received message:', message.type);

        // Echo confirmation
        ws.send(JSON.stringify({
          type: 'ack',
          requestType: message.type,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('[WebSocket] message parse error:', err);
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('[WebSocket] client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] error:', err);
    });
  });
}

module.exports = { setupWebSocketServer };
