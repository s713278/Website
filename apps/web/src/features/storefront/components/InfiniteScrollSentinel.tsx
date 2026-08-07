import { useInfiniteScrollSentinel } from '@/features/storefront/hooks/use-infinite-products';

type InfiniteScrollSentinelProps = {
  enabled: boolean;
  onLoadMore: () => void;
};

export function InfiniteScrollSentinel({ enabled, onLoadMore }: InfiniteScrollSentinelProps) {
  const ref = useInfiniteScrollSentinel(enabled, onLoadMore);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      className="flex h-12 items-center justify-center text-xs font-semibold text-muted-foreground"
      aria-hidden={!enabled}
    >
      Loading more…
    </div>
  );
}
