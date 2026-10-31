import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('signed-out visitors are sent to sign in', () => {
  window.localStorage.clear();
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
});
