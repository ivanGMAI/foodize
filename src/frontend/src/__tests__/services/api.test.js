import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const importApiModule = async () => {
  vi.resetModules();
  return import('../../services/api');
};

describe('api infrastructure', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('builds order websocket URL with the latest access token', async () => {
    const sockets = [];
    class MockWebSocket {
      static OPEN = 1;

      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        sockets.push(this);
      }

      send = vi.fn();
      close = vi.fn();
    }
    vi.stubGlobal('WebSocket', MockWebSocket);

    const { createOrderWebSocket } = await importApiModule();
    localStorage.setItem('access_token', 'token with spaces');

    createOrderWebSocket('order-1', vi.fn(), vi.fn());

    expect(sockets[0].url).toBe(
      'ws://localhost:8000/api/v1/ws/orders/order-1?token=token%20with%20spaces'
    );
  });

  it('restaurant orders websocket reads a refreshed token on reconnect', async () => {
    vi.useFakeTimers();
    const sockets = [];
    class MockWebSocket {
      static OPEN = 1;

      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        sockets.push(this);
      }

      send = vi.fn();
      close = vi.fn();
    }
    vi.stubGlobal('WebSocket', MockWebSocket);

    const { createRestaurantOrdersWebSocket } = await importApiModule();
    localStorage.setItem('access_token', 'old-token');
    const ws = createRestaurantOrdersWebSocket('rest-1', vi.fn(), vi.fn());

    localStorage.setItem('access_token', 'new-token');
    sockets[0].onclose();
    await vi.advanceTimersByTimeAsync(1000);

    expect(sockets[0].url).toContain('token=old-token');
    expect(sockets[1].url).toContain('token=new-token');
    ws.close();
    vi.useRealTimers();
  });

  it('display board websocket encodes the current token', async () => {
    const sockets = [];
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        sockets.push(this);
      }

      send = vi.fn();
      close = vi.fn();
    }
    vi.stubGlobal('WebSocket', MockWebSocket);

    const { createDisplayBoardWebSocket } = await importApiModule();
    localStorage.setItem('access_token', 'display/token');

    createDisplayBoardWebSocket('rest-2', vi.fn(), vi.fn());

    expect(sockets[0].url).toBe(
      'ws://localhost:8000/api/v1/ws/restaurants/rest-2/display-board?token=display%2Ftoken'
    );
  });

  it('refreshes access token and retries a 401 request once', async () => {
    const { default: api } = await importApiModule();
    const mock = new MockAdapter(api);
    const refresh = vi
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { data: { access_token: 'new-token' } } });

    mock
      .onGet('/protected')
      .replyOnce(401, { detail: 'expired' })
      .onGet('/protected')
      .replyOnce((config) => [200, { auth: config.headers.Authorization }]);

    localStorage.setItem('access_token', 'old-token');

    const result = await api.get('/protected');

    expect(refresh).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/refresh',
      {},
      { withCredentials: true }
    );
    expect(localStorage.getItem('access_token')).toBe('new-token');
    expect(result.data).toEqual({ auth: 'Bearer new-token' });
    mock.restore();
    refresh.mockRestore();
  });

  it('normalizes nested API error detail before rejecting', async () => {
    const { default: api } = await importApiModule();
    const mock = new MockAdapter(api);
    mock.onGet('/bad-request').reply(400, {
      detail: { error: 'Readable error' },
    });

    await expect(api.get('/bad-request')).rejects.toMatchObject({
      response: { data: { detail: 'Readable error' } },
    });

    mock.restore();
  });
});
