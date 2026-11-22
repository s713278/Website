# Catalog editor stories

Handoff for the UI developer. Visual sample: `design-reference/roles.html`
(`#admin/categories`, `#admin/products`, `#vendor/products`). Build the shipping screens in React.
Pages call `@/shared/api`. They do not call Axios or `@mithra/api-client` directly.

The sample is in-memory. These stories say which calls exist today. A control with no contract
field stays on screen and is not posted.

Shared behavior:

- Choosing a photo uploads it immediately. **Save** writes text only.
- **Generate with AI** is visible, marked Later, and makes no request.
- Sample chips are placeholders. They add an empty row. They never save the example words.
- A feature row needs a label and a detail. Drop a fully blank row. Reject a duplicate label,
  ignoring case.
- Orange marks mean the row is still missing an image, a description, or features.
- On a phone, the open editor replaces the list. **All categories** or **All products** brings the list back.
- Preview is local. It does not call the API.
- The sample rejects a non-image and a file over 2 MB. Confirm the server limit before copying that number.
- List calls return a `PaginationResponse` (`result`, `page_number`, `page_size`, `total_elements`, `total_pages`). The generated `result` item type is empty. Check a real response before binding fields.

## Categories

Admin only. A vendor does not get this screen. One image and one description. No thumbnails, features, or Instagram.

### 1. Browse categories

An admin searches categories, filters by business type, and pages the list. Each row shows the name, business type, and whether the image or description is missing.

Wire:

- `GET /v1/categories/?pageNumber&pageSize&business_type_id`
- `GET /v1/business-types/` for the filter
- `GET /v1/categories/{category_id}` when a row is opened

`CategoryDTO` is `id`, `name`, `business_type`, `business_type_id`, `image_path`, `description`, `icon`. Derive “Needs image” from an empty `image_path` and “No description” from a blank `description`. The list has no keyword parameter, so search filters the loaded page until the backend adds one. Product counts on the sample are not on `CategoryDTO`.

### 2. Set the category image

An admin adds, replaces, or removes the one category image. Recommended size in the sample is a square 1000 × 1000 px. The file uploads as soon as it is chosen.

Wire: `PATCH /v1/categories/{category_id}` with `image_path`. There is no separate category-image endpoint. A description save must not send an empty `image_path`. `business_type_id` is required on `CategoryDTO`; keep the value already loaded.

### 3. Save the description

An admin writes the description and presses **Save description**. The image is already stored.

Wire: `PATCH /v1/categories/{category_id}` with `description`. **Generate with AI** shows “Generate with AI is for a later release” and leaves the textarea unchanged.

## Products

The same editor is used by admin and vendor. Admin edits the shared catalog. Vendor edits that shop’s description and features. Price stays on the shop’s SKUs and is not on this screen.

### 4. Browse the shared catalog

An admin searches products, filters by category, and pages the list. A row shows whether the main photo is missing.

Wire, all category-scoped:

- `GET /v1/categories/{category_id}/products?pageNumber&pageSize`
- `GET /v1/categories/{category_id}/products/search?keyword&pageNumber&pageSize`
- `GET /v1/categories/products/keyword/{keyword}?pageNumber&pageSize` for a search that is not tied to one category
- `GET /v1/categories/{category_id}/products/{product_id}` for the open product

There is no unfiltered “all products” list. With **All categories** and an empty search, ask the admin to pick a category, or load one category at a time. `ProductDTO` is `id`, `name`, `description`, `measurement_unit_id`, `image_path`. “Needs photo” comes from an empty `image_path`. “Needs features” cannot be known from this payload.

### 5. Product image

**As an** admin, **I want** to add, replace, or remove a product’s main photo, **so that** every store starts with the same image on the shop card.

**As a** vendor, **I want** to replace that photo for my shop, **so that** my customers see my photo.

Acceptance:

- One main photo. Empty state is **+ Add photo**. A filled photo is replaced by clicking it, and removed with the corner ×.
- Recommended size is a square 1600 × 1600 px.
- The file uploads as soon as it is chosen. **Save description and features** does not send the photo again.
- The shop card uses this photo. The gallery does not.

Use:

- Admin upload: `PUT /v1/categories/{category_id}/products/{product_id}/image` or `PUT /v1/categories/products/{productId}/image`, body field `image`.
- Vendor upload: `POST /v1/vendors/{vendor_id}/images?image_type=PRODUCT&reference_id={productId}` with multipart `file`.
- Vendor read: `GET /v1/vendors/{vendor_id}/images?image_type=PRODUCT&reference_id={productId}` (`image_url`).
- After upload, show the returned URL. Reload the product if the response has no URL.

### 6. Gallery

**As an** admin or vendor, **I want** to add, replace, and remove extra product photos, **so that** the product page can show more than the cover.

Acceptance:

- Gallery is optional. Up to 5 photos, separate from the main photo.
- Recommended size is a square 1000 × 1000 px.
- An empty slot is **+**. Click a photo to replace it. × removes that photo only.
- Each file uploads as soon as it is chosen.
- The sixth file is refused. The main photo is left as it is.

Use the product image APIs above, one file per gallery photo. Read the extra photos back on the product fetch and render them in this row.

### 7. Feature management

**As an** admin, **I want** to set label-and-detail features on a product, **so that** every store starts with the same facts.

**As a** vendor, **I want** to change those features for my shop, **so that** my customers see my wording.

Acceptance:

- Each row is a Label and a Detail. **Add row** appends an empty row. **Remove** deletes that row.
- Sample chips (Brand, Made in, Good for, Easily Digestible, Health Benefits, How to Use, Ingredients) add an empty row. The hint stays a placeholder and is not saved.
- Save rejects a row with no label, a label with no detail, and a duplicate label (ignore case). A fully blank row is dropped.
- **Save description and features** sends the description and the feature rows. Photos are already uploaded.
- The shop preview shows one chip per saved row.

Use `PATCH /v1/vendors/{vendor_id}/products/{product_id}`:

```json
{
  "product_id": 123,
  "description": "Toned milk from this shop, for tea and coffee.",
  "features": {
    "Features": [
      { "Brand": "Nandini", "Made in": "Karnataka", "Good for": "Tea and coffee" }
    ]
  }
}
```

Map each filled row onto one key of that object. Read the same shape back into rows. First assign of a platform product uses the same map on `PATCH /v1/vendors/{vendor_id}/assign/products` as `features_map`.

### 8. Browse one shop’s products

A vendor sees only that shop’s products, with the shop price on the row. Search, category filter, and paging match the admin list.

Wire:

- `GET /v1/vendors/{vendor_id}/products`
- `GET /v1/vendors/{vendor_id}/products/{product_id}` when a row is opened

Confirm whether those reads include `description` and `features` before rendering the editor from the list row alone.

## Still open on the list screens

| Screen control | Needed contract |
| --- | --- |
| Category search | Keyword on `GET /v1/categories/` |
| Category product count | A count on the category list item |
| Instagram | A field on the product the screen is editing |
| All-products list | One paged admin list that is not scoped to a single category |
