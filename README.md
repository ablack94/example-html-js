# example-html-js

A tiny demo that streams fake crypto prices to a vanilla HTML + JS client.
It includes two streaming interfaces:

- **REST stream** via Server-Sent Events (SSE) at `/rest/ticker`.
- **WebSocket stream** at `/ws`.

The same client works with either server implementation.

## Run the Python server

```bash
python3 server/python_server.py
```

Then open: <http://localhost:8000>

## Run the Node.js server

```bash
node server/node_server.js
```

Then open: <http://localhost:8000>

## Endpoints

- `GET /rest/ticker` — SSE stream of ticker updates
- `GET /ws` — WebSocket stream of ticker updates
- `GET /` — static client files (HTML, JS, CSS)

## Notes

- Both servers use only the standard library.
- The WebSocket implementation is minimal (text frames only).
