# How Server-Sent Events (SSE) Work

## The Big Picture

SSE is a mechanism for a server to push data to a browser over a plain HTTP
connection. The browser makes a normal GET request; the server responds but
**never closes the connection**. Instead, it keeps writing new chunks of text as
events happen. The browser exposes these chunks through the `EventSource` API.

It is one-directional: server to client only. For bidirectional communication
you would use WebSocket (see the end of this file for a comparison).

---

## The Wire Protocol

SSE is not a separate protocol — it is just HTTP with specific conventions.

### 1. The Request

The browser sends a normal GET request. Nothing special about it:

```
GET /sse/prices HTTP/1.1
Host: localhost:8000
Accept: text/event-stream
```

### 2. The Response Headers

The server responds with these key headers:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

- **`Content-Type: text/event-stream`** — tells the browser this is an SSE
  stream, not a regular page. This is what makes EventSource treat it as a
  stream of events rather than a single response.
- **`Cache-Control: no-cache`** — prevents proxies/browsers from caching the
  response (since it is a live stream).
- **`Connection: keep-alive`** — asks the TCP connection to stay open.

### 3. The Response Body (the stream)

After the headers, the server writes events as plain text, one at a time, for
as long as the connection lives. Each event looks like this:

```
data: {"symbol":"BTC","price":67012.34,"change":0.02,"timestamp":"..."}\n
\n
```

Key rules:
- Each line of an event starts with a **field name** followed by a colon:
  `data:`, `event:`, `id:`, or `retry:`.
- `data:` is the most common — it carries the payload.
- An event is terminated by a **blank line** (`\n\n`). This is how the browser
  knows one event ends and the next begins.
- Everything is UTF-8 text. There is no binary framing.

The server writes one of these text chunks every second (in this project) and
flushes the socket. The TCP connection stays open between writes.

### What it looks like on the wire over time:

```
[second 0]  data: [{"symbol":"BTC","price":67012.34,...}, ...]\n\n
[second 1]  data: [{"symbol":"BTC","price":67045.12,...}, ...]\n\n
[second 2]  data: [{"symbol":"BTC","price":66998.77,...}, ...]\n\n
...
```

Just text, streaming over a single HTTP response that never completes.

---

## The JavaScript Side (EventSource API)

From `client/sse.html`:

```js
const source = new EventSource("http://localhost:8000/sse/prices");

source.onopen = () => { /* connection established */ };
source.onerror = () => { /* connection lost */ };
source.onmessage = (event) => {
    const ticks = JSON.parse(event.data);
    // update the DOM with new prices
};
```

### What `new EventSource(url)` does

1. Opens an HTTP GET request to the given URL.
2. Expects the response to have `Content-Type: text/event-stream`.
3. Keeps the connection open and **parses the streaming response** according to
   the SSE text format described above.
4. Every time it sees a complete event (terminated by `\n\n`), it fires a
   `message` event on the EventSource object.

### The three callbacks

| Callback      | When it fires                                        |
|---------------|------------------------------------------------------|
| `onopen`      | The HTTP connection is established and headers received |
| `onmessage`   | A complete `data:` event arrives (delimited by `\n\n`) |
| `onerror`     | The connection drops, network error, or non-200 response |

### `event.data`

Inside `onmessage`, `event.data` is a **string** containing everything after
`data: ` up to the blank line. In this project that is a JSON array, so we
`JSON.parse()` it.

### Automatic reconnection

A major feature of EventSource: **if the connection drops, it automatically
reconnects** after a few seconds. You do not need to write retry logic. The
`onerror` handler fires, and then EventSource tries again on its own. This is
why the SSE client code is simpler than the WebSocket client (which has to
implement reconnect manually).

---

## The Backend Side

Both servers do the same thing. Here is how each implements it.

### Python (`server-python/server.py`)

```python
def _handle_sse(self):
    # 1. Send the SSE headers
    self.send_response(200)
    self.send_header("Content-Type", "text/event-stream")
    self.send_header("Cache-Control", "no-cache")
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Connection", "keep-alive")
    self.end_headers()

    # 2. Loop forever, writing one event per second
    try:
        while True:
            data = json.dumps(generate_tick())
            self.wfile.write(f"data: {data}\n\n".encode())
            self.wfile.flush()
            time.sleep(1)
    except BrokenPipeError:
        pass  # client disconnected
```

Step by step:

1. **Send headers** — `end_headers()` flushes the status line and headers to
   the client. At this point the browser's `onopen` fires.
2. **Enter an infinite loop** — every second, generate new prices, format them
   as `data: <json>\n\n`, write to the socket, and `flush()`. Each flush pushes
   the bytes to the client immediately (without buffering).
3. **Handle disconnect** — when the browser closes the tab or EventSource is
   closed, the next `write()` raises `BrokenPipeError`. We catch it and exit
   the loop, ending the handler cleanly.

The Python server uses `http.server.HTTPServer`, which is **threaded per
request** (via the stdlib). Each SSE client occupies one thread for the lifetime
of the connection, sitting in that `while True` / `sleep(1)` loop.

### Node.js (`server-node/server.js`)

```js
function handleSSE(req, res) {
    // 1. Send the SSE headers
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        Connection: "keep-alive",
    });

    // 2. Push one event per second
    const interval = setInterval(() => {
        const data = JSON.stringify(generateTick());
        res.write(`data: ${data}\n\n`);
    }, 1000);

    // 3. Clean up when client disconnects
    req.on("close", () => clearInterval(interval));
}
```

Step by step:

1. **Send headers** — `res.writeHead()` writes the status and headers. The
   browser's `onopen` fires.
2. **Set an interval** — `setInterval` runs a callback every 1000ms. Each tick
   calls `res.write()` which pushes the text to the client. Node does not need
   an explicit `flush()` — `res.write()` sends data immediately because the
   response is not using chunked encoding buffering in this context.
3. **Handle disconnect** — Node fires a `close` event on the request object
   when the client disconnects. We clear the interval so it stops running.

Unlike Python, Node.js is **single-threaded with an event loop**. The
`setInterval` callback runs on the main event loop, so 1000 connected SSE
clients would have 1000 intervals all sharing one thread. No thread-per-client
cost.

---

## Why `Access-Control-Allow-Origin: *`?

Since the HTML files are opened directly from the filesystem (`file://`), the
browser considers it a **cross-origin request** to `http://localhost:8000`. The
server must include this CORS header or the browser will block the connection.

---

## SSE vs WebSocket

Both are used in this project for the same purpose. Here is how they compare:

| Aspect              | SSE (EventSource)           | WebSocket                          |
|---------------------|-----------------------------|------------------------------------|
| Direction           | Server → Client only        | Bidirectional                      |
| Protocol            | Plain HTTP                  | Separate `ws://` protocol          |
| Auto-reconnect      | Built in                    | Must implement yourself            |
| Data format         | Text only (UTF-8)           | Text or binary                     |
| Port                | Same as HTTP (8000)         | Needs its own port/upgrade (8001)  |
| Browser API         | `EventSource`               | `WebSocket`                        |
| Proxy/firewall      | Works everywhere HTTP works | Sometimes blocked by proxies       |
| Complexity          | Very low                    | Low                                |

For a one-way data feed like a price ticker, SSE is the simpler choice. WebSocket
is useful when the client also needs to send messages to the server.
