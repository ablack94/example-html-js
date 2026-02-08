# Plan: HTTP Streaming Example (SSE + WebSocket)

## Context
Build a toy example demonstrating two approaches to streaming data from a server to a browser: Server-Sent Events (SSE) over HTTP and WebSocket. The data stream is a simulated crypto price ticker. Backends are provided in both Python and Node.js, and the client is vanilla HTML+JS with no frameworks. Each backend is containerized with a Dockerfile.

## Project Structure
```
http-example/
├── client/
│   ├── index.html          # Landing page linking to both examples
│   ├── sse.html            # SSE streaming client
│   └── ws.html             # WebSocket streaming client
├── server-python/
│   ├── server.py           # Python backend (stdlib + websockets)
│   ├── requirements.txt    # Single dependency: websockets
│   └── Dockerfile
├── server-node/
│   ├── server.js           # Node.js backend (http + ws)
│   ├── package.json        # Single dependency: ws
│   └── Dockerfile
└── plan.md                 # Living plan document
```

## Shared Conventions (both backends)
- **HTTP port:** 8000 (serves static files from `../client/` + SSE endpoint)
- **WebSocket port:** 8001
- **SSE endpoint:** `GET /sse/prices`
- **WebSocket path:** `ws://localhost:8001`
- **Data format:** JSON — `{"symbol": "BTC", "price": 45123.45, "change": 1.23, "timestamp": "..."}`
- **Ticker symbols:** BTC, ETH, SOL, DOGE, XRP
- **Update interval:** ~1 second with randomized price fluctuations

## Status
- [x] Project structure created
- [x] Python backend
- [x] Node.js backend
- [x] SSE client
- [x] WebSocket client
- [x] Landing page
- [x] Dockerfiles
- [x] Testing — both images built and verified via podman

## How to Run

### Docker (recommended)
```bash
# Python backend
docker build -t http-example-python -f server-python/Dockerfile .
docker run -p 8000:8000 -p 8001:8001 http-example-python

# Node.js backend
docker build -t http-example-node -f server-node/Dockerfile .
docker run -p 8000:8000 -p 8001:8001 http-example-node
```

### Local (no Docker)
```bash
# Python
cd server-python && pip install -r requirements.txt && python server.py

# Node.js
cd server-node && npm install && node server.js
```

Then open http://localhost:8000/ in a browser.
