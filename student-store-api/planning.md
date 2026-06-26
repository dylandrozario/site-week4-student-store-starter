# Student Store — Planning

## Data Models

Three models, taken from the required features in `overview.md`: **Product**, **Order**, **OrderItem**. `OrderItem` is the join row between an `Order` and the `Product`s in it, and stores per-line data (quantity, price snapshot).

---

### Product

Represents an item available for sale in the store.

| Field         | Prisma type | Required? | Default        | Notes                                         |
| ------------- | ----------- | --------- | -------------- | --------------------------------------------- |
| `id`          | `Int`       | required  | `autoincrement()` | Primary key                                   |
| `name`        | `String`    | required  | —              |                                               |
| `description` | `String`    | required  | —              |                                               |
| `price`       | `Decimal`   | required  | —              | Money — `@db.Decimal(10, 2)` (up to 99,999,999.99, two decimal places) |
| `image_url`   | `String`    | required  | —              |                                               |
| `category`    | `String`    | required  | —              |                                               |
| `created_at`  | `DateTime`  | required  | `now()`        | Useful for sorting / debugging                |
| `orderItems`  | `OrderItem[]` | (relation) | —            | Back-reference; not a real column             |

**Primary key:** `id`, auto-incrementing integer.

**Relationships:** One `Product` → many `OrderItem`s (a product can appear in many orders' line items).

**Cascade behavior:** Deleting a `Product` **cascades** — every `OrderItem` whose `product_id` points to it is also deleted. This is the rule from the required features.

---

### Order

Represents a single purchase placed by a customer.

| Field         | Prisma type | Required? | Default          | Notes                                                       |
| ------------- | ----------- | --------- | ---------------- | ----------------------------------------------------------- |
| `order_id`    | `Int`       | required  | `autoincrement()` | Primary key                                                 |
| `customer_id` | `String`    | required  | —                | Non-empty string; the frontend treats it as an email but the API does **not** validate format or check uniqueness. No `Customer` table — `customer_id` is an opaque string. |
| `total_price` | `Decimal`   | required  | —                | Snapshot of cart total at order time — `@db.Decimal(10, 2)` |
| `status`      | `String`    | required  | `"pending"`      | e.g. `pending` / `completed` / `cancelled`                  |
| `created_at`  | `DateTime`  | required  | `now()`          |                                                             |
| `orderItems`  | `OrderItem[]` | (relation) | —              | Back-reference                                              |

**Primary key:** `order_id`, auto-incrementing integer.

**Relationships:** One `Order` → many `OrderItem`s.

**Cascade behavior:** Deleting an `Order` **cascades** — every `OrderItem` whose `order_id` points to it is also deleted. Required-features rule.

**Index:** `@@index([customer_id])`. The "filter orders by email" stretch feature queries on this column on every request; without an index, Postgres scans the whole table.

---

### OrderItem

Represents a single line on an order: "this order contains N units of this product at this price." Sits at the join between `Order` and `Product`.

| Field           | Prisma type | Required? | Default          | Notes                                                                                                |
| --------------- | ----------- | --------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `order_item_id` | `Int`       | required  | `autoincrement()` | Primary key                                                                                          |
| `order_id`      | `Int`       | required  | —                | **Foreign key** → `Order.order_id`                                                                   |
| `product_id`    | `Int`       | required  | —                | **Foreign key** → `Product.id`                                                                       |
| `quantity`      | `Int`       | required  | —                |                                                                                                      |
| `price`         | `Decimal`   | required  | —                | **Snapshot** of the product's price at order time — never read live from `Product` (price can change). `@db.Decimal(10, 2)` |
| `order`         | `Order`     | (relation) | —              | `@relation(fields: [order_id], references: [order_id], onDelete: Cascade)`                           |
| `product`       | `Product`   | (relation) | —              | `@relation(fields: [product_id], references: [id], onDelete: Cascade)`                               |

**Primary key:** `order_item_id`, auto-incrementing integer.

**Foreign keys:** Two — `order_id` and `product_id`. Both are required (every line item must belong to an order *and* reference a product).

**Cascade behavior:** Both incoming relations cascade. Deleting an `Order` removes its items; deleting a `Product` removes its items.

---

## Cascade Delete Rules — Plain Language

Required features mandate two rules:

1. **Delete a Product → delete every OrderItem that references it.**
2. **Delete an Order → delete every OrderItem that references it.**

`OrderItem` is downstream of *both* rules at once. It will never become an orphan: if either parent disappears, the line item disappears with it.

What does *not* cascade:

- Deleting a Product does **not** delete the Orders that contained it. Only the line items are removed.
- Deleting an Order does **not** delete the Products it contained. Products are independent of any single order.

---

## The Intersection Problem — What Happens to an Order When a Product Inside It Is Deleted?

This is the question the brief flags: `OrderItem` lives at the intersection of two cascade rules, so I need a deliberate answer before touching `schema.prisma`.

**Scenario:** An `Order` exists with three `OrderItem`s — one of those items references a `Product` that gets deleted.

**What the cascade rule does:** The `OrderItem` row pointing at the deleted product is removed. The `Order` itself stays. The other two `OrderItem`s stay. The order's `total_price` column is *not* recomputed — it was a snapshot written at order creation time.

**The consequence:** The order's stored `total_price` no longer equals the sum of its remaining line items. From the customer/admin's view, the order is now an incomplete record of what was purchased.

**The tradeoffs I considered:**

| Option | Behavior | Why I rejected it |
| --- | --- | --- |
| **A. Cascade (chosen)** | Delete the OrderItem with the product. Order keeps original `total_price`. | Required by the spec. Loses some line-item history. |
| B. Restrict | Block deleting a Product if any OrderItem references it. | Violates the spec's cascade requirement. |
| C. Soft-delete the Product | Add an `is_deleted` flag instead of a real delete; OrderItems stay intact. | Spec asks for actual cascade delete, and adds a column the UI doesn't need yet. |
| D. Set null | Set `OrderItem.product_id` to null when the product is deleted. | Requires `product_id` to be nullable, which would let bad rows exist at insert time too. |

**My decision:** Use Option A — cascade, as the spec requires. Accept that the consequence is occasional drift between an order's `total_price` and the sum of its surviving items. Mitigate it by treating `OrderItem.price` as a permanent snapshot (already in the schema), so the *line items that remain* still hold accurate historical pricing. If product-deletion-during-active-orders becomes a real concern later, that's the moment to reconsider — but design for the spec now, not for hypotheticals.

**Practical guardrail for the API layer (not the schema):** the `DELETE /products/:id` controller should probably warn / require confirmation if the product is referenced by any non-cancelled order. That belongs in the controller, not the database — the schema's job is to enforce the cascade, not to second-guess it.

---

# Section 2 — API Contract

Every endpoint required by `overview.md`, with request shape, success shape, and at least one error case.

## Conventions (apply to every endpoint)

**Base URL:** `/` (mounted at the root of the Express app — no `/api` prefix; the spec doesn't ask for one).

**CORS:** Milestone 6 will add `app.use(cors())` to allow the Vite frontend (`localhost:5173`) to call the API (`localhost:3000`) cross-origin. Default (allow-all) is fine for a localhost-only student project.

**Content type:** all request and response bodies are JSON. `Content-Type: application/json` on every POST/PUT.

**Money fields** (`price`, `total_price`) are returned as strings, not numbers. Prisma serializes `Decimal` as a string to avoid the float precision problem (`"19.99"`, not `19.99`). The frontend should `Number()` them at the edge.

**Timestamps** (`created_at`) are returned as ISO 8601 strings (`"2026-06-17T14:23:11.000Z"`).

**Standard error shape** — used by *every* error response in the API:

```json
{ "error": "Human-readable message describing what went wrong" }
```

That's it. One field. No error codes, no nested objects, no stack traces. Predictable for the frontend and easy to render. Stretch later: add an `error.code` enum if specific UI flows need to branch on error type.

**Standard error status codes:**

| Code | Meaning in this API |
| --- | --- |
| `400` | Request body is malformed or missing required fields |
| `404` | The resource at this `:id` does not exist |
| `409` | Business-rule conflict (e.g., POST /orders references a product that doesn't exist) |
| `500` | Unhandled server error — the catch-all |

---

## Product endpoints

### `GET /products`

Fetch every product in the catalog.

- **Request:** none.

#### Query Parameters

All parameters are optional and can be combined (e.g., `?category=kitchen&sort=price&order=asc`).

| Param | Values | Default | Behavior |
| --- | --- | --- | --- |
| `category` | any string (e.g., `kitchen`, `clothing`) | none | Filters to products whose `category` exactly matches the value. Unknown categories return `[]` (200, not 404 — the request itself is valid). Case-sensitive. |
| `sort` | `id` / `name` / `price` / `created_at` | `id` | Column to order results by. Any value outside the allow-list is ignored and the default applies — silently, no 400. |
| `order` | `asc` / `desc` | `asc` | Sort direction. Anything else falls back to `asc`. |

**Default behavior (no params):** return all products, sorted by `id ASC`. The spec earlier called this "stable, predictable order for a catalog" — same intent, now made explicit via the `sort` default. A request with `?sort=` set to nothing is treated the same as the no-param case.

**Example requests:**

- `GET /products` → every product, ordered by `id ASC`.
- `GET /products?category=kitchen` → only kitchen items, ordered by `id ASC`.
- `GET /products?sort=price` → all products, cheapest first.
- `GET /products?sort=price&order=desc` → all products, most expensive first.
- `GET /products?sort=name` → all products, alphabetical by name.
- `GET /products?category=clothing&sort=price&order=desc` → most expensive clothing first.

**Why allow-list `sort` instead of passing it through to Prisma:** an attacker (or a buggy frontend) could otherwise sort by a column that doesn't exist or that we don't want exposed. The allow-list is one line of code and closes that hole.

- **Success — `200 OK`:**
  ```json
  [
    {
      "id": 1,
      "name": "Hydroflask",
      "description": "32oz insulated water bottle",
      "price": "34.99",
      "image_url": "https://.../hydroflask.png",
      "category": "kitchen",
      "created_at": "2026-06-17T14:23:11.000Z"
    }
  ]
  ```
- **Error — `500`:** database is unreachable.
  ```json
  { "error": "Failed to fetch products" }
  ```

### `GET /products/:id`

Fetch one product by its primary key.

- **Route param:** `id` (integer).
- **Success — `200 OK`:** single product object (same shape as one element of `GET /products`).
- **Error — `404`:** no product with that id.
  ```json
  { "error": "Product not found" }
  ```
- **Error — `400`:** `id` is not a valid integer (e.g., `/products/abc`).
  ```json
  { "error": "Product id must be an integer" }
  ```

### `POST /products`

Create a new product.

- **Request body:** all fields required.
  ```json
  {
    "name": "Hydroflask",
    "description": "32oz insulated water bottle",
    "price": "34.99",
    "image_url": "https://.../hydroflask.png",
    "category": "kitchen"
  }
  ```
- **Success — `201 Created`:** the created product, including the database-assigned `id` and `created_at`.
- **Error — `400`:** missing or invalid field.
  ```json
  { "error": "Missing required field: name" }
  ```

### `PUT /products/:id`

Update an existing product. Partial updates allowed — only the fields you send are changed.

- **Route param:** `id`.
- **Request body:** any subset of `{ name, description, price, image_url, category }`.
- **Success — `200 OK`:** the updated product.
- **Error — `404`:** product doesn't exist.
  ```json
  { "error": "Product not found" }
  ```

### `DELETE /products/:id`

Delete a product. Cascade-deletes its OrderItems (per the schema rule).

- **Route param:** `id`.
- **Success — `204 No Content`:** empty body. (Could also be `200` with `{ "deleted": true }` — going with `204` because there's nothing meaningful to return.)
- **Error — `404`:** product doesn't exist.

---

## Order endpoints

### `GET /orders`

Fetch every order. Each order includes its line items. This endpoint powers two UI features: the **Past Orders page** (lists every order the user has placed) and the **email filter** (narrows the list to a single customer's orders).

#### Query Parameters

All parameters are optional and can be combined (e.g., `?customer_id=ada@codepath.org&sort=total_price&order=desc`).

| Param | Values | Default | Behavior |
| --- | --- | --- | --- |
| `customer_id` | any non-empty string (the frontend treats it as email) | none | Filters to orders whose `customer_id` exactly matches the value. Unknown values return `[]` (200, not 404). Case-sensitive. This is the "filter by email" stretch feature. |
| `sort` | `order_id` / `customer_id` / `total_price` / `created_at` | `created_at` | Column to order results by. Values outside the allow-list silently fall back to the default (no 400). |
| `order` | `asc` / `desc` | `desc` | Sort direction. Anything else falls back to `desc`. |

**Default behavior (no params):** return all orders, sorted by `created_at DESC` — newest first, so the customer sees their most recent order at the top. Matches the stretch "Past Orders page" UX expectation.

**Example requests:**

- `GET /orders` → every order, newest first.
- `GET /orders?customer_id=ada@codepath.org` → only Ada's orders, newest first.
- `GET /orders?sort=total_price&order=desc` → all orders, biggest spenders first.
- `GET /orders?customer_id=ada@codepath.org&sort=total_price&order=desc` → Ada's orders, most expensive first.

**Why allow-list `sort` instead of passing it through to Prisma:** same reason as `GET /products` — defends against ORM injection and surfaces the queryable fields as part of the API contract.

- **Success — `200 OK`:**
  ```json
  [
    {
      "order_id": 42,
      "customer_id": "ada@codepath.org",
      "total_price": "104.97",
      "status": "pending",
      "created_at": "2026-06-17T14:23:11.000Z",
      "orderItems": [
        {
          "order_item_id": 1,
          "order_id": 42,
          "product_id": 7,
          "quantity": 3,
          "price": "34.99"
        }
      ]
    }
  ]
  ```

### `GET /orders/:order_id`

Fetch one order with its line items. This is the endpoint behind the **individual order detail page** — the page a user reaches by clicking a row on the Past Orders page.

- **Route param:** `order_id` (integer).
- **Success — `200 OK`:** single order object with embedded `orderItems` (same shape as `GET /orders`'s array elements).
- **Error — `404`:** order doesn't exist.
  ```json
  { "error": "Order not found" }
  ```
- **Error — `400`:** `order_id` is not a valid integer (e.g., `/orders/abc`).
  ```json
  { "error": "order_id must be an integer" }
  ```

### `POST /orders` ⭐ — the transactional endpoint

This is the most complex endpoint. It creates an Order **and** its OrderItems in a single database transaction. Either both succeed or both fail — no half-created orders.

- **Request body:**
  ```json
  {
    "customer_id": "ada@codepath.org",
    "items": [
      { "product_id": 7, "quantity": 3 },
      { "product_id": 12, "quantity": 1 }
    ]
  }
  ```
  - `customer_id` — required, string (email).
  - `items` — required, non-empty array. Each item needs `product_id` and `quantity` (≥ 1).
  - `status` — **not** in the request. Defaults to `"pending"` from the schema.
  - `total_price` — **not** in the request. The server computes it from the products' current prices ✕ quantities. Trusting the client's total invites tampering.
  - `price` per line item — **not** in the request. The server snapshots `Product.price` at the moment of creation (this is what makes `OrderItem.price` a historical record, per Section 1).

- **Server-side flow:**
  1. Validate body shape.
  2. Look up every `product_id` from `items`. If any is missing → `409` (see below).
  3. Compute `total_price = Σ(product.price × item.quantity)`.
  4. In one Prisma `$transaction`: create the Order, then create all OrderItems with the snapshotted prices.
  5. Return the created order with its items.

- **Success — `201 Created`:** the full order including server-generated fields and the line items.
  ```json
  {
    "order_id": 42,
    "customer_id": "ada@codepath.org",
    "total_price": "104.97",
    "status": "pending",
    "created_at": "2026-06-17T14:23:11.000Z",
    "orderItems": [
      { "order_item_id": 1, "order_id": 42, "product_id": 7,  "quantity": 3, "price": "34.99" },
      { "order_item_id": 2, "order_id": 42, "product_id": 12, "quantity": 1, "price": "19.99" }
    ]
  }
  ```

- **Error — `400`:** missing/empty `items`, missing `customer_id`, or a quantity ≤ 0.
  ```json
  { "error": "items must be a non-empty array" }
  ```
- **Error — `409`:** request references a product that doesn't exist. Picked `409 Conflict` over `404` because the request itself is well-formed — the conflict is with current database state.
  ```json
  { "error": "Product not found: id 999" }
  ```

### `PUT /orders/:order_id`

Update an order. Primary use is changing `status`.

- **Route param:** `order_id`.
- **Request body:** any subset of `{ customer_id, status }`. **`total_price` and `orderItems` are not editable here** — line-item changes go through dedicated endpoints (or a stretch endpoint), not a generic order update. Mixing them invites bugs where total_price drifts from the items.
- **`status` validation:** if provided, must be one of `"pending"` / `"completed"` / `"cancelled"`. Any other value → `400 { "error": "status must be one of: pending, completed, cancelled" }`. The column itself is a free-form `String` in the schema; the controller (with the allow-list exposed as `Order.VALID_STATUSES`) enforces the values rather than a Prisma enum so we can extend the list without a migration.
- **Success — `200 OK`:** the updated order.
- **Error — `404`:** order doesn't exist.

### `DELETE /orders/:order_id`

Delete an order. Cascade-deletes its OrderItems.

- **Route param:** `order_id`.
- **Success — `204 No Content`:** empty body.
- **Error — `404`:** order doesn't exist.

---

## Stretch endpoints (documented now, implemented later)

### `GET /order-items`

List every line item across the database. Useful for admin views.

- **Query params (optional):**
  - `?order_id=<int>` → filter to line items belonging to one order
  - `?product_id=<int>` → filter to line items referencing one product
  - Both can combine.
- **Success — `200 OK`:** array of OrderItem objects.
- **Error — `400`:** `order_id` or `product_id` query param present but not an integer.
- **Error — `500`:** database failure.

### `POST /orders/:order_id/items`

Add a new line item to an existing order.

- **Route param:** `order_id`.
- **Request body:** `{ "product_id": 7, "quantity": 2 }`.
- **Server snapshots `Product.price` into the new line item, the same way `POST /orders` does.**
- **Decided:** the endpoint **recomputes `total_price` after the insert** so the order's stored total stays consistent with the sum of its items. Wrapped in a `$transaction` along with the insert (and any quantity-merge on an existing line) so both writes commit together. The price snapshot rule from Section 1 still holds — each `OrderItem.price` is frozen at insert time; only `total_price` re-derives.
- **Duplicate `product_id` behavior:** if the order already has a line item for this product, the quantity is added to the existing row rather than creating a second one (matches the merge rule from `POST /orders`).
- **Success — `201 Created`:** the full updated order, with the new/updated `orderItems` and the recomputed `total_price`.
- **Error — `400`:** missing or invalid `product_id` / `quantity`, or non-integer `order_id` in the URL.
- **Error — `404`:** parent order doesn't exist.
- **Error — `409`:** referenced product doesn't exist.

---

## Endpoint summary table

| Method | Path                          | Purpose                              | Success | Common errors |
| ------ | ----------------------------- | ------------------------------------ | ------- | ------------- |
| GET    | `/products`                   | List all products (optional `?category`) | 200 | 500           |
| GET    | `/products/:id`               | One product                          | 200     | 400, 404      |
| POST   | `/products`                   | Create product                       | 201     | 400           |
| PUT    | `/products/:id`               | Update product                       | 200     | 400, 404      |
| DELETE | `/products/:id`               | Delete product (cascade)             | 204     | 404           |
| GET    | `/orders`                     | List all orders (optional `?customer_id`) | 200 | 500           |
| GET    | `/orders/:order_id`           | One order + items                    | 200     | 404           |
| POST   | `/orders`                     | **Transactional create**             | 201     | 400, 409      |
| PUT    | `/orders/:order_id`           | Update order (status, customer)      | 200     | 404           |
| DELETE | `/orders/:order_id`           | Delete order (cascade)               | 204     | 404           |
| GET    | `/order-items`                | All line items (optional `?order_id` / `?product_id`) | 200 | 400, 500 |
| POST   | `/orders/:order_id/items`     | Add item to existing order (recomputes total_price) | 201 | 400, 404, 409 |

---

# Section 3 — Transactional Flow

`POST /orders` is the only endpoint in this API that writes to more than one table. It creates one `Order` row and N `OrderItem` rows, and the database must end up in one of two states only: **all rows written**, or **no rows written**. Anything in between is a half-created order — a row in `Order` with no matching items, or items orphaned to an `order_id` that doesn't exist. Both are bugs that are painful to debug and worse to clean up.

This section walks through exactly what happens at the data layer when the endpoint is hit.

## The request

```json
POST /orders
Content-Type: application/json

{
  "customer_id": "ada@codepath.org",
  "items": [
    { "product_id": 7,  "quantity": 3 },
    { "product_id": 12, "quantity": 1 }
  ]
}
```

The client sends only what it knows: who is ordering and what they want. It does **not** send prices or a total — those come from the server's view of the `Product` table at the moment the order is placed. Trusting client-supplied prices would let any caller pay $0 for anything.

## Step-by-step

### 1. Validate the request body (before any DB call)

Cheap, pure-function checks. Fail fast with `400` before touching the database.

- `customer_id` is present and a non-empty string.
- `items` is an array with length ≥ 1.
- Every element of `items` has an integer `product_id` and an integer `quantity ≥ 1`.

If anything fails → `400 { "error": "<which field>" }`. No DB writes yet, so no rollback concern.

**Then: merge duplicate `product_id`s.** If the same product appears more than once in `items`, sum the quantities into a single entry before continuing:

```js
const merged = new Map();
for (const { product_id, quantity } of items) {
  merged.set(product_id, (merged.get(product_id) ?? 0) + quantity);
}
const items = [...merged.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
```

This matches how a real shopping cart behaves (clicking "add" twice doesn't create two lines) and avoids two `OrderItem` rows that point at the same product on the same order — which would force every "how many of product X is in this order?" query to do a `SUM`.

**Response-shape consequence:** if the client sent `items: [{product_id: 7, quantity: 1}, {product_id: 7, quantity: 2}]`, the response's `orderItems` array contains **one** entry with `quantity: 3`, not two entries. Frontends consuming the response should not assume `response.orderItems.length === request.items.length`.

### 2. Look up every referenced product

```js
const productIds = items.map(i => i.product_id);
const products = await prisma.product.findMany({
  where: { id: { in: productIds } },
});
```

One round trip, not N. Returns at most N rows.

### 3. Check for missing products (existence check)

The model checks every requested `product_id` against the rows returned in step 2. If any is missing, throw a typed error and let the controller decide what to do with it:

```js
// in models/order.js
const productMap = new Map(products.map(p => [p.id, p]));
for (const id of productIds) {
  if (!productMap.has(id)) {
    throw new MissingProductError(id);
  }
}
```

```js
// in controllers/orders.js — translates the typed error into an HTTP response
} catch (err) {
  if (err instanceof Order.MissingProductError) {
    return res.status(409).json({ error: err.message });
  }
  // ...
}
```

If even one `product_id` from the request doesn't exist, the whole order is rejected. **Nothing has been written yet** — the DB state is identical to before the request. This is by design: the existence check runs *outside* the transaction precisely so we don't need the transaction to roll it back.

Status code is `409 Conflict`, not `404`. The request body is structurally valid; the conflict is between the request and current DB state.

**Why the model throws instead of returning a status code directly:** the model has no knowledge of HTTP — that's the controller's job. The model's contract is "do the database work or throw a typed error explaining why you can't." Keeping it HTTP-free means the same model methods are reusable from scripts, tests, or future endpoints without dragging Express into them. `MissingProductError` is exported on the `Order` module so the controller can `err instanceof Order.MissingProductError` to map it cleanly.

### 4. Snapshot prices and compute the total

```js
const priceById = new Map(products.map(p => [p.id, p.price]));

const lineItems = items.map(item => ({
  product_id: item.product_id,
  quantity:   item.quantity,
  price:      priceById.get(item.product_id),   // Decimal — snapshot
}));

const total_price = lineItems.reduce(
  (sum, li) => sum.add(li.price.mul(li.quantity)),
  new Prisma.Decimal(0),
);
```

Two things to notice:

- `price` on each line item is the **current** `Product.price`, captured *now* and frozen into `OrderItem.price`. Section 1 calls this the snapshot — it's why an order's history stays accurate even if a product's price changes later (or the product is deleted).
- `total_price` is computed with `Prisma.Decimal`, not JavaScript `Number`. Adding `0.1 + 0.2` in JS gives `0.30000000000000004`; for money, that's a bug waiting to happen.

### 5. Open the transaction and write atomically

This is the only step that actually writes to the database. The Order insert and all `OrderItem` inserts are wrapped in an explicit `prisma.$transaction(...)` block, with the nested write doing the actual inserts inside it:

```js
return prisma.$transaction(async (tx) => {
  return tx.order.create({
    data: {
      customer_id,
      total_price,
      // status defaults to "pending" per the schema
      orderItems: {
        create: lineItems,   // nested write — all items created in the same tx
      },
    },
    include: { orderItems: true },
  });
});
```

A few things make this atomic:

- **`prisma.$transaction` opens a single database transaction** and gives the callback a transactional client (`tx`). Every Prisma call made on `tx` runs inside that transaction.
- **The nested `create`** issues the `Order` insert and all `OrderItem` inserts together. Because they share the `tx` client, they all participate in the same transaction.
- **If any statement inside throws**, Prisma rolls the whole transaction back. No partial state ever becomes visible to another query.
- **`include: { orderItems: true }`** returns the freshly-written order with its items already attached — exactly the shape the response promises.

**Why use the explicit `$transaction` wrapper here:** the nested `create` alone is already atomic in Prisma. Wrapping it in `$transaction` is technically belt-and-suspenders for this single-call case, but it makes the transactional intent obvious to anyone reading the code, and it provides a natural place to add more transactional steps later (e.g., decrementing product stock) without restructuring the call.

### 6. Respond

The model returns the created order (with embedded `orderItems`) to the controller. The controller wraps it in an HTTP response:

```js
// in controllers/orders.js
const order = await Order.createWithItems({ customer_id, items });
res.status(201).json(order);
```

Response body matches the contract in Section 2: full order with embedded `orderItems`, server-generated `order_id` / `created_at`, computed `total_price`, snapshotted per-line `price`.

## What does the client see in each failure mode?

| When | Status | Body | DB state after |
| --- | --- | --- | --- |
| `customer_id` missing or not a string | `400` | `{ "error": "Missing required field: customer_id" }` | unchanged |
| `items` missing, not an array, or empty | `400` | `{ "error": "items must be a non-empty array" }` | unchanged |
| `items[i].product_id` is not an integer | `400` | `{ "error": "Each item must have an integer product_id" }` | unchanged |
| `items[i].quantity` is not an integer ≥ 1 | `400` | `{ "error": "Each item must have an integer quantity ≥ 1" }` | unchanged |
| `items` references a `product_id` that doesn't exist | `409` | `{ "error": "Product not found: id 999" }` | unchanged |
| Transaction throws partway through (e.g. DB connection drops mid-write) | `500` | `{ "error": "Failed to create order" }` | unchanged — Prisma rolls back |
| Success | `201` | full order with items | one new `Order` row + N new `OrderItem` rows, all committed together |

The invariant the transaction protects: **the database is never in a state where an `Order` exists without its full set of `OrderItem`s.** Every other failure mode is caught before the transaction begins, so rollback only has to handle the rare case where the DB itself fails mid-write.

## Why not just create the Order first, then loop and create items?

That's the naive version — it works on the happy path and breaks on every failure path. If the loop dies on item 3 of 5, the `Order` row is already committed and now has two children instead of five. The `total_price` stored on that order doesn't match its items. The customer sees an order they didn't fully place. There's no automatic cleanup.

Wrapping the writes in `$transaction` costs nothing extra in code complexity and makes the failure mode "no order created, retry the request" instead of "partial order created, please call support."

## Known race condition (accepted)

There is a sub-millisecond window between step 3 (the existence check) and step 5 (the transaction commit) where a product could be deleted by a concurrent `DELETE /products/:id` request. If that happens, Prisma's nested `create` throws a foreign-key constraint violation, the transaction rolls back, and the client receives a generic `500` instead of the friendly `409` the existence check would have produced.

Behavior remains **correct** — no half-created order, no orphaned rows. Only the error message degrades.

The proper fix would move the existence check inside the transaction with row-level locks (`SELECT ... FOR UPDATE`). That's a database-locking concept worth more complexity than this project warrants, and the only client that can delete products is the admin UI. Accepting the tradeoff and moving on.

---

# Decisions Log — Product Model

## Schema translation that went smoothly

The `price` field translation worked cleanly. Spec said `Decimal @db.Decimal(10, 2)`; Prisma generated `numeric(10, 2) NOT NULL` in Postgres and serializes the value back as a string (`"34.99"`) over JSON — confirmed in the POST response from Postman. Treating money as `Decimal` (not `Float`) avoided the `0.1 + 0.2 = 0.30000000000000004` floating-point trap before it could happen. The `@default(now())` on `created_at` and `@default(autoincrement())` on `id` translated to `DEFAULT CURRENT_TIMESTAMP` and a sequence-backed default with zero extra work — the response includes both fields populated even though POST didn't send them.

## Field decision I made during implementation that wasn't in the original spec

None for the `Product` model itself — all seven fields from Section 1 made it through to the schema unchanged. The implementation decision that *did* surface was at the model layer (`src/models/product.js`): I used **static class methods** (`Product.list()`, `Product.create()`, etc.) instead of free-standing functions or instance methods. The spec doesn't dictate this; I picked it because (a) the class becomes a namespace for product queries with no awkward instantiation, and (b) it keeps the controller calls readable (`Product.create(...)` reads like "create a product" rather than "call this function on a singleton"). Worth recording because the same pattern will apply to `Order` and `OrderItem` and I want to be consistent.

I also named the delete method `Product.remove` instead of `Product.delete` — `delete` is a reserved word in JavaScript and even though it works as a method name, avoiding it sidesteps a class of subtle parser issues.

## Route behavior that needed a spec update

No spec changes. Every route behaved exactly as Section 2 described:

- `GET /products` → `200` + `[]` when empty, `200` + array when populated ✅
- `POST /products` → `201` + full product object with server-generated `id` and `created_at` ✅
- `GET /products/:id` → `200` for valid id, `404` for missing id, `400` for non-integer id ✅
- `PUT /products/:id` → `200` + updated product, partial updates work (sending only `price` left other fields intact) ✅
- `DELETE /products/:id` → `204` with empty body ✅

The one implementation detail that wasn't in the spec but didn't require a spec change: Prisma's `update` and `delete` throw error code `P2025` when the target row doesn't exist. The controller catches that specifically and returns `404`. The spec already promised `404` for those cases; the `P2025` mapping is just *how* the controller fulfills that promise.

---

# Codebase Layout (Post-Refactor)

The early commits had every route handler living inline in `src/server.js`. After the product and order routes were both built, that file hit ~200 lines with three concerns mixed together: HTTP request parsing, validation, and Prisma calls. It was refactored into the conventional layered structure:

```
src/
├── server.js                  Boot the Express app, register middleware,
│                              mount routers under URL prefixes, listen.
├── routes/
│   ├── products.js            Pure URL → controller mapping.
│   └── orders.js              No logic — just `router.get("/", controller.list)` etc.
├── controllers/
│   ├── products.js            HTTP-aware logic: read req, validate,
│   └── orders.js              call model, choose status code, format response.
└── models/
    ├── product.js             Database-only logic via Prisma. No knowledge
    ├── order.js               of HTTP. Throws typed errors; controller maps
    └── orderItem.js           them to status codes.
```

**Why the layers:**

- **`server.js`** is the only file that calls `app.listen()` and the only one that knows about middleware ordering. It mounts routers with `app.use("/products", productsRouter)` etc.
- **`routes/`** files are thin wiring — they convert (URL + HTTP verb) into "call this controller function." Reading one of them tells you every endpoint that resource exposes at a glance.
- **`controllers/`** is where the HTTP-aware work lives: pulling fields out of `req.body` / `req.params` / `req.query`, validating shapes, deciding on `400` vs `404` vs `409` vs `500`, calling `res.status(...).json(...)`.
- **`models/`** stays pure — never imports `express`, never sees a `req` or `res`. Returns data or throws a typed error (like `MissingProductError`). This means the same model methods would work from a CLI script, a cron job, or a test, without dragging HTTP into them.

**Boundary rule:** errors cross layer boundaries in one direction only. A Prisma error or a typed model error (`MissingProductError`, Prisma's `P2025`) bubbles up to the controller, which decides what HTTP status to translate it into. The model never returns a status code; the controller never builds a Prisma query.

This layout is recorded here in `planning.md` because every section above this one (Sections 2 and 3 in particular) implicitly assumes it — when Section 3 says "the model throws and the controller catches," that's the line being drawn.

---

# Spec Reconciliation — Milestone 4 (Schema Audit)

Audit performed by comparing `prisma/schema.prisma` against Section 1 of this document (Data Models) field-by-field, then verifying cascade behavior against the actual Postgres database with `psql \d "OrderItem"` and through the live API.

### Schema vs. spec gaps found

- **No field-level gaps in any of the three models.** Every field documented in Section 1 — name, type, default, `@db.Decimal(10, 2)` modifier, primary key, back-references — is present in `schema.prisma` and matches exactly. `Product` has all 7 spec fields, `Order` has all 5 + the `@@index([customer_id])` documented in Section 1, `OrderItem` has all 5 fields plus both `@relation` annotations with the FK targets and cascade rules.
- **Relationships are correctly modeled.** Both `@relation` annotations on `OrderItem` target the parent's actual primary key column — `Order.order_id` and `Product.id` — rather than assuming a generic `id`. Important because `Order`'s PK is `order_id`, not `id`.
- **Two schema additions not explicitly in the spec, both intentional:**
  - `@@index([order_id])` on `OrderItem`
  - `@@index([product_id])` on `OrderItem`
  These FK columns get queried on every `include: { orderItems: true }` (the `GET /orders/:order_id` flow) and every cascade-delete check. The indexes make those lookups use the index instead of a full table scan. Performance-only addition with no behavior change — not worth promoting to the spec, but noting here so future-me knows they exist by design.
- **Migration is named `init_order_items_table`** instead of the task's example `add_order_items_with_relations`. Both describe the migration accurately; mine follows the `init_*` pattern of the prior two migrations for consistency. Once applied, migration names are immutable (renaming them creates hash mismatches in the migration tracking table), so leaving it alone.

### Cascade delete verification

- **Deleting a Product removes associated OrderItems**: ✅ tested
  - Verified at the schema level: `OrderItem_product_id_fkey ... ON DELETE CASCADE` confirmed in `psql \d "OrderItem"` output.
  - Verified via Prisma Studio: deleted a Product that appeared in an OrderItem; the OrderItem row disappeared, the parent Order survived (with its now-stale `total_price` snapshot — the documented "intersection problem" behavior from Section 1).
  - Verifiable via API: `DELETE /products/:id` followed by `GET /orders/:order_id` shows the `orderItems` array shorter by one entry while the order itself remains.

- **Deleting an Order removes associated OrderItems**: ✅ tested
  - Verified at the schema level: `OrderItem_order_id_fkey ... ON DELETE CASCADE` confirmed in `psql \d "OrderItem"` output.
  - Verified via Prisma Studio and the live API: `DELETE /orders/:order_id` returns `204`; the corresponding OrderItem rows are gone; the referenced Products in the catalog are untouched.

Both cascade rules from Section 1 are enforced by Postgres itself, not by application code — even raw SQL bypassing Prisma would still trigger the cascade.

---

# Decisions Log — Order Creation Transaction

## What my Transactional Flow spec got right

The big structural choices held up:

- **Pulling prices server-side** rather than trusting the client. The spec calls this out as a security decision ("trusting client-supplied prices would let any caller pay $0") and that turned out to be the right framing — the implementation never had to relax it.
- **Running the existence check *before* the transaction.** This is the single highest-leverage decision in Section 3. It means the `409 Product not found` path requires zero rollback because nothing was ever written. It also keeps the transaction body tiny and predictable.
- **Snapshotting `Product.price` into `OrderItem.price`.** Confirmed in Postman: deleting a product later cascade-removes the OrderItem but the surviving items still hold accurate historical pricing — which is the *whole point* of the snapshot pattern.
- **Computing `total_price` with `Prisma.Decimal`, not JS `Number`.** Avoided the `0.1 + 0.2 = 0.30000000000000004` trap. The response correctly returns `"124.97"`, not `"124.96999999..."`.
- **Merging duplicate `product_id`s upstream** rather than letting them become two OrderItem rows. The implementation needed exactly the code sketch in Section 3 Step 1 with no modifications.

## What the spec missed that I discovered during implementation

Five spec-vs-code drifts surfaced during the milestone-4 audit and were reconciled into the spec:

1. **The spec showed `prisma.$transaction(async (tx) => ...)` but Step 5 was initially implemented as a bare nested `create`.** Prisma's nested write is automatically transactional, so behavior was correct, but the spec and the code didn't match. Resolved by wrapping the nested write in an explicit `$transaction` block — making the transactional intent visible and leaving room to add future steps (stock decrement, audit log) without restructuring.
2. **Step 3 of the spec used `res.status(409).json(...)` inside what should be model code.** The implementation correctly throws a typed `MissingProductError` from the model and lets the controller translate to `409`. Updated the spec to show this layering — model throws, controller catches.
3. **`MissingProductError` was undocumented.** The custom error class exists in code with a `missingId` property for programmatic access; it's now mentioned in the spec by name so any future endpoint that needs the same pattern knows what to import.
4. **The response example had a bogus `"price": "0.00"` for the notebook line item.** Off the cuff value from when the example was first written — replaced with `"19.99"` to match a realistic snapshot.
5. **The spec didn't warn that merged duplicates change the response shape.** If a client sends `[{product_id: 7, quantity: 1}, {product_id: 7, quantity: 2}]`, the response has **one** OrderItem with quantity 3, not two entries. Added a "Response-shape consequence" callout to Step 1 so frontends don't assume `response.orderItems.length === request.items.length`.

Also surfaced but already correct in the spec: the 5-bullet validation block (customer_id type, items array shape, integer product_id, integer quantity ≥ 1) maps 1:1 to the code's validation order.

## How the transaction error handling works

`prisma.$transaction(async (tx) => { ... })` opens a single database transaction (`BEGIN`), runs the callback you give it, and:

- **If the callback returns a value normally** → Prisma issues `COMMIT`. Every insert/update/delete made through the `tx` client becomes permanently visible to other queries, all at the same moment.
- **If the callback throws** (anything — a thrown error from your code, a Prisma validation error, a foreign-key violation, a network failure mid-write) → Prisma issues `ROLLBACK`. Every change attempted inside the callback is discarded. The database state is bit-for-bit identical to what it was before the transaction opened. No other query ever saw the in-progress writes — the transaction is **isolated**.

The `tx` client passed into the callback is critical: it's a special version of `prisma` that's bound to the open transaction. Calls to `tx.order.create(...)` participate in the rollback. Calls to the outer `prisma.order.create(...)` *inside* the same callback would run as their own separate, unrelated transactions and would NOT roll back if the surrounding `$transaction` failed. Always use `tx`.

For `POST /orders` specifically: the only thing inside the transaction is one nested `create` call. So in practice the failures Prisma has to roll back are narrow — a FK violation if a product was deleted between the existence check and the commit (the documented race condition), or a DB-level error like a dropped connection. The controller catches whatever bubbles up and translates it: `MissingProductError` → `409`, anything else → `500`. In both error cases the DB ends up unchanged.

## One thing I'd design differently if starting over

The validation chain in `controllers/orders.js` for `POST /orders` is currently a series of early-return `if` checks that fail on the *first* problem. So a request with both a missing `customer_id` and a malformed `items` array tells the client only about the customer_id problem; they fix it, resubmit, and now they hear about items. Two round trips to find out about two unrelated issues.

I'd build the validation as a single pass that collects every problem into one response: `{ error: "Validation failed", details: ["customer_id is required", "items[0].quantity must be ≥ 1"] }`. That changes the error shape from Section 2's strict `{ error: <string> }` contract though, so it's a deliberate tradeoff — better UX vs. predictable contract. If I were starting over knowing this project's scale, I'd extend the contract once at the top of Section 2 (`{ error: <string>, details?: string[] }`) and let multi-error responses use the optional `details` array. Frontend code that ignores `details` keeps working; new code can lean on it for better forms.

The other thing I'd reconsider: I exposed `MissingProductError` as a class on the `Order` module export, which works but feels off — domain errors arguably belong in their own `errors.js` module so any model can import `MissingProductError` or future siblings like `InsufficientStockError`. At three-line scale it doesn't matter, but it'd scale better.

---

# Spec Reconciliation — Milestone 6 (Frontend Integration Audit)

Audit performed by reading every component in `student-store-ui/src/` to map what the frontend expects vs. what the API contract in Section 2 promises. The starter UI imports `axios` in `App.jsx` and `ProductDetail.jsx` but never calls it — no fetches are currently in flight. The audit is therefore about *what the frontend will need when wired up*, based on the state shapes and field reads already in the code.

## What matches the spec already

Product fields the frontend reads (`id`, `name`, `description`, `price`, `image_url`, `category`) all map 1:1 to the `GET /products` response shape in Section 2. `formatPrice(product.price)` accepts a string Decimal without modification. No fields are missing on either side for product display, search, or category filtering.

## Mismatches found

### 1. Request body for `POST /orders`: `customer_id` vs. `name` + `dorm_number`

- **Spec wants:** `{ customer_id: "<email-shaped string>", items: [...] }`
- **Frontend has:** `userInfo = { name: "", dorm_number: "" }` (intended) and a partially-broken `PaymentInfo.jsx` form that writes `name` but reads `id` and writes `email` — three field names for two inputs.

**Resolution:** fix the form in `PaymentInfo.jsx` to capture a single email-shaped string, map it directly to `customer_id` in the request body. No spec change — Section 1 already documents `customer_id` as "the frontend treats it as an email but the API does not validate format."

### 2. Cart shape: object-by-id vs. items array

- **Spec wants:** `items: [{ product_id, quantity }, ...]`
- **Frontend has:** `cart = { "7": 3, "12": 1 }` (keys are stringified product IDs)

**Resolution:** transform at the boundary inside `handleOnCheckout` before POSTing — `Object.entries(cart).map(([id, quantity]) => ({ product_id: Number(id), quantity }))`. The cart object is fine for client-side use; convert at the wire. No spec change.

### 3. Response shape: `order.purchase.receipt.lines` doesn't exist in the spec

- **Spec returns:** `{ order_id, customer_id, total_price, status, created_at, orderItems: [...] }`
- **Frontend reads** (`CheckoutSuccess.jsx:11-13`): `order.purchase.receipt.lines[0]` plus `.slice(1).map(...)` — a presentation-layer "receipt lines" array that the API has no business producing.

**Resolution:** rewrite `CheckoutSuccess.jsx`'s `renderReceipt` to build the receipt UI from the real response shape — iterate `order.orderItems` to render line items, show `order.total_price` at the bottom, show `order.order_id` as the header. No spec change — pushing presentation concerns back to the frontend keeps the API response normalized and reusable.

### 4. No API base URL configured in the frontend

- **Backend mounted at:** `http://localhost:3000/` (root, no `/api` prefix — per Section 2 conventions)
- **Frontend has:** no reference to `localhost:3000`, no `VITE_API_URL`, no axios `baseURL` config

**Resolution:** add `VITE_API_URL=http://localhost:3000` to a `.env.local` in `student-store-ui/` and reference `import.meta.env.VITE_API_URL` in the axios calls. Hardcoding is also acceptable for a student project on localhost. No spec change.

### 5. CORS not yet enabled on the backend

- **Backend** runs on `localhost:3000`. **Frontend** runs on `localhost:5173` (Vite default). Cross-origin requests are blocked by default.
- **Already documented as deferred** in Section 2 conventions: *"Milestone 6 will add `app.use(cors())` to allow the Vite frontend to call the API cross-origin."*

**Resolution:** add `app.use(cors())` to `server.js` before mounting the routers. The `cors` package is already in `package.json` as a dependency. No spec change — this milestone is exactly when the documented deferral is meant to be resolved.

## Bottom line

**Zero spec changes needed.** All five mismatches are frontend-side or routing-config gaps. The starter UI was built around a hypothetical API that returned pre-formatted "receipt lines" and accepted user records with `name`/`dorm_number` fields — that's a different design than the one this project's spec describes. Reshape the frontend to match the spec, not the other way around.

## Implementation order

1. `app.use(cors())` in `server.js` — opens the cross-origin door.
2. `VITE_API_URL=http://localhost:3000` in `student-store-ui/.env.local` — gives the frontend a target.
3. `useEffect` in `App.jsx` that GETs `/products` on mount and `setProducts(response.data)` — smoke test; if this renders products, the wiring works.
4. Fix `PaymentInfo.jsx` form to capture one email-shaped string, store it as `userInfo.customer_id`.
5. Write `handleOnCheckout` in `App.jsx` to transform the cart, POST `/orders`, and `setOrder(response.data)` on success.
6. Rewrite `CheckoutSuccess.jsx`'s `renderReceipt` to render from the real response shape (`order.orderItems`, `order.total_price`, `order.order_id`).

## Frontend Behavior Notes (above the API spec)

A full-flow audit of the checkout path turned up three frontend behaviors that exist *above* the API contract — they aren't bugs, but a reader of Sections 2 and 3 alone wouldn't know they happen. Recording them here so the system's behavior is fully captured.

### 1. Frontend pre-validation before POST `/orders`

Before submitting an order, `App.jsx`'s `handleOnCheckout` runs the same two checks the backend runs:

- `userInfo.customer_id` non-empty → otherwise display `"Please enter your email before checking out."` and abort.
- `Object.keys(cart).length > 0` → otherwise display `"Your cart is empty."` and abort.

The backend still enforces both checks independently (it's the security boundary; the frontend is a UX optimization). A reader of Section 3 might expect the backend's `400 Missing required field: customer_id` to be the first place these errors surface — in practice, the frontend catches them and shows a friendlier message without making the round trip. Both messages describe the same logical error.

### 2. Cart clears on successful order

After a `201` response from `POST /orders`, `App.jsx` calls `setCart({})`. The spec doesn't require this — it's a deliberate frontend choice to prevent the same cart from being submitted twice if the user accidentally double-clicks Submit or navigates back to the sidebar. Once an order is created, the cart is conceptually "spent" and should not be reusable.

### 3. Receipt product names come from the local `products` cache, not the order response

`OrderItem` rows do **not** include the product's `name` — only its `product_id` (plus the price snapshot, quantity, etc.). The receipt in `CheckoutSuccess.jsx` joins the order's items against the locally-cached `products` array to render names. This is by design:

- `OrderItem.price` is a snapshot of the product's price at order time (Section 1's price-snapshot rule). Including `OrderItem.name` would either (a) require snapshotting the name too, doubling the historical-data surface, or (b) be a live join that becomes stale when the product is renamed or deleted.
- Keeping names out of `OrderItem` means the API response stays a clean record of *what was bought* (by ID + price), and the frontend handles the cosmetic concern of *what to call it*.

If the cached `products` array doesn't contain the referenced ID (e.g., the product was deleted after the order was placed), the receipt falls back to rendering `"Product #${item.product_id}"`. This is defensive code; in normal usage it never fires because the products fetch completes long before any order is placed in the same session.

## Frontend Routes

The frontend (React + React Router) exposes the following client-side routes. Each maps to one or more API endpoints. The API itself doesn't care which routes exist on the frontend, but recording them here makes the spec a complete map of both sides.

| Route | Purpose | API endpoints used |
| --- | --- | --- |
| `/` | Home — product grid with category sidebar and search | `GET /products` |
| `/:productId` | Product detail page | Reuses the cached `products` array from `/` — no per-product fetch needed |
| `/orders` | Past Orders page — list of every order placed, with an email filter input | `GET /orders` (optionally with `?customer_id=<email>` query param when the email filter is active) |
| `/orders/:order_id` | Individual order detail — full line-item breakdown | `GET /orders/:order_id` |

**Past Orders page behavior:**

- Renders one row per order showing `order_id`, `created_at`, `status`, and `total_price`.
- Has an email input + "Filter" button. Submitting the form re-fetches `GET /orders?customer_id=<email>` and replaces the list.
- A "Clear filter" button re-fetches `GET /orders` with no query params.
- Each row links to `/orders/:order_id` for the detail view.
- "No orders found" UI when the response is `[]` (which can happen either when the database is empty or when an email filter matches nothing — both render the same way since the API treats unknown customer_ids as a valid 200 with `[]`).

**Individual order detail page behavior:**

- Renders `order_id`, `customer_id`, `status`, `created_at`, and `total_price` at the top.
- Renders the `orderItems` array as a line-item table — each line shows quantity, product name (looked up against the cached `products` array, with the `"Product #${id}"` fallback per the receipt logic), unit price, and line total.
- "Back to Orders" link to `/orders`.
- `404` from the API (invalid `order_id`, or one that's been deleted) renders the existing `NotFound` component, not a crash.
