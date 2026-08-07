import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStoreInfo } from '@/features/dashboard/hooks/use-dashboard-vendor';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { whatsappShareUrl } from '@/shared/lib/format';

export function StoreSharePage() {
  const store = useDashboardStoreInfo();
  const { log } = useAuditLog();
  const [copied, setCopied] = useState(false);

  const waUrl = whatsappShareUrl(`Order from ${store.storeName}: ${store.storeUrl}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(store.storeUrl)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(store.storeUrl);
      setCopied(true);
      log({
        action: 'export',
        entity: 'settings',
        summary: 'Copied storefront link',
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your shop link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Customers open this link to browse and order on WhatsApp. Share it on WhatsApp and put
            it in your Instagram bio.
          </p>
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-3 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 break-all font-semibold text-md-green-deep">
              {store.storeUrl}
            </span>
            <Button type="button" size="sm" onClick={() => void copyLink()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {copied ? (
            <p className="text-xs font-semibold text-secondary-foreground" role="status">
              Copied — paste in WhatsApp or Instagram bio.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                Share on WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/store">Open storefront</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[color-mix(in_srgb,var(--store-theme)_22%,var(--md-border))]">
        <CardContent className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-2xl border border-border bg-white p-3">
            <img src={qrUrl} alt={`QR code for ${store.storeName}`} width={200} height={200} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Scan & order
            </p>
            <h3 className="font-display text-xl font-bold">Put this on your counter</h3>
            <p className="text-sm text-muted-foreground">
              Print or save this QR. Customers scan with their phone camera and land on your shop —
              no typing, no app needed.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Stick on packaging or your shop table</li>
              <li>Show it in WhatsApp status / Stories</li>
              <li>Keep next to UPI / cash counter</li>
            </ul>
            <Button asChild size="sm">
              <a href={qrUrl} download={`${store.slug || 'store'}-qr.png`}>
                Save QR image
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
