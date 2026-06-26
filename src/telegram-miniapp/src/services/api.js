import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/telegram/auth" &&
      originalRequest.url !== "/telegram/check" &&
      originalRequest.url !== "/telegram/register"
    ) {
      originalRequest._retry = true;
      const refreshToken = sessionStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const resp = await axios.post(
            `${BASE_URL}/refresh`,
            {},
            {
              headers: { Authorization: `Bearer ${refreshToken}` },
            },
          );
          const { access_token } = resp.data.data;
          sessionStorage.setItem("access_token", access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          sessionStorage.clear();
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;

const WS_BASE = BASE_URL.replace(/^http/, "ws").replace(/\/api\/v1$/, "");

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
    this.status = "connecting";
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
      this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
    );

    const url =
      typeof this.urlOrFactory === "function"
        ? this.urlOrFactory()
        : this.urlOrFactory;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateStatus("connected");
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
          this.resetPongTimeout();
          return;
        }
        if (data.type === "connected") {
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
        this.updateStatus("closed");
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
        this.ws.send(JSON.stringify({ type: "ping" }));
        this.resetPongTimeout();
      }
    }, 30000);
  }

  resetPongTimeout() {
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    this.pongTimeout = setTimeout(() => {
      console.warn("WS heartbeat timeout, reconnecting...");
      this.ws?.close();
    }, 10000);
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateStatus("closed");
      this.onClose?.();
      return;
    }
    this.updateStatus("reconnecting");

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
      this.updateStatus("closed");
      this.onClose?.();
    }
  }
}

export function createOrderWebSocket(
  orderId,
  onMessage,
  onClose,
  onStatusChange,
) {
  return new ReliableWebSocket(
    () => {
      const token = sessionStorage.getItem("access_token") || "";
      return `${WS_BASE}/api/v1/ws/orders/${orderId}?token=${encodeURIComponent(token)}`;
    },
    onMessage,
    onClose,
    onStatusChange,
  );
}

export function createNotificationWebSocket(
  userId,
  onMessage,
  onClose,
  onStatusChange,
) {
  return new ReliableWebSocket(
    () => {
      const token = sessionStorage.getItem("access_token") || "";
      return `${WS_BASE}/api/v1/ws/notifications/${userId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    },
    onMessage,
    onClose,
    onStatusChange,
  );
}
