const restStatus = document.getElementById('rest-status');
const wsStatus = document.getElementById('ws-status');
const restToggle = document.getElementById('rest-toggle');
const wsToggle = document.getElementById('ws-toggle');
const restGrid = document.getElementById('rest-grid');
const wsGrid = document.getElementById('ws-grid');
const eventLog = document.getElementById('event-log');

let restSource = null;
let wsConnection = null;

const formatPrice = (value) => `$${value.toFixed(2)}`;

const upsertCard = (grid, data) => {
  const id = `${grid.id}-${data.symbol}`;
  let card = document.getElementById(id);
  if (!card) {
    card = document.createElement('article');
    card.id = id;
    card.className = 'card';
    card.innerHTML = `
      <h3>${data.symbol}</h3>
      <p class="price">${formatPrice(data.price)}</p>
      <p class="meta"></p>
    `;
    grid.appendChild(card);
  }
  card.querySelector('.price').textContent = formatPrice(data.price);
  card.querySelector('.meta').textContent = `Updated ${new Date(data.timestamp).toLocaleTimeString()}`;
};

const logEvent = (label, data) => {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} · ${label} → ${data.symbol}: ${formatPrice(data.price)}`;
  eventLog.prepend(li);
  while (eventLog.children.length > 8) {
    eventLog.removeChild(eventLog.lastChild);
  }
};

const setStatus = (element, isConnected) => {
  element.textContent = isConnected ? 'connected' : 'disconnected';
  element.classList.toggle('connected', isConnected);
};

const startRestStream = () => {
  if (restSource) {
    return;
  }
  restSource = new EventSource('/rest/ticker');
  setStatus(restStatus, true);
  restToggle.textContent = 'Stop';

  restSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    upsertCard(restGrid, data);
    logEvent('REST', data);
  };

  restSource.onerror = () => {
    stopRestStream();
  };
};

const stopRestStream = () => {
  if (!restSource) {
    return;
  }
  restSource.close();
  restSource = null;
  setStatus(restStatus, false);
  restToggle.textContent = 'Start';
};

const startWebSocket = () => {
  if (wsConnection) {
    return;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  wsConnection = new WebSocket(`${protocol}://${window.location.host}/ws`);
  setStatus(wsStatus, true);
  wsToggle.textContent = 'Stop';

  wsConnection.onmessage = (event) => {
    const data = JSON.parse(event.data);
    upsertCard(wsGrid, data);
    logEvent('WS', data);
  };

  wsConnection.onclose = () => {
    stopWebSocket();
  };

  wsConnection.onerror = () => {
    stopWebSocket();
  };
};

const stopWebSocket = () => {
  if (!wsConnection) {
    return;
  }
  wsConnection.close();
  wsConnection = null;
  setStatus(wsStatus, false);
  wsToggle.textContent = 'Start';
};

restToggle.addEventListener('click', () => {
  if (restSource) {
    stopRestStream();
  } else {
    startRestStream();
  }
});

wsToggle.addEventListener('click', () => {
  if (wsConnection) {
    stopWebSocket();
  } else {
    startWebSocket();
  }
});

setStatus(restStatus, false);
setStatus(wsStatus, false);
