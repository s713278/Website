import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import type { RouteSurface } from '@/shared/types';

const SURFACE_HINT: Record<RouteSurface, string> = {
  marketing: 'Maps to index.html — landing, pricing, social proof.',
  storefront: 'Maps to store.html — customer browse, cart, WhatsApp checkout.',
  onboarding: 'Maps to onboarding.html — vendor store setup wizard.',
  dashboard: 'Maps to dashboard.html — vendor orders, products, share, settings.',
  auth: 'OTP login scaffolding for customer / vendor / admin roles.',
};

type Props = {
  surface: RouteSurface;
  title: string;
  links?: Array<{ to: string; label: string }>;
};

/** Placeholder until business pages are implemented. */
export function ArchitectureShell({ surface, title, links = [] }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{SURFACE_HINT[surface]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Architecture only — feature UI, data hooks, and domain flows will land here next. Shared
          tokens mirror <code className="text-xs">assets/css/global.css</code>.
        </p>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Button key={link.to} asChild variant="secondary" size="sm">
                <Link to={link.to}>{link.label}</Link>
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
