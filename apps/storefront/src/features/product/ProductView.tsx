import { useStore } from '../home/store-context';
import { SkuControls } from './SkuControls';

export function ProductView() {
  const { draft, productId, setView } = useStore();
  const product = draft.products.find((p) => p.id === productId);

  if (!product) {
    return (
      <div className="p-4">
        <button type="button" className="text-sm text-emerald-700" onClick={() => setView('menu')}>
          ← Back to menu
        </button>
        <p className="mt-4">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md-fade-in">
      <button type="button" className="text-sm text-emerald-700" onClick={() => setView('menu')}>
        ← Back
      </button>
      <div
        className="mt-3 flex h-40 items-center justify-center rounded-2xl"
        style={{ background: product.color || '#ecfdf5' }}
      >
        {product.image ? (
          <img src={product.image} alt="" className="h-28 w-28 rounded-full object-cover" />
        ) : null}
      </div>
      <h1 className="md-display mt-4 text-2xl">{product.name}</h1>
      {product.rating ? <p className="text-sm text-slate-500">★ {product.rating}</p> : null}
      {product.description ? <p className="mt-2 text-sm text-slate-600">{product.description}</p> : null}
      <div className="mt-4">
        <SkuControls product={product} />
      </div>
      {product.ingredients ? (
        <details className="mt-4 rounded-xl border border-slate-100 p-3 text-sm">
          <summary className="font-semibold">Ingredients</summary>
          <p className="mt-2 text-slate-600">{product.ingredients}</p>
        </details>
      ) : null}
    </div>
  );
}
