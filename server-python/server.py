#!/usr/bin/env python3
"""Crypto price ticker server with SSE and WebSocket endpoints."""

import asyncio
import json
import os
import random
import threading
import time
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler

import websockets

# ---------------------------------------------------------------------------
# Shared price generation
# ---------------------------------------------------------------------------

BASE_PRICES = {
    "BTC": 67000.00,
    "ETH": 3500.00,
    "SOL": 150.00,
    "DOGE": 0.15,
    "XRP": 0.55,
}

# Current prices (mutated over time)
prices = dict(BASE_PRICES)


def generate_tick():
    """Apply a small random fluctuation to each price and return the update."""
    results = []
    for symbol, base in BASE_PRICES.items():
        # Random walk: up to ±0.5 % per tick
        pct_change = random.uniform(-0.5, 0.5)
        prices[symbol] *= 1 + pct_change / 100
        results.append(
            {
                "symbol": symbol,
                "price": round(prices[symbol], 6 if prices[symbol] < 1 else 2),
                "change": round(
                    (prices[symbol] - base) / base * 100, 2
                ),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    return results


# ---------------------------------------------------------------------------
# Resolve the client directory
# ---------------------------------------------------------------------------

def client_dir():
    """Return the absolute path to the client/ directory."""
    # In Docker the layout is /app/client; locally it's ../client
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "..", "client"),
        os.path.join(here, "client"),       # Docker layout
    ]
    for c in candidates:
        if os.path.isdir(c):
            return os.path.realpath(c)
    return os.path.realpath(candidates[0])


CLIENT_DIR = client_dir()

# ---------------------------------------------------------------------------
# HTTP server (SSE + static files)   — port 8000
# ---------------------------------------------------------------------------


class Handler(SimpleHTTPRequestHandler):
    """Serves static files from the client dir and streams SSE on /sse/prices."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CLIENT_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/sse/prices":
            self._handle_sse()
        else:
            super().do_GET()

    def _handle_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            while True:
                data = json.dumps(generate_tick())
                self.wfile.write(f"data: {data}\n\n".encode())
                self.wfile.flush()
                time.sleep(1)
        except BrokenPipeError:
            pass

    # Silence per-request log lines (optional — remove to see them)
    def log_message(self, format, *args):
        pass


def run_http(port=8000):
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"HTTP/SSE server listening on http://0.0.0.0:{port}")
    server.serve_forever()


# ---------------------------------------------------------------------------
# WebSocket server — port 8001
# ---------------------------------------------------------------------------


async def ws_handler(websocket):
    """Push price ticks to a connected WebSocket client."""
    try:
        while True:
            data = json.dumps(generate_tick())
            await websocket.send(data)
            await asyncio.sleep(1)
    except websockets.ConnectionClosed:
        pass


async def run_ws(port=8001):
    async with websockets.serve(ws_handler, "0.0.0.0", port):
        print(f"WebSocket server listening on ws://0.0.0.0:{port}")
        await asyncio.Future()  # run forever


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Serving client files from {CLIENT_DIR}")

    # Start HTTP server in a background thread
    http_thread = threading.Thread(target=run_http, daemon=True)
    http_thread.start()

    # Run WebSocket server in the main asyncio loop
    asyncio.run(run_ws())
