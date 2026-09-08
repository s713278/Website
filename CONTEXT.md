# MithraDirect

A hyperlocal marketplace where independent vendors run their own storefront and nearby
customers order from it. This glossary covers the language of vendor setup and the shared
catalog, where several words currently do more than one job.

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
One purchasable variant of a vendor product — a quantity, a unit and a price. Its
measurement is the product's, not a choice the size makes: every size of a product shares
that one measurement, and only the unit within it varies. A vendor product with no active
size cannot be sold.
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
A vendor-authored category or product that exists only in the draft and has not yet
been created in the platform catalog. It stops being pending the moment Continue
succeeds; in demo mode it stays pending forever.
_Avoid_: unsaved entry, local entry, draft category

**Vendor-authored category**:
A platform category introduced by a vendor during setup because the shared catalog did
not have what they sell. It is a pending entry until Continue creates it for every vendor
with that business type and assigns it to the author's store.
_Avoid_: custom category, private category, vendor category

**Vendor-authored product**:
A platform product introduced by a vendor during setup under one of their chosen platform
categories because the shared catalog did not have what they sell. It is a pending entry
until Continue creates it in that category and assigns it to the author's store.
_Avoid_: custom product, private product, vendor product

### Modes

**Live API**:
The application is talking to the real backend. The opposite is demo mode.
_Avoid_: live mode, production mode, online

**Demo mode**:
The application answers from local data and makes no backend calls, so nothing a vendor
does reaches an account.
_Avoid_: offline mode, mock mode, test mode

Live API and catalog source are independent: the real backend can be answering while the
vendor browses the sample catalog. Do not use "live" for both.

### Store discovery

**Service area**:
The postal code used to find stores serving a customer's chosen delivery location. It is
sent together with that location's latitude and longitude.
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
The vendor has sent their finished store for review. From this point nothing already on
the store can be changed, removed, or started over — with one exception: the vendor may
still grow their catalog within plan limits, assigning or authoring more categories and
products, and those additions reach the account without reopening setup. Sizes are the
boundary of that exception: a new size cannot be created while under review (the backend
rejects it), so Step 6 is read-only until the store is **approved**, and a product added
in the meantime stays sizeless until then. Everything else stays read-only until
**verification** decides.
_Avoid_: live, complete, published, finished

**Verification**:
The automated check that decides whether a submitted store may open. It replaces approval
by an administrator; no person is in the loop.
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
The single condition of a vendor's store, derived rather than read from one place: setting
up, under review, open, rejected, or suspended. Suspension outranks everything else. Being
open means customers can reach the store; it does not mean the store is taking orders, a
thing the platform does not currently express.
_Avoid_: status, account status, vendor status, online, offline

**Delivery status**:
How far an order has progressed toward the customer: pending, scheduled, in process,
shipped, delivered or cancelled.
_Avoid_: order status (unqualified), ticket state, new, accepted, preparing, ready

**Payment status**:
Whether an order has been paid for. Independent of delivery status: an order can be
delivered and still unpaid.
_Avoid_: order status (unqualified), settled

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
