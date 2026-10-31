import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppActionGroup, AppButton, AppField } from './AuthenticatedUi';

test('authenticated controls expose shared variants and icon spacing hooks', () => {
  render(<AppActionGroup><AppButton label="Save" icon="pi pi-check" variant="accent" /></AppActionGroup>);
  const classNames = screen.getByRole('button', { name: 'Save' }).className.split(/\s+/);
  expect(classNames).toEqual(expect.arrayContaining(['app-button', 'app-button--accent', 'app-button--compact']));
});

test('field renders optional status with its shared label', () => {
  render(<AppField label="Nickname" optional htmlFor="nickname"><input id="nickname" /></AppField>);
  expect(screen.getByText('optional')).not.toBeNull();
  expect(screen.getByLabelText(/Nickname/)).not.toBeNull();
});
