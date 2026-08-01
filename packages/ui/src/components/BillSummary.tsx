type Line = { label: string; value: string; strong?: boolean };

type Props = {
  lines: Line[];
};

export function BillSummary({ lines }: Props) {
  return (
    <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.75rem' }}>
      {lines.map((l) => (
        <div
          key={l.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: l.strong ? 700 : 400,
            fontSize: l.strong ? '1.05rem' : '0.95rem',
          }}
        >
          <span>{l.label}</span>
          <span>{l.value}</span>
        </div>
      ))}
    </div>
  );
}
