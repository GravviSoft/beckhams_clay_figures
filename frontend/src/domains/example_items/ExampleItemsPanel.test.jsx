import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExampleItemsPanel from './ExampleItemsPanel';
import * as itemsApi from './itemsApi';

jest.mock('./itemsApi');

test('shows the empty state, then adds an item', async () => {
  itemsApi.listItems.mockResolvedValue([]);
  itemsApi.createItem.mockResolvedValue({ id: 1, title: 'First', completed: false });

  render(<ExampleItemsPanel />);
  expect(await screen.findByText('No items yet')).toBeInTheDocument();

  userEvent.type(screen.getByLabelText(/new item/i), 'First');
  userEvent.click(screen.getByRole('button', { name: /add/i }));

  expect(await screen.findByText('First')).toBeInTheDocument();
  expect(itemsApi.createItem).toHaveBeenCalledWith('First');
});

test('keeps errors separate from the loading state', async () => {
  itemsApi.listItems.mockRejectedValue(new Error('Could not reach the server.'));
  render(<ExampleItemsPanel />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server.'));
  expect(screen.queryByLabelText('Loading example items')).not.toBeInTheDocument();
});
