# MithraDirect

A hyperlocal marketplace where independent vendors run their own storefront and nearby
customers order from it. This glossary defines the language of the catalog, vendor setup,
store discovery, and store operations.

## Language

### Catalog

**Platform category**:
A category in the marketplace-wide catalog, offered to every vendor to choose from.
_Avoid_: category (unqualified), master category

**Platform product**:
A product in the marketplace-wide catalog, belonging to exactly one platform category.
_Avoid_: product (unqualified), catalog item

**Vendor category**:
A platform category a particular vendor has taken on, meaning their store sells from it.
_Avoid_: my category, selected category, assigned category

**Vendor product**:
A platform product a particular vendor has taken on. It has no price until the vendor
gives it at least one size.
_Avoid_: my product, selected product, assigned product

**Assignment**:
The act of a vendor taking on a platform category or product. Assignment is currently
one-way: nothing the vendor assigns can be given back.
_Avoid_: selection, linking, subscribing

**Size**:
One purchasable quantity, unit, and price of a vendor product, using that product's
measurement; sizes may vary the unit within that measurement. A vendor product needs at
least one active size to be sold.
_Avoid_: SKU, variant, option

**Account catalog**:
The vendor categories and vendor products a vendor's account already holds. It is the
record; anything on screen that disagrees with it is unsaved.
_Avoid_: server catalog, saved catalog, remote catalog

**Plan limit**:
The most categories, products or sizes a vendor's plan allows, counted against
everything already on the account rather than against one screen's worth. Reaching it
stops further catalog growth until the plan changes.
_Avoid_: account limit, max limit, quota, subscription cap

**Sample catalog**:
Built-in demonstration data standing in for the platform catalog, so setup can be walked
through without touching a real account.
_Avoid_: demo catalog, fake catalog, mock data

**Catalog source**:
Which catalog the vendor is choosing from — the account catalog or the sample catalog.
Chosen once at the start of setup.
_Avoid_: reference mode, live catalog, catalog mode

**Pending entry**:
A vendor-authored category or product in the draft that has not yet been created in the
platform catalog. It stops being pending when that creation succeeds; demonstration
entries never become platform entries.
_Avoid_: unsaved entry, local entry, draft category

**Vendor-authored category**:
A platform category introduced by a vendor during setup because the shared catalog did
not have what they sell. It is a pending entry until it is created for every vendor
with that business type and assigned to the author's store.
_Avoid_: custom category, private category, vendor category

**Vendor-authored product**:
A platform product introduced by a vendor during setup under one of their chosen platform
categories because the shared catalog did not have what they sell. It is a pending entry
until it is created in that category and assigned to the author's store.
_Avoid_: custom product, private product, vendor product

### Modes

**Live API**:
The mode connected to real marketplace accounts. It is independent of catalog source,
so a vendor may still be browsing the sample catalog.
_Avoid_: live mode, production mode, online

**Demo mode**:
Demonstration mode in which activity uses sample data and does not change a real account.
_Avoid_: offline mode, mock mode, test mode

### Store discovery

**Service area**:
The postal code used to find stores serving a customer's chosen delivery location.
_Avoid_: location, address, search area

### Vendor setup

**Setup**:
The one-time sequence a vendor completes before their store can open — identity, business
type, catalog, pricing, fulfilment, payments and branding.
_Avoid_: onboarding wizard (as a domain term), registration, signup

**Draft**:
A vendor's setup work that has not yet reached their account. It buffers what is unsaved
and belongs to exactly one vendor.
_Avoid_: local state, cache, saved progress

**Resume step**:
The step a returning vendor is put back on, decided by their account rather than by
anything this browser remembers.
_Avoid_: next step, current step, last step

**Submitted**:
The vendor has sent their finished store for review; this records submission, not approval.
While awaiting a decision, existing setup stays locked except for adding categories and
products to the account within plan limits; new sizes wait until the store is **approved**.
_Avoid_: live, complete, published, finished

**Verification**:
The decision process for whether a submitted store may open; the agreed model uses
automated checks rather than an administrator. Its successful outcome is approval.
_Avoid_: review (for the checker itself), admin, approval system, moderation

**Approved**:
Verification has accepted a submitted store, which is what makes it reachable by
customers. Submission alone does not.
_Avoid_: active, published, public

**Store activation**:
The transition from draft to submitted. It is a request for review, not a going-live.
_Avoid_: go live, publish, launch

### Store operations

**Store state**:
The condition of a vendor's store: setting up, under review, open, rejected, or suspended.
Suspension takes precedence; an open store is reachable by customers, which does not mean
it is taking orders.
_Avoid_: status, account status, vendor status, online, offline

**Delivery status**:
How far an order has progressed toward the customer: new, confirmed, out for delivery,
delivered or cancelled. Placing an order commits it, so there is no acceptance step.
_Avoid_: order status (unqualified), ticket state, accepted, pending, scheduled, in
process, shipped, preparing, ready

**Payment status**:
The vendor's own record that an order has been paid for. The platform never handles the
money, so it cannot observe a payment; only the vendor can say one happened.
_Avoid_: order status (unqualified), settled, collected, verified

**Payment method**:
The way a customer said they would pay when they placed the order. It is an intention,
not an outcome: a vendor may be paid by some other means entirely.
_Avoid_: payment type, payment status

**Subscription**:
A customer's standing commitment to receive one of a vendor's sizes on a repeating
delivery plan. Distinct from the vendor's plan, which is a billing tier.
_Avoid_: plan, subscription plan, recurring order, standing order, membership

**Plan**:
The tier a vendor's account is on, carrying the limits their catalog is measured against.
Distinct from a customer's repeat-order subscription, which is a different thing entirely.
_Avoid_: subscription, tier, package

**Billing state**:
Whether a vendor's plan is paid, trialling, or lapsed. Distinct from store state: an open
store may be unbilled, and a paid-up store may still be awaiting approval.
_Avoid_: subscription status, account status, plan status
