import ExampleItemsPanel from '../../domains/example_items/ExampleItemsPanel';

// A workspace composes domain UI for one role's experience.
export default function DashboardWorkspace() {
  return (
    <>
      <header className="page-heading">
        <h1>Dashboard</h1>
        <p>Replace the example domain with your application's first feature.</p>
      </header>
      <ExampleItemsPanel />
    </>
  );
}
