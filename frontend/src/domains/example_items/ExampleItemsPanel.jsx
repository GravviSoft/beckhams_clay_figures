import { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { AppActionGroup, AppButton, AppField } from '../../components/authenticated-ui/AuthenticatedUi';
import PageLoader from '../../components/PageLoader';
import StatusState from '../../components/StatusState';
import { createItem, deleteItem, listItems, updateItem } from './itemsApi';
import './ExampleItemsPanel.css';

export default function ExampleItemsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listItems()
      .then((loaded) => active && setItems(loaded))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function run(action) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  }

  async function add(event) {
    event.preventDefault();
    setSaving(true);
    await run(async () => {
      const item = await createItem(title);
      setItems((current) => [...current, item]);
      setTitle('');
    });
    setSaving(false);
  }

  const toggle = (item) => run(async () => {
    const updated = await updateItem(item.id, { completed: !item.completed });
    setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  });

  const remove = (item) => run(async () => {
    await deleteItem(item.id);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  });

  if (loading) return <PageLoader compact label="Loading example items" />;

  return (
    <section className="example-items">
      <form className="example-items__form" onSubmit={add}>
        <AppField label="New item" htmlFor="example-item-title">
          <InputText id="example-item-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required />
        </AppField>
        <AppButton type="submit" icon="pi pi-plus" label="Add" disabled={saving || !title.trim()} />
      </form>
      {error && <StatusState type="error" title="Something went wrong" message={error} />}
      {items.length === 0
        ? <StatusState title="No items yet" message="Add the first one above." />
        : (
          <ul className="example-items__list">
            {items.map((item) => (
              <li key={item.id} className={item.completed ? 'is-complete' : ''}>
                <label>
                  <input type="checkbox" checked={item.completed} onChange={() => toggle(item)} />
                  <span>{item.title}</span>
                </label>
                <AppActionGroup>
                  <AppButton variant="text" icon="pi pi-trash" label="Delete" aria-label={`Delete ${item.title}`} onClick={() => remove(item)} />
                </AppActionGroup>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
