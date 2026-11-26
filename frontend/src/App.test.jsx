import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { listFigures, saveFigure } from './domains/clay_gallery/galleryApi';
import { UnauthorizedError } from './services/api';
import { clearAuthSession, getAuthToken } from './services/auth';

jest.mock('./domains/clay_gallery/galleryApi', () => ({
  listFigures: jest.fn(),
  getAuthoring: async () => ({ can_upload: true, can_feature: false, editable_figure_ids: [] }),
  saveFigure: jest.fn(),
  figureAssetUrl: (id, type) => `/api/figures/${id}/assets/${type}`,
}));

beforeEach(() => {
  listFigures.mockResolvedValue([]);
});

test('a saved figure shows its thumbnail while the 3D viewer is unavailable', async () => {
  window.localStorage.clear();
  listFigures.mockResolvedValue([{
    id: 1, character_name: 'Bowser', assets: [
      { asset_type: 'display_model' }, { asset_type: 'web_model' }, { asset_type: 'model_thumbnail' },
    ],
  }]);
  render(<MemoryRouter initialEntries={['/?figure=1']}><App /></MemoryRouter>);
  expect(await screen.findByRole('img', { name: 'Bowser' })).toHaveAttribute(
    'src', '/api/figures/1/assets/model_thumbnail?v=',
  );
  expect(screen.getByRole('button', { name: 'Bowser' })).toBeInTheDocument();
});

test('signed-out visitors see the public gallery', async () => {
  window.localStorage.clear();
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /clay collection/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: /loading clay figure gallery/i }));
  expect(screen.queryByText(/first clay figure/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  expect(await screen.findByRole('dialog', { name: 'Create an account' })).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
  expect(await screen.findByRole('dialog', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /clay collection/i })).toBeInTheDocument();
});

test('signed-in visitors can pick a GLB and edit it from its card', async () => {
  saveFigure.mockRejectedValue(new Error('Storage unavailable'));
  window.localStorage.setItem('auth_token', 'test-session');
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = () => 'blob:figure';
  URL.revokeObjectURL = () => {};
  try {
    const { unmount } = render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: /loading clay figure gallery/i }));
    const picker = screen.getByLabelText('Choose a GLB model');
    const openPicker = jest.spyOn(picker, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Upload a figure' }));
    expect(openPicker).toHaveBeenCalled();
    fireEvent.change(picker, { target: { files: [new File(['model'], 'Clay_Bowser.glb')] } });
    expect(screen.getByRole('heading', { name: 'Clay Bowser' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved');
    fireEvent.click(screen.getByRole('button', { name: 'Options for Clay Bowser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog', { name: 'Edit figure' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bowser' } });
    expect(screen.getByLabelText(/gallery photo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to gallery' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(screen.getByRole('heading', { name: 'Bowser' })).toBeInTheDocument();
    unmount();
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    window.localStorage.clear();
  }
});

test('picking a signed-in model submits it immediately without a photo', async () => {
  window.localStorage.setItem('auth_token', 'test-session');
  saveFigure.mockResolvedValue({ id: 42 });
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = () => 'blob:figure';
  URL.revokeObjectURL = () => {};
  try {
    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>);
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: /loading clay figure gallery/i }));
    const file = new File(['model'], 'Clay_Bowser.glb');
    fireEvent.change(screen.getByLabelText('Choose a GLB model'), { target: { files: [file] } });
    const [form] = saveFigure.mock.calls[0];
    expect(form.get('model')).toBe(file);
    expect(form.get('character_name')).toBe('Clay Bowser');
    expect(form.has('poster')).toBe(false);
    await waitForElementToBeRemoved(() => screen.queryByText('Saving…'));
    expect(screen.getByRole('button', { name: 'Clay Bowser', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feature model: Clay Bowser' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Options for Clay Bowser' }));
    expect(screen.getByRole('button', { name: 'Edit Clay Bowser' })).toBeInTheDocument();
    unmount();
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    window.localStorage.clear();
  }
});

test('an expired upload opens sign-in and resumes with the same GLB', async () => {
  window.localStorage.setItem('auth_token', 'expired');
  saveFigure.mockImplementationOnce(async () => {
    clearAuthSession();
    throw new UnauthorizedError('A bearer token is required.');
  }).mockImplementationOnce(async () => {
    expect(getAuthToken()).toBe('renewed');
    return { id: 42 };
  });
  const { createObjectURL, revokeObjectURL } = URL;
  const originalFetch = global.fetch;
  URL.createObjectURL = () => 'blob:figure';
  URL.revokeObjectURL = () => {};
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200, headers: { get: () => 'application/json' },
    json: async () => ({ user: { id: 7 }, token: 'renewed' }),
  });
  try {
    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>);
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: /loading clay figure gallery/i }));
    const file = new File(['model'], 'Bowser.glb');
    fireEvent.change(screen.getByLabelText('Choose a GLB model'), { target: { files: [file] } });
    const dialog = await screen.findByRole('dialog', { name: 'Sign in' });
    expect(screen.getByRole('heading', { name: 'Bowser' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'becks@example.test' } });
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'example-password' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(saveFigure).toHaveBeenCalledTimes(2));
    expect(saveFigure.mock.calls[1][0].get('model')).toBe(file);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Feature model: Bowser' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Options for Bowser' }));
    expect(await screen.findByRole('button', { name: 'Edit Bowser' })).toBeInTheDocument();
    unmount();
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    global.fetch = originalFetch;
    window.localStorage.clear();
  }
});
