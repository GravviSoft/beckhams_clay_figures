import { apiJson } from '../../services/api';
import { clearAuthSession, setAuthToken } from '../../services/auth';

async function startSession(path, credentials) {
  const result = await apiJson(path, {
    method: 'POST',
    body: JSON.stringify(credentials),
    redirectOnUnauthorized: false,
  });
  setAuthToken(result.token);
  return result.user;
}

export const login = (credentials) => startSession('/auth/login', credentials);
export const register = (credentials) => startSession('/auth/register', credentials);
export const logout = () => clearAuthSession();
