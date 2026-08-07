import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';

export type Crumb = {
  label: string;
  to?: string;
};

type Props = {
  items: Crumb[];
  className?: string;
};

export function Breadcrumbs({ items, className }: Props) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-muted-foreground', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? (
                <li aria-hidden className="text-border">
                  /
                </li>
              ) : null}
              <li>
                {isLast || !item.to ? (
                  <span
                    className={cn(isLast && 'font-semibold text-foreground')}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.to}
                    className="font-medium text-muted-foreground underline-offset-2 hover:text-md-green-deep hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
