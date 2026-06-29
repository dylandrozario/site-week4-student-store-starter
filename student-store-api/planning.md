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

**Practical guardrail for the API layer (not the schema):** the `DELETE /products/:id` handler should probably warn / require confirmation if the product is referenced by any non-cancelled order. That belongs in the route, not the database — the schema's job is to enforce the cascade, not to second-guess it.

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

Fetch every order. Each order includes its line items.

- **Default sort:** `ORDER BY created_at DESC` — newest first, so the customer sees their most recent order at the top.
- **Query params (optional):** `?customer_id=<email>` to support the stretch "filter by email" feature.
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

Fetch one order with its line items.

- **Route param:** `order_id`.
- **Success — `200 OK`:** single order object with embedded `orderItems` (same shape as above).
- **Error — `404`:** order doesn't exist.
  ```json
  { "error": "Order not found" }
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
      { "order_item_id": 2, "order_id": 42, "product_id": 12, "quantity": 1, "price": "0.00"  }
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
- **`status` validation:** if provided, must be one of `"pending"` / `"completed"` / `"cancelled"`. Any other value → `400 { "error": "status must be one of: pending, completed, cancelled" }`. The column itself is a free-form `String` in the schema; the route enforces the allow-list rather than a Prisma enum so we can extend it without a migration.
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

- **Success — `200 OK`:** array of OrderItem objects.

### `POST /orders/:order_id/items`

Add a new line item to an existing order.

- **Route param:** `order_id`.
- **Request body:** `{ "product_id": 7, "quantity": 2 }`.
- **Server snapshots `Product.price` into the new line item, the same way `POST /orders` does.**
- **Open question (deferred):** does adding an item also update the parent order's `total_price`? Section 1 deliberately treats `total_price` as a snapshot, so adding items here would either (a) leave `total_price` stale or (b) require a recompute. Decide when implementing — flagging it now so the decision is conscious.
- **Success — `201 Created`:** the new line item.
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
| GET    | `/order-items` *(stretch)*    | All line items                       | 200     | 500           |
| POST   | `/orders/:order_id/items` *(stretch)* | Add item to order            | 201     | 404, 409      |

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

### 2. Look up every referenced product

```js
const productIds = items.map(i => i.product_id);
const products = await prisma.product.findMany({
  where: { id: { in: productIds } },
});
```

One round trip, not N. Returns at most N rows.

### 3. Check for missing products (existence check)

```js
if (products.length !== new Set(productIds).size) {
  const found = new Set(products.map(p => p.id));
  const missing = productIds.find(id => !found.has(id));
  return res.status(409).json({ error: `Product not found: id ${missing}` });
}
```

If even one `product_id` from the request doesn't exist, the whole order is rejected. **Nothing has been written yet** — the DB state is identical to before the request. This is by design: the existence check runs *outside* the transaction precisely so we don't need the transaction to roll it back.

Status code is `409 Conflict`, not `404`. The request body is structurally valid; the conflict is between the request and current DB state.

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

### 5. Write everything in one transaction

```js
const created = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
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
  return order;
});
```

A few things make this atomic:

- **Prisma's nested `create`** issues the `Order` insert and all `OrderItem` inserts inside one DB transaction. Either every row commits, or none does.
- The `tx` callback form means: if any statement inside throws, Prisma rolls the whole transaction back. No partial state ever becomes visible to another query.
- `include: { orderItems: true }` returns the freshly-written order with its items already attached — exactly the shape the response promises.

### 6. Respond

```js
return res.status(201).json(created);
```

Response body matches the contract in Section 2: full order with embedded `orderItems`, server-generated `order_id` / `created_at`, computed `total_price`, snapshotted per-line `price`.

## What does the client see in each failure mode?

| When | Status | Body | DB state after |
| --- | --- | --- | --- |
| Body missing `customer_id` / `items` empty | `400` | `{ "error": "items must be a non-empty array" }` | unchanged |
| `items[i].quantity` is `0` or negative | `400` | `{ "error": "quantity must be ≥ 1" }` | unchanged |
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

The one implementation detail that wasn't in the spec but didn't require a spec change: Prisma's `update` and `delete` throw error code `P2025` when the target row doesn't exist. The route handlers catch that specifically and return `404`. The spec already promised `404` for those cases; the `P2025` mapping is just *how* the route fulfills that promise.
