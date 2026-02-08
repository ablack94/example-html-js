#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

// ---------------------------------------------------------------------------
// Shared price generation
// ---------------------------------------------------------------------------

const BASE_PRICES = {
  BTC: 67000.0,
  ETH: 3500.0,
  SOL: 150.0,
  DOGE: 0.15,
  XRP: 0.55,
};

const prices = { ...BASE_PRICES };

function generateTick() {
  return Object.keys(BASE_PRICES).map((symbol) => {
    // Random walk: up to ±0.5 % per tick
    const pctChange = (Math.random() - 0.5) * 1.0; // -0.5 to +0.5
    prices[symbol] *= 1 + pctChange / 100;
    const base = BASE_PRICES[symbol];
    return {
      symbol,
      price:
        prices[symbol] < 1
          ? parseFloat(prices[symbol].toFixed(6))
          : parseFloat(prices[symbol].toFixed(2)),
      change: parseFloat((((prices[symbol] - base) / base) * 100).toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// ---------------------------------------------------------------------------
// HTTP server (SSE + static files)   — port 8000
// ---------------------------------------------------------------------------

const httpServer = http.createServer((req, res) => {
  if (req.url === "/sse/prices") {
    handleSSE(req, res);
    return;
  }

  // Serve static files from CLIENT_DIR
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(CLIENT_DIR, filePath);

  // Prevent directory traversal
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

function handleSSE(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    Connection: "keep-alive",
  });

  const interval = setInterval(() => {
    const data = JSON.stringify(generateTick());
    res.write(`data: ${data}\n\n`);
  }, 1000);

  req.on("close", () => clearInterval(interval));
}

const HTTP_PORT = 8000;
httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`HTTP/SSE server listening on http://0.0.0.0:${HTTP_PORT}`);
});

// ---------------------------------------------------------------------------
// WebSocket server — port 8001
// ---------------------------------------------------------------------------

const WS_PORT = 8001;
const wss = new WebSocketServer({ port: WS_PORT, host: "0.0.0.0" });

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://0.0.0.0:${WS_PORT}`);
});

wss.on("connection", (ws) => {
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(generateTick()));
    }
  }, 1000);

  ws.on("close", () => clearInterval(interval));
});
