import { Link } from 'react-router-dom'
import { Button, Card, PageHeader } from '@/shared/components'

/**
 * Customers — deliberately not built.
 *
 * The screen exists because the navigation entry does, and an entry that led nowhere would
 * be worse. What it must not do is render an empty list: a vendor reading "no customers"
 * would conclude nobody has bought from them, when the truth is that the backend cannot
 * answer the question yet.
 *
 * Two measured facts hold this back, both from the 6 September re-probe:
 *
 * 1. A real purchase by a distinct customer does **not** create a vendor–customer
 *    relationship. `total_customers` moved from 1 to 2 while the directory stayed at zero
 *    rows, through every order status.
 * 2. The directory response is typed `APIResponseObject` — there is **no declared row
 *    schema anywhere**. Building against a guessed shape is what produced the mapper bugs
 *    package A had to undo.
 *
 * See `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` for the contract request.
 */
export function VendorCustomersPage() {
  return (
    <div>
      <PageHeader title="Customers" subtitle="Who has ordered from your store" />

      <Card>
        <h2 className="font-display text-lg font-semibold">Not available yet</h2>
        <p className="mt-2 text-sm text-[var(--md-muted)]">
          This is not an empty list — it is a screen we have not built, because the customer
          directory cannot yet be read reliably. A real order placed by a new customer did not
          add them to it, and the response has no published row format, so anything shown here
          would be a guess.
        </p>
        <p className="mt-2 text-sm text-[var(--md-muted)]">
          Until that changes, every order carries its customer&rsquo;s phone number, and you can
          call or message them from the order itself.
        </p>
        <div className="mt-4">
          <Link to="/vendor/orders">
            <Button size="sm">Go to Orders</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
