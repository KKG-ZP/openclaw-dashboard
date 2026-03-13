/**
 * WebSocket 连接管理 — 从 dashboard.js 提取
 * 修复：重连 setTimeout 无限链问题（使用 Disposable 管理 timer）
 */
import { Disposable } from './disposable.js';
import { bus } from './event-bus.js';

export class WebSocketManager extends Disposable {
  constructor() {
    super();
    this.ws = null;
    this._reconnectTimer = null;
  }

  connect() {
    this._cleanup();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPath = window.location.pathname.startsWith('/toolbox/dashboard')
      ? '/toolbox/dashboard/ws' : '/ws';
    const wsUrl = `${protocol}//${window.location.host}${wsPath}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        bus.emit('ws:status', 'connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          bus.emit('ws:message', message);
        } catch (err) {
          console.error('解析WebSocket消息失败:', err);
        }
      };

      this.ws.onerror = () => {
        bus.emit('ws:status', 'error');
      };

      this.ws.onclose = () => {
        bus.emit('ws:status', 'disconnected');
        this._scheduleReconnect();
      };
    } catch (err) {
      console.error('创建WebSocket连接失败:', err);
      bus.emit('ws:status', 'error');
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer != null) {
      clearTimeout(this._reconnectTimer);
    }
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }, 5000);
  }

  _cleanup() {
    if (this._reconnectTimer != null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  dispose() {
    this._cleanup();
    super.dispose();
  }
}
