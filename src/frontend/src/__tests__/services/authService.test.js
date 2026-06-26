import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../../services/api';
import { authService } from '../../services/authService';

describe('authService', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('login sends POST to /login', async () => {
    const mockData = { access_token: 'test' };
    mock.onPost('/login').reply(200, mockData);

    const result = await authService.login({
      phone_number: '123',
      password: 'pw',
    });
    expect(result.data).toEqual(mockData);
  });

  it('register sends POST to /register', async () => {
    const mockData = { id: '1', name: 'Ivan' };
    mock.onPost('/register').reply(200, mockData);

    const result = await authService.register({ name: 'Ivan' });
    expect(result.data).toEqual(mockData);
  });

  it('getMe sends GET to /users/me', async () => {
    const mockData = { id: '1', name: 'Ivan' };
    mock.onGet('/users/me').reply(200, mockData);

    const result = await authService.getMe();
    expect(result.data).toEqual(mockData);
  });

  it('logout sends POST to /logout so backend can invalidate tokens', async () => {
    mock.onPost('/logout').reply(204);

    const result = await authService.logout();

    expect(result.status).toBe(204);
  });
});
