#!/usr/bin/env node
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');

const tickers = {
  BTC: 43000.0,
  ETH: 2400.0,
  SOL: 110.0,
};

const nextTick = () => {
  const symbols = Object.keys(tickers);
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const change = Math.random() * 2 - 0.8;
  tickers[symbol] = Math.max(0, tickers[symbol] + change);
  return {
    symbol,
    price: Number(tickers[symbol].toFixed(2)),
    timestamp: Date.now(),
  };
};

const buildWsFrame = (payload) => {
  const data = Buffer.from(payload, 'utf8');
  const length = data.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, data]);
};

const serveStatic = (req, res) => {
  const urlPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.normalize(path.join(CLIENT_DIR, urlPath));
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType =
      ext === '.html'
        ? 'text/html'
        : ext === '.css'
          ? 'text/css'
          : ext === '.js'
            ? 'application/javascript'
            : 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/rest/ticker')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const interval = setInterval(() => {
      const payload = JSON.stringify(nextTick());
      res.write(`data: ${payload}\n\n`);
    }, 1000);
    req.on('close', () => {
      clearInterval(interval);
    });
    return;
  }
  serveStatic(req, res);
});

server.on('upgrade', (req, socket) => {
  if (!req.url.startsWith('/ws')) {
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ];
  socket.write(headers.join('\r\n'));

  const interval = setInterval(() => {
    const payload = JSON.stringify(nextTick());
    socket.write(buildWsFrame(payload));
  }, 1000);

  socket.on('close', () => {
    clearInterval(interval);
  });
});

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8000);

server.listen(port, host, () => {
  console.log(`Node server running on http://${host}:${port}`);
});
