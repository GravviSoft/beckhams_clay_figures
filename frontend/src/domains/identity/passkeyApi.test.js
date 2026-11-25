import { apiJson } from '../../services/api';
import { getAuthToken } from '../../services/auth';
import { addPasskey, loginWithPasskey } from './passkeyApi';

jest.mock('../../services/api', () => ({ apiJson: jest.fn() }));

const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
const originalPublicKey = Object.getOwnPropertyDescriptor(window, 'PublicKeyCredential');
const binary = Uint8Array.of(1, 2, 3).buffer;

beforeEach(() => {
  Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: {} });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create: jest.fn(), get: jest.fn() },
  });
  window.localStorage.clear();
});

afterEach(() => {
  if (originalCredentials) Object.defineProperty(navigator, 'credentials', originalCredentials);
  else delete navigator.credentials;
  if (originalPublicKey) Object.defineProperty(window, 'PublicKeyCredential', originalPublicKey);
  else delete window.PublicKeyCredential;
  window.localStorage.clear();
});

test('enrollment confirms the password and submits the browser response', async () => {
  apiJson.mockResolvedValueOnce({
    public_key: { challenge: 'AQID', user: { id: 'Nw' }, excludeCredentials: [{ id: 'AQID' }] },
    challenge_token: 'enrollment-prompt',
  }).mockResolvedValueOnce(null);
  navigator.credentials.create.mockResolvedValue({
    id: 'AQID', rawId: binary, type: 'public-key',
    response: { clientDataJSON: binary, attestationObject: binary },
    getClientExtensionResults: () => ({}),
  });

  await addPasskey('password');

  expect(apiJson.mock.calls[0][0]).toBe('/auth/passkeys/enroll/options');
  expect(JSON.parse(apiJson.mock.calls[0][1].body)).toEqual({ password: 'password' });
  expect(navigator.credentials.create.mock.calls[0][0].publicKey.user.id).toEqual(Uint8Array.of(55));
  expect(apiJson.mock.calls[1][0]).toBe('/auth/passkeys/enroll/verify');
  expect(JSON.parse(apiJson.mock.calls[1][1].body)).toMatchObject({
    challenge_token: 'enrollment-prompt',
    credential: { rawId: 'AQID', response: { attestationObject: 'AQID' } },
  });
});

test('sign-in uses the session token returned by the verified passkey', async () => {
  apiJson.mockResolvedValueOnce({
    public_key: { challenge: 'AQID', rpId: 'test.localhost' },
    challenge_token: 'login-prompt',
  }).mockResolvedValueOnce({ token: 'signed-in', user: { id: 7 } });
  navigator.credentials.get.mockResolvedValue({ toJSON: () => ({ id: 'AQID' }) });

  await expect(loginWithPasskey()).resolves.toEqual({ id: 7 });
  expect(navigator.credentials.get.mock.calls[0][0].publicKey.challenge).toEqual(Uint8Array.of(1, 2, 3));
  expect(apiJson.mock.calls[1][0]).toBe('/auth/passkeys/login/verify');
  expect(getAuthToken()).toBe('signed-in');
});
