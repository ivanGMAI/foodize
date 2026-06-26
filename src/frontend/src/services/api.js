import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const detail = error.response?.data?.detail;
    if (detail && typeof detail === 'object' && detail.error) {
      error.response.data.detail = detail.error;
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/login' &&
      originalRequest.url !== '/refresh'
    ) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${BASE_URL}/refresh`,
          {},
          { withCredentials: true }
        );
        const tokenData = refreshResponse.data?.data ?? refreshResponse.data;
        const { access_token } = tokenData;
        localStorage.setItem('access_token', access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        const path = window.location.pathname;
        if (path !== '/login' && path !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

const WS_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
)
  .replace(/^http/, 'ws')
  .replace(/\/api\/v1$/, '');

class ReliableWebSocket {
  constructor(urlOrFactory, onMessage, onClose, onStatusChange) {
    this.urlOrFactory = urlOrFactory;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.isClosed = false;
    this.pingInterval = null;
    this.pongTimeout = null;
    this.status = 'connecting';
    this.connect();
  }

  updateStatus(newStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.onStatusChange?.(newStatus);
  }

  connect() {
    if (this.isClosed) return;
    this.updateStatus(
      this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
    );

    const url =
      typeof this.urlOrFactory === 'function'
        ? this.urlOrFactory()
        : this.urlOrFactory;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateStatus('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          this.resetPongTimeout();
          return;
        }
        if (data.type === 'connected') {
          this.reconnectAttempts = 0;
          return;
        }
        if (data.error) return;
        this.onMessage(data);
      } catch {}
    };

    this.ws.onclose = () => {
      this.cleanup();
      if (!this.isClosed) {
        this.reconnect();
      } else {
        this.updateStatus('closed');
        this.onClose?.();
      }
    };

    this.ws.onerror = () => {
      this.ws.close();
    };
  }

  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.resetPongTimeout();
      }
    }, 30000);
  }

  resetPongTimeout() {
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    this.pongTimeout = setTimeout(() => {
      console.warn('WS heartbeat timeout, reconnecting...');
      this.ws?.close();
    }, 10000); // 10 seconds to wait for pong
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateStatus('closed');
      this.onClose?.();
      return;
    }
    this.updateStatus('reconnecting');
    // 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  close() {
    this.isClosed = true;
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.updateStatus('closed');
      this.onClose?.();
    }
  }
}

export function createOrderWebSocket(orderId, onMessage, onClose) {
  return new ReliableWebSocket(
    () => {
      const token = localStorage.getItem('access_token') || '';
      return `${WS_BASE_URL}/api/v1/ws/orders/${orderId}?token=${encodeURIComponent(token)}`;
    },
    onMessage,
    onClose
  );
}

export function createRestaurantOrdersWebSocket(
  restaurantId,
  onMessage,
  onClose
) {
  return new ReliableWebSocket(
    () => {
      const token = localStorage.getItem('access_token') || '';
      return `${WS_BASE_URL}/api/v1/ws/restaurants/${restaurantId}/orders?token=${encodeURIComponent(token)}`;
    },
    onMessage,
    onClose
  );
}

export function createDisplayBoardWebSocket(restaurantId, onMessage, onClose) {
  const token = localStorage.getItem('access_token') ?? '';
  return new ReliableWebSocket(
    `${WS_BASE_URL}/api/v1/ws/restaurants/${restaurantId}/display-board?token=${encodeURIComponent(token)}`,
    onMessage,
    onClose
  );
}

export function createNotificationWebSocket(userId, onMessage, onClose) {
  return new ReliableWebSocket(
    () => {
      const token = localStorage.getItem('access_token') || '';
      return `${WS_BASE_URL}/api/v1/ws/notifications/${userId}?token=${encodeURIComponent(token)}`;
    },
    onMessage,
    onClose
  );
}
