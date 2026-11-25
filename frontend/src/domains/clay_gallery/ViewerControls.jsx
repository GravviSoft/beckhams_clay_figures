const axes = [
  { label: 'X', view: 'Right', vector: [1, 0, 0], angles: '90deg 90deg' },
  { label: 'Y', view: 'Top', vector: [0, 1, 0], angles: '0deg 0deg' },
  { label: 'Z', view: 'Front', vector: [0, 0, 1], angles: '0deg 90deg' },
];

function projectAxis([x, y, z], { theta, phi }) {
  const horizontal = x * Math.cos(theta) - z * Math.sin(theta);
  const vertical = y * Math.sin(phi)
    - Math.cos(phi) * (x * Math.sin(theta) + z * Math.cos(theta));
  return [40 + 29 * horizontal, 40 - 29 * vertical];
}

export default function ViewerControls({ orbit, onZoom, onReset, onAxis }) {
  const projected = axes.map((axis) => ({ ...axis, point: projectAxis(axis.vector, orbit) }));

  return (
    <>
      <div className="clay-viewer-actions" role="group" aria-label="Model camera">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => onZoom(1)}>
          <i className="pi pi-search-plus" aria-hidden="true" />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => onZoom(-1)}>
          <i className="pi pi-search-minus" aria-hidden="true" />
        </button>
        <button type="button" title="Reset view" aria-label="Reset view" onClick={onReset}>
          <i className="pi pi-refresh" aria-hidden="true" />
        </button>
      </div>
      <div className="clay-orientation" role="group" aria-label="Model orientation">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          {projected.map(({ label, point: [x, y] }) => (
            <circle key={label} className={`clay-axis--${label.toLowerCase()}`} cx={80 - x} cy={80 - y} r="4.5" />
          ))}
          {projected.map(({ label, point: [x, y] }) => (
            <line key={label} className={`clay-axis--${label.toLowerCase()}`} x1="40" y1="40" x2={x} y2={y} />
          ))}
        </svg>
        {projected.map(({ label, view, angles, point: [x, y] }) => (
          <button key={label} className={`clay-axis--${label.toLowerCase()}`} type="button"
            style={{ left: x, top: y }} title={`${view} view`} aria-label={`${view} view (${label} axis)`}
            onClick={() => onAxis(angles)}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
