import { apiJson } from '../../services/api';
import { listFigures, saveFigure } from './galleryApi';

jest.mock('../../services/api', () => ({ apiJson: jest.fn() }));

const Xhr = window.XMLHttpRequest;
const ticket = { url: 'https://storage.example.test/upload', upload_token: 'ticket' };

afterEach(() => {
  window.XMLHttpRequest = Xhr;
});

function figureForm() {
  const form = new FormData();
  form.set('model', new File(['model'], 'bowser.glb'));
  form.set('character_name', 'Bowser');
  return form;
}

function useRequest(finish) {
  window.XMLHttpRequest = jest.fn(() => ({
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    upload: {},
    send(file) { finish(this, file); },
  }));
}

test('uploads direct with progress and publishes only after success', async () => {
  apiJson.mockResolvedValueOnce(ticket).mockResolvedValueOnce({ id: 7 });
  const onProgress = jest.fn();
  useRequest((request, file) => {
    expect(file.name).toBe('bowser.glb');
    request.upload.onprogress({ lengthComputable: true, loaded: 3, total: 5 });
    request.status = 200;
    request.onload();
  });
  await expect(saveFigure(figureForm(), onProgress)).resolves.toEqual({ id: 7 });
  expect(onProgress).toHaveBeenCalledWith(60);
  expect(apiJson.mock.calls.map(([path]) => path)).toEqual(['/figures/uploads', '/figures/uploads/finish']);
  expect(JSON.parse(apiJson.mock.calls[1][1].body)).toMatchObject({ upload_token: 'ticket', character_name: 'Bowser' });
});

test('a browser connection or CORS error uses the existing relay', async () => {
  apiJson.mockResolvedValueOnce(ticket).mockResolvedValueOnce({ id: 7 });
  useRequest((request) => request.onerror());
  const form = figureForm();
  await expect(saveFigure(form)).resolves.toEqual({ id: 7 });
  expect(apiJson.mock.calls[1]).toEqual(['/figures', { method: 'POST', body: form, redirectOnUnauthorized: false }]);
});

test('a frontend HTML response is not mistaken for an empty gallery', async () => {
  apiJson.mockResolvedValueOnce('<!doctype html>');
  await expect(listFigures()).rejects.toThrow('The gallery API is unavailable');
});
