import { apiJson } from '../../services/api';
import { setAuthToken } from '../../services/auth';

export function supportsPasskeys() {
  return window.isSecureContext && Boolean(window.PublicKeyCredential && navigator.credentials?.get);
}

function decode(value) {
  const input = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(input.padEnd(Math.ceil(input.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
}

function encode(buffer) {
  return btoa(Array.from(new Uint8Array(buffer), (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function nativeOptions(options, enroll) {
  const parse = enroll
    ? window.PublicKeyCredential.parseCreationOptionsFromJSON
    : window.PublicKeyCredential.parseRequestOptionsFromJSON;
  if (parse) return parse.call(window.PublicKeyCredential, options);
  const publicKey = { ...options, challenge: decode(options.challenge) };
  if (enroll) publicKey.user = { ...options.user, id: decode(options.user.id) };
  const credentialList = enroll ? 'excludeCredentials' : 'allowCredentials';
  if (options[credentialList]) {
    publicKey[credentialList] = options[credentialList].map((item) => ({ ...item, id: decode(item.id) }));
  }
  return publicKey;
}

function credentialJson(credential) {
  if (typeof credential.toJSON === 'function') return credential.toJSON();
  const response = credential.response;
  const encoded = { clientDataJSON: encode(response.clientDataJSON) };
  for (const field of ['attestationObject', 'authenticatorData', 'signature', 'userHandle']) {
    if (response[field]) encoded[field] = encode(response[field]);
  }
  return {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    response: encoded,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function passkeyRequest(path, data, signal) {
  return apiJson(`/auth/passkeys/${path}`, {
    method: 'POST', body: JSON.stringify(data), redirectOnUnauthorized: false, signal,
  });
}

async function completePasskey(purpose, data, signal) {
  const { public_key: options, challenge_token } = await passkeyRequest(`${purpose}/options`, data, signal);
  const enroll = purpose === 'enroll';
  const request = { publicKey: nativeOptions(options, enroll), signal };
  const credential = enroll ? await navigator.credentials.create(request) : await navigator.credentials.get(request);
  if (!credential) throw new Error('No passkey was selected.');
  return passkeyRequest(`${purpose}/verify`, { credential: credentialJson(credential), challenge_token }, signal);
}

export function addPasskey(password, signal) {
  return completePasskey('enroll', { password }, signal);
}

export async function loginWithPasskey(signal) {
  const result = await completePasskey('login', {}, signal);
  if (!signal?.aborted) setAuthToken(result.token);
  return result.user;
}

export function passkeyError(error) {
  if (error.name === 'NotAllowedError') return 'No passkey was used. Try again or use your password.';
  if (error.name === 'InvalidStateError') return 'This passkey is already registered on this device.';
  if (error.name === 'SecurityError') return 'Passkeys are unavailable at this site address.';
  return error.message || 'The passkey prompt could not complete.';
}
