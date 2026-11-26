import { apiJson, apiUrl } from '../../services/api';

export function figureAssetUrl(id, type) {
  return apiUrl(`/figures/${id}/assets/${type}`);
}

export function getAuthoring() {
  return apiJson('/figures/authoring', { redirectOnUnauthorized: false });
}

function putModel(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.timeout = 15 * 60 * 1000;
    xhr.setRequestHeader('Content-Type', 'model/gltf-binary');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(100 * event.loaded / event.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(true);
      else reject(new Error(`R2 rejected the upload (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => resolve(false);
    xhr.ontimeout = () => reject(new Error('The upload timed out. Try again.'));
    xhr.onabort = () => reject(new Error('The upload was interrupted.'));
    xhr.send(file);
  });
}

export async function saveFigure(form, onProgress) {
  const relay = () => apiJson('/figures', { method: 'POST', body: form, redirectOnUnauthorized: false });
  const file = form.get('model');
  if (!file || form.has('poster')) return relay();
  const post = (path, body) => apiJson(path, {
    method: 'POST', body: JSON.stringify(body), redirectOnUnauthorized: false,
  });
  const { url, upload_token } = await post('/figures/uploads', { filename: file.name, size: file.size });
  if (!(await putModel(url, file, onProgress))) {
    // A rejected browser preflight looks like a network error and sends no file.
    onProgress?.(null);
    return relay();
  }
  return post('/figures/uploads/finish', {
    upload_token,
    character_name: form.get('character_name'),
    made_on: form.get('made_on') || '',
    description: form.get('description') || '',
  });
}

export function saveModelThumbnail(id, thumbnail) {
  const form = new FormData();
  form.set('thumbnail', thumbnail, 'model-preview.jpg');
  return apiJson(`/figures/${id}/thumbnail`, {
    method: 'PUT', body: form, redirectOnUnauthorized: false,
  });
}

export function updateFigure(id, form) {
  return apiJson(`/figures/${id}`, { method: 'PATCH', body: form, redirectOnUnauthorized: false });
}

export function featureFigure(id) {
  return apiJson(`/figures/${id}/feature`, { method: 'PUT', redirectOnUnauthorized: false });
}

export async function listFigures() {
  const data = await apiJson('/figures', { redirectOnUnauthorized: false });
  if (!Array.isArray(data?.figures)) {
    throw new Error('The gallery API is unavailable. Refresh the page to try again.');
  }
  return data.figures;
}
