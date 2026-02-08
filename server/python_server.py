#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import random
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT_DIR = Path(__file__).resolve().parent.parent
CLIENT_DIR = ROOT_DIR / "client"

TICKERS = {
    "BTC": 43000.0,
    "ETH": 2400.0,
    "SOL": 110.0,
}


def next_tick():
    symbol = random.choice(list(TICKERS.keys()))
    change = random.uniform(-0.8, 1.2)
    TICKERS[symbol] = max(0.0, TICKERS[symbol] + change)
    return {
        "symbol": symbol,
        "price": round(TICKERS[symbol], 2),
        "timestamp": int(time.time() * 1000),
    }


def build_ws_frame(payload: str) -> bytes:
    payload_bytes = payload.encode("utf-8")
    length = len(payload_bytes)
    header = bytearray()
    header.append(0x81)  # FIN + text frame
    if length < 126:
        header.append(length)
    elif length < 65536:
        header.append(126)
        header.extend(length.to_bytes(2, "big"))
    else:
        header.append(127)
        header.extend(length.to_bytes(8, "big"))
    return bytes(header) + payload_bytes


class StreamHandler(BaseHTTPRequestHandler):
    server_version = "TickerHTTP/0.1"

    def do_GET(self):
        if self.path.startswith("/rest/ticker"):
            self.handle_rest_stream()
            return
        if self.path.startswith("/ws") and self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_websocket()
            return
        self.serve_static()

    def log_message(self, format, *args):
        return

    def serve_static(self):
        path = unquote(self.path.split("?", 1)[0])
        if path == "/":
            path = "/index.html"
        file_path = (CLIENT_DIR / path.lstrip("/")).resolve()
        if CLIENT_DIR not in file_path.parents and file_path != CLIENT_DIR:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_type = "text/plain"
        if file_path.suffix == ".html":
            content_type = "text/html"
        elif file_path.suffix == ".css":
            content_type = "text/css"
        elif file_path.suffix == ".js":
            content_type = "application/javascript"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_path.stat().st_size))
        self.end_headers()
        with open(file_path, "rb") as file:
            self.wfile.write(file.read())

    def handle_rest_stream(self):
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            while True:
                payload = json.dumps(next_tick())
                message = f"data: {payload}\n\n"
                self.wfile.write(message.encode("utf-8"))
                self.wfile.flush()
                time.sleep(1)
        except (ConnectionError, BrokenPipeError):
            return

    def handle_websocket(self):
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(HTTPStatus.BAD_REQUEST, "Missing WebSocket key")
            return
        accept = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("utf-8")).digest()
        ).decode("utf-8")
        self.send_response(HTTPStatus.SWITCHING_PROTOCOLS)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()

        socket = self.request
        socket.settimeout(1.0)
        try:
            while True:
                payload = json.dumps(next_tick())
                socket.sendall(build_ws_frame(payload))
                time.sleep(1)
        except (ConnectionError, BrokenPipeError, TimeoutError):
            return


def run():
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), StreamHandler)
    print(f"Python server running on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
