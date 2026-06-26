import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../../services/api';
import { orderService } from '../../services/orderService';

describe('orderService', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('create sends POST to /orders/', async () => {
    const mockData = { id: '1', status: 'PENDING' };
    mock.onPost('/orders/').reply(201, mockData);

    const result = await orderService.create({ restaurant_id: '2', items: [] });
    expect(result.data).toEqual(mockData);
  });

  it('getMyOrders sends GET to /orders/me', async () => {
    const mockData = [{ id: '1' }];
    mock.onGet('/orders/me').reply(200, mockData);

    const result = await orderService.getMyOrders();
    expect(result.data).toEqual(mockData);
  });

  it('getById sends GET to /orders/{id}', async () => {
    const mockData = { id: '123' };
    mock.onGet('/orders/123').reply(200, mockData);

    const result = await orderService.getById('123');
    expect(result.data).toEqual(mockData);
  });

  it('getOrderEvents sends GET to /orders/{id}/events', async () => {
    mock.onGet('/orders/123/events').reply(200, []);

    const result = await orderService.getOrderEvents('123');
    expect(result.data).toEqual([]);
  });
});
