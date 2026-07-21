import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, setUnauthorizedHandler } from './api-client';

describe('api-client 401/refresh interceptor', () => {
  let apiClientMock: MockAdapter;
  let axiosMock: MockAdapter;

  beforeEach(() => {
    apiClientMock = new MockAdapter(apiClient);
    axiosMock = new MockAdapter(axios);
    localStorage.setItem('accessToken', 'stale-access-token');
    localStorage.setItem('refreshToken', 'valid-refresh-token');
  });

  afterEach(() => {
    apiClientMock.restore();
    axiosMock.restore();
    localStorage.clear();
    setUnauthorizedHandler(() => {});
  });

  it('deduplicates concurrent 401s into a single /auth/refresh call, then retries all of them', async () => {
    let refreshCallCount = 0;
    axiosMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCallCount += 1;
      return [200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }];
    });

    apiClientMock
      .onGet(/\/foo$/)
      .replyOnce(401)
      .onGet(/\/foo$/)
      .reply(200, { data: 'foo' });
    apiClientMock
      .onGet(/\/bar$/)
      .replyOnce(401)
      .onGet(/\/bar$/)
      .reply(200, { data: 'bar' });

    const [fooRes, barRes] = await Promise.all([apiClient.get('/foo'), apiClient.get('/bar')]);

    expect(fooRes.data).toEqual({ data: 'foo' });
    expect(barRes.data).toEqual({ data: 'bar' });
    expect(refreshCallCount).toBe(1);
    expect(localStorage.getItem('accessToken')).toBe('new-access-token');
  });

  it('does not retry forever when the refreshed access token is still rejected (no infinite loop)', async () => {
    let refreshCallCount = 0;
    axiosMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCallCount += 1;
      return [200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }];
    });
    // Điểm cuối luôn trả 401 dù token đã được refresh - mô phỏng phiên thực sự không còn hợp lệ.
    apiClientMock.onGet(/\/protected$/).reply(401);

    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiClient.get('/protected')).rejects.toBeTruthy();

    expect(refreshCallCount).toBe(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('logs the user out immediately when there is no refresh token to use', async () => {
    localStorage.removeItem('refreshToken');
    apiClientMock.onGet(/\/protected$/).reply(401);

    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiClient.get('/protected')).rejects.toBeTruthy();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
