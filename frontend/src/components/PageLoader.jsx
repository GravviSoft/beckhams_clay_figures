import { ProgressSpinner } from 'primereact/progressspinner';
import './PageLoader.css';

// The one loading treatment for the app. Use `compact` inside cards, tables,
// charts, and panels; always pass a specific accessible label.
export default function PageLoader({ className = '', compact = false, label = 'Loading' }) {
  const classes = ['page-loader', compact ? 'page-loader--compact' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="status" aria-busy="true" aria-label={label}>
      <ProgressSpinner />
    </div>
  );
}
