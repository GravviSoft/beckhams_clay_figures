// Empty and error states stay visually distinct from loading (PageLoader).
export default function StatusState({ type = 'empty', title, message }) {
  return (
    <section className={`status-state status-state--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </section>
  );
}
