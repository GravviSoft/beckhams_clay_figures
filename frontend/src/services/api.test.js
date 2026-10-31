import { apiJson, ApiError, READ_RETRY_DELAY_MS } from './api';

function response(status, body, contentType = 'application/json') {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => contentType },
    json: async () => body,
    text: async () => body,
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
  window.localStorage.clear();
});

test('an HTML gateway page is never shown as the error message', async () => {
  global.fetch.mockResolvedValue(response(400, '<!doctype html><html><body>Bad Gateway</body></html>', 'text/html'));
  await expect(apiJson('/items', { method: 'POST' })).rejects.toThrow('could not complete this request (HTTP 400)');
});

test('the JSON error contract message is surfaced', async () => {
  global.fetch.mockResolvedValue(response(409, { error: { code: 'conflict', message: 'Already exists.' } }));
  await expect(apiJson('/auth/register', { method: 'POST' })).rejects.toEqual(expect.any(ApiError));
  await expect(apiJson('/auth/register', { method: 'POST' })).rejects.toThrow('Already exists.');
});

test('a failed read is retried once', async () => {
  global.fetch
    .mockResolvedValueOnce(response(503, { error: { message: 'dropped' } }))
    .mockResolvedValueOnce(response(200, { items: [] }));
  await expect(apiJson('/items')).resolves.toEqual({ items: [] });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(READ_RETRY_DELAY_MS).toBeLessThan(1000);
});

test('a failed write is never retried', async () => {
  global.fetch.mockResolvedValue(response(503, { error: { message: 'dropped' } }));
  await expect(apiJson('/items', { method: 'POST' })).rejects.toThrow('dropped');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('401 clears the stored session', async () => {
  window.localStorage.setItem('auth_token', 'expired');
  global.fetch.mockResolvedValue(response(401, { error: { message: 'expired' } }));
  await expect(apiJson('/items', { redirectOnUnauthorized: false })).rejects.toThrow('expired');
  expect(window.localStorage.getItem('auth_token')).toBeNull();
});
