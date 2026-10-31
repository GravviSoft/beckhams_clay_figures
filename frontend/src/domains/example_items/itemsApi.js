import { apiJson } from '../../services/api';

export const listItems = () => apiJson('/items').then((body) => body.items);
export const createItem = (title) => apiJson('/items', { method: 'POST', body: JSON.stringify({ title }) }).then((body) => body.item);
export const updateItem = (id, changes) => apiJson(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }).then((body) => body.item);
export const deleteItem = (id) => apiJson(`/items/${id}`, { method: 'DELETE' });
