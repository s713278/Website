import { getDemoReviews } from '@/features/storefront/data/demo-catalog';
import type { StoreReview } from '@/features/storefront/types';

type ReviewsProps = {
  productId: string;
  rating: number;
  reviewCount: number;
  reviews?: StoreReview[];
};

export function Reviews({ productId, rating, reviewCount, reviews }: ReviewsProps) {
  const list = reviews?.length ? reviews : getDemoReviews(productId);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">Ratings & reviews</h2>
          <p className="text-sm text-muted-foreground">
            {rating.toFixed(1)} average · {reviewCount || list.length} reviews
          </p>
        </div>
        <p className="text-amber-600" aria-label={`${rating} out of 5 stars`}>
          {'★'.repeat(Math.round(rating))}
          {'☆'.repeat(5 - Math.round(rating))}
        </p>
      </div>
      <ul className="space-y-3">
        {list.map((review) => (
          <li key={review.id} className="rounded-xl border border-border/80 bg-[var(--md-surface-alt)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{review.author}</p>
              <p className="text-xs text-muted-foreground">{review.date}</p>
            </div>
            <p className="mt-0.5 text-xs text-amber-600" aria-label={`${review.rating} stars`}>
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </p>
            <p className="mt-2 text-sm text-secondary-foreground">{review.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
