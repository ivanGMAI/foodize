import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../../services/api';
import { staffService } from '../../services/staffService';

describe('staffService', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('createRequest sends POST to /staff/requests/{id}', async () => {
    mock.onPost('/staff/requests/123').reply(201, { id: 'req1' });

    const result = await staffService.createRequest('123', {
      message: 'Hire me',
    });
    expect(result.status).toEqual(201);
  });
});
