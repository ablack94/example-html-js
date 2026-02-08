# HTTP Streaming Example

A demo project showing two approaches to streaming data from a server to the browser:
**Server-Sent Events (SSE)** and **WebSocket**. The data stream is a simulated crypto
price ticker (BTC, ETH, SOL, DOGE, XRP) with randomized fluctuations every second.

Two identical backend implementations are provided (Python and Node.js). The client is
vanilla HTML/JS with no frameworks.

## Project Structure

```
http-example/
├── client/
│   ├── index.html          # Landing page linking to both demos
│   ├── sse.html            # SSE streaming client
│   └── ws.html             # WebSocket streaming client
├── server-python/
│   ├── server.py           # Python backend (stdlib + websockets)
│   ├── requirements.txt
│   └── Dockerfile
├── server-node/
│   ├── server.js           # Node.js backend (http + ws)
│   ├── package.json
│   └── Dockerfile
└── README.md
```

## Ports & Endpoints

| Service    | Port | Description                          |
|------------|------|--------------------------------------|
| HTTP       | 8000 | Static files + SSE endpoint          |
| WebSocket  | 8001 | WebSocket price stream               |

- **SSE endpoint:** `GET /sse/prices`
- **WebSocket:** `ws://localhost:8001`
- **Landing page:** `http://localhost:8000`

## Running with Docker

Pick either the Python or Node.js backend. Both expose the same API.

Each Dockerfile is self-contained to its own directory. Because the `client/`
files live in a sibling directory, copy them into the server directory before
building.

### Python backend

```bash
cp -r client/ server-python/client/
docker build -t http-example-python server-python/
rm -rf server-python/client/
docker run --rm -p 8000:8000 -p 8001:8001 http-example-python
```

### Node.js backend

```bash
cp -r client/ server-node/client/
docker build -t http-example-node server-node/
rm -rf server-node/client/
docker run --rm -p 8000:8000 -p 8001:8001 http-example-node
```

Open http://localhost:8000 in your browser.

## Running with Podman

Podman is command-compatible with Docker. The same commands work by replacing
`docker` with `podman`.

### Python backend

```bash
cp -r client/ server-python/client/
podman build -t http-example-python server-python/
rm -rf server-python/client/
podman run --rm -p 8000:8000 -p 8001:8001 http-example-python
```

### Node.js backend

```bash
cp -r client/ server-node/client/
podman build -t http-example-node server-node/
rm -rf server-node/client/
podman run --rm -p 8000:8000 -p 8001:8001 http-example-node
```

Open http://localhost:8000 in your browser.

## Running Locally (no containers)

### Python

```bash
cd server-python
pip install -r requirements.txt
python server.py
```

### Node.js

```bash
cd server-node
npm install
node server.js
```

Open http://localhost:8000 in your browser.
