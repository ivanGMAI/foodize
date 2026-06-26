import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../../services/api';
import { restaurantService } from '../../services/restaurantService';

describe('restaurantService', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getAll sends GET to /restaurants/public', async () => {
    const mockData = [{ id: '1', name: 'Sushi' }];
    mock.onGet('/restaurants/public').reply(200, mockData);

    const result = await restaurantService.getAll();
    expect(result.data).toEqual(mockData);
  });

  it('getMy sends GET to /restaurants/', async () => {
    const mockData = [{ id: '2', name: 'My Rest' }];
    mock.onGet('/restaurants/').reply(200, mockData);

    const result = await restaurantService.getMy();
    expect(result.data).toEqual(mockData);
  });

  it('getById accepts public display_id identifiers', async () => {
    const mockData = { id: 'uuid-1', display_id: 'test-cafe' };
    mock.onGet('/restaurants/public/test-cafe').reply(200, mockData);

    const result = await restaurantService.getById('test-cafe');

    expect(result.data).toEqual(mockData);
  });

  it('create sends POST to /restaurants/', async () => {
    const mockData = { id: '1', name: 'New Rest' };
    mock.onPost('/restaurants/').reply(201, mockData);

    const result = await restaurantService.create({ name: 'New Rest' });
    expect(result.data).toEqual(mockData);
  });

  it('update sends PATCH to /restaurants/{id}', async () => {
    const mockData = { id: '1', name: 'Updated Rest' };
    mock.onPatch('/restaurants/1').reply(200, mockData);

    const result = await restaurantService.update('1', {
      name: 'Updated Rest',
    });
    expect(result.data).toEqual(mockData);
  });

  it('working hours methods support display_id route params', async () => {
    const hours = [{ day_of_week: 0, open_time: '09:00', close_time: '18:00' }];
    mock.onGet('/restaurants/test-cafe/working-hours').reply(200, hours);
    mock.onPut('/restaurants/test-cafe/working-hours').reply(200, hours);

    expect((await restaurantService.getWorkingHours('test-cafe')).data).toEqual(
      hours
    );
    expect(
      (await restaurantService.setWorkingHours('test-cafe', hours)).data
    ).toEqual(hours);
  });
});
