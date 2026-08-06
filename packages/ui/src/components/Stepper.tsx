type Props = {
  current: number;
  total: number;
};

export function Stepper({ current, total }: Props) {
  return (
    <div className="md-stepper" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const cls = n === current ? 'active' : n < current ? 'done' : '';
        return <span key={n} className={`md-step ${cls}`} />;
      })}
    </div>
  );
}
