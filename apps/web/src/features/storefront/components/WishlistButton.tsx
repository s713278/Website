import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useWishlist } from '@/features/storefront/hooks/use-wishlist';

type WishlistButtonProps = {
  productId: string;
  className?: string;
  size?: 'sm' | 'md';
};

export function WishlistButton({ productId, className, size = 'md' }: WishlistButtonProps) {
  const { has, toggle } = useWishlist();
  const active = has(productId);

  return (
    <button
      type="button"
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-border bg-white/95 text-muted-foreground shadow-sm transition hover:text-[color-mix(in_srgb,var(--store-theme)_90%,#000)]',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        active && 'border-[color-mix(in_srgb,var(--store-theme)_40%,#fff)] text-[color-mix(in_srgb,var(--store-theme)_85%,#000)]',
        className,
      )}
    >
      <Heart
        className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', active && 'fill-current')}
        aria-hidden
      />
    </button>
  );
}
