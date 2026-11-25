import { apiJson, apiUrl } from '../../services/api';

export function figureAssetUrl(id, type) {
  return apiUrl(`/figures/${id}/assets/${type}`);
}

export function getAuthoring() {
  return apiJson('/figures/authoring', { redirectOnUnauthorized: false });
}

export function saveFigure(form) {
  return apiJson('/figures', { method: 'POST', body: form, redirectOnUnauthorized: false });
}

export function updateFigure(id, form) {
  return apiJson(`/figures/${id}`, { method: 'PATCH', body: form, redirectOnUnauthorized: false });
}

export function featureFigure(id) {
  return apiJson(`/figures/${id}/feature`, { method: 'PUT', redirectOnUnauthorized: false });
}

export async function listFigures() {
  const data = await apiJson('/figures', { redirectOnUnauthorized: false });
  return data?.figures || [];
}
