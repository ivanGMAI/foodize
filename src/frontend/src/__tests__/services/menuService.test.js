import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../../services/api';
import { menuService } from '../../services/menuService';

describe('menuService', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getMenu sends GET to /menu/:id', async () => {
    const restaurantId = 'rest-123';
    const mockData = [{ id: 'item-1', name: 'Pizza' }];
    mock.onGet(`/menu/${restaurantId}`).reply(200, mockData);

    const result = await menuService.getMenu(restaurantId);
    expect(result.data).toEqual(mockData);
  });

  it('addItem sends POST to /menu/:id/items', async () => {
    const restaurantId = 'rest-123';
    const mockItem = { name: 'Burger', price: 500 };
    mock
      .onPost(`/menu/${restaurantId}/items`)
      .reply(200, { id: 'item-2', ...mockItem });

    const result = await menuService.addItem(restaurantId, mockItem);
    expect(result.data.name).toBe('Burger');
  });
});
