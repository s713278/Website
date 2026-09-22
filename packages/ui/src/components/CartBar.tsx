type Props = {
  count: number;
  totalLabel: string;
  onGoToCart: () => void;
  visible: boolean;
};

export function CartBar({ count, totalLabel, onGoToCart, visible }: Props) {
  return (
    <div className={`md-cart-bar${visible ? ' visible' : ''}`} role="status">
      <div>
        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          {count} {count === 1 ? 'Item' : 'Items'}
        </div>
        <div style={{ fontWeight: 700 }}>{totalLabel}</div>
      </div>
      <button type="button" className="md-cart-bar-cta" onClick={onGoToCart}>
        Go to Cart
      </button>
    </div>
  );
}
