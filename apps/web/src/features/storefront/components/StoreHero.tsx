import type { StoreMeta } from '@/features/storefront/types';

type StoreHeroProps = {
  meta?: StoreMeta;
};

export function StoreHero({ meta }: StoreHeroProps) {
  const theme = meta?.themeColor || '#10b981';

  return (
    <section
      className="relative overflow-hidden rounded-b-3xl px-4 pb-5 pt-10 text-white sm:px-6"
      style={{
        backgroundColor: theme,
        backgroundImage: meta?.bannerUrl
          ? `linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.55)), url(${meta.bannerUrl})`
          : `linear-gradient(145deg, ${theme}, color-mix(in srgb, ${theme} 68%, #064e3b))`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <span className="mb-2 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
        100% Homemade
      </span>
      <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
        {meta?.storeName || 'Store'}
      </h1>
      <p className="mt-1 max-w-xl text-sm text-white/90">
        {meta?.tagline || 'Fresh local favourites, delivered to your door'}
      </p>
      {meta?.location && (
        <p className="mt-1 text-xs text-white/80">{meta.location}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px]">No preservatives</span>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px]">FSSAI licensed</span>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px]">Home delivery</span>
      </div>
    </section>
  );
}
