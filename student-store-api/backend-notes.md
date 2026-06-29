# Backend Notes — Cheat Sheet for a New Learner

A reference for when I forget what each piece of the backend does.

---

## The big picture

A backend is a program that:

1. Listens for HTTP requests (`GET /products`, `POST /orders`, etc.)
2. Does something with a database (read / write / update / delete)
3. Sends a response back

That's it. Every backend in the world is some version of that loop. The complexity comes from **how the code is organized** to do it.

---

## The pipeline — how a request flows through layers

```
   Browser/Postman sends an HTTP request
              │
              ▼
   ┌────────────────────────┐
   │      server.js         │   "I'm the front door."
   │   (entry point + CORS) │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │       routes/          │   "I'm the receptionist."
   │  (URL → controller)    │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │     controllers/       │   "I'm the manager."
   │  (HTTP-aware logic)    │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │       models/          │   "I'm the worker."
   │  (DB operations)       │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │    Prisma Client       │   "I'm the translator."
   │  (JS → SQL bridge)     │
   │   (via src/db/db.js)   │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │      Postgres          │   "I'm the warehouse."
   │  (the actual database) │
   └────────────────────────┘
```

**Key rule:** Each layer only talks to the one below it.

- The model has no idea HTTP exists.
- The route doesn't know what database you're using.
- This separation = if you swap one piece, you don't touch the rest.

> **In this project**, the route and controller layers are split into separate files for each resource:
> `src/routes/products.js` + `src/controllers/products.js`,
> `src/routes/orders.js` + `src/controllers/orders.js`,
> `src/routes/orderItems.js` + `src/controllers/orderItems.js`.
> `server.js` only boots the app and mounts the routers.

---

## What each piece does

### `server.js` — the entry point

The file that runs when I type `npm run dev`.

Its jobs:

1. **Create the Express app** — `const app = express();`
2. **Register CORS middleware** — restrict which origins (browsers from which URLs) can talk to this API
3. **Register `express.json()`** — so JSON request bodies get parsed into `req.body`
4. **Mount the routers** — `app.use("/products", productsRouter)`, etc.
5. **Listen on a port** — `app.listen(PORT, ...)` (uses `process.env.PORT` so Render can override in production)

Without `server.js`, nothing runs. Everything else is imported by it.

**About CORS in this project:**

```js
const allowedOrigins = [
  "http://localhost:5173",                                              // local Vite dev
  "https://site-week4-student-store-starter-frontend-gds6.onrender.com", // deployed frontend
];
```

Browsers will block JS fetches across origins by default. The CORS middleware tells the browser "yes, this origin is allowed." Requests with no `Origin` header (curl, Postman, server-to-server) are also allowed through so I can hit the API from tools during development.

### `src/db/db.js` — the shared Prisma client

```js
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
module.exports = prisma
```

One file. Three jobs:

1. **Load `.env`** — `dotenv.config()` reads `DATABASE_URL` (the Postgres connection string) so Prisma can find the database.
2. **Create exactly one PrismaClient** — every model imports the same instance.
3. **Export it** — `require("../db/db")` everywhere else.

**Why one shared client?** Each `new PrismaClient()` opens its own pool of database connections. If every model file made its own, I'd run out of connections fast — especially on a serverless host. One client, one pool, everyone uses it.

### `routes/` — the receptionist

In this project, routes live in `src/routes/products.js`, `src/routes/orders.js`, and `src/routes/orderItems.js`. They look like:

```js
const express = require("express");
const productsController = require("../controllers/products");

const router = express.Router();

router.get("/", productsController.list);
router.get("/:id", productsController.get);
router.post("/", productsController.create);
router.put("/:id", productsController.update);
router.delete("/:id", productsController.remove);

module.exports = router;
```

Then `server.js` does `app.use("/products", productsRouter)` — meaning "everything starting with `/products` goes to this router."

The orders router also has a **nested route**:

```js
router.post("/:order_id/items", ordersController.addItem);
```

This means `POST /orders/42/items` is still an "orders" operation conceptually — adding an item to *order 42* — so it lives in the orders router, not in the order-items router. (More on this in the `addItem` section below.)

**Why split them out?** Once you have 20+ endpoints, `server.js` becomes unreadable. Even with a dozen endpoints like this project, separating routes from controllers means each file does one thing: routes wire URLs to functions; controllers do the actual request handling.

### `controllers/` — the manager

The function that runs when a route matches. In this project, controllers live in `src/controllers/products.js`, `src/controllers/orders.js`, and `src/controllers/orderItems.js`. Each controller exports named functions (`list`, `get`, `create`, `update`, `remove`, `addItem`) that the matching route file wires up.

The controller's job:

1. **Read the request** — `req.params.id`, `req.query.category`, `req.body.name`
2. **Validate** — "Is id an integer? Is customer_id present? Is status one of the allowed values?"
3. **Call the model** — `await Product.create({ ... })`
4. **Translate model output to HTTP response** — pick the status code (200/201/204/400/404/409/500), format the body, send it
5. **Catch errors** — translate custom error classes and Prisma error codes into appropriate HTTP responses

The controller is **HTTP-aware**. It knows about `req`, `res`, status codes. The model below it doesn't.

Example:

```js
async function get(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Product id must be an integer" });
  }
  try {
    const product = await Product.get(id);          // ← calls the model
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json(product);                  // ← formats HTTP response
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
}
```

### `models/` — the worker

A thin wrapper around Prisma calls. **The only place in the app that talks to the database.**

```js
class Product {
  static async get(id) {
    return prisma.product.findUnique({ where: { id } });
  }
  static async create(data) {
    return prisma.product.create({ data });
  }
}
```

What's missing on purpose:

- **No HTTP.** No `req`, no `res`, no status codes.
- **No validation.** The model trusts the controller did it.
- **No error formatting.** Model throws — controller catches.

**Why this separation matters:**

- Same logic can be reused from scripts, cron jobs, tests
- If the database changes, only this layer changes
- The controller stays focused on the request/response cycle

### Prisma (the library)

Prisma does three big things:

#### 1. Defines the schema in code (`schema.prisma`)

```prisma
model Product {
  id    Int     @id @default(autoincrement())
  name  String
  price Decimal @db.Decimal(10, 2)
}
```

This is Prisma's own language — not SQL.

#### 2. Generates a typed JavaScript client

When `prisma generate` runs (happens automatically during migrations), Prisma scans `schema.prisma` and creates JS methods like `prisma.product.findMany()` in `node_modules/@prisma/client`. Add a new model → new methods appear automatically.

#### 3. Generates SQL migrations

When I change `schema.prisma` and run `prisma migrate dev`, Prisma:

- Compares my schema to the current DB
- Figures out the difference
- Writes the SQL that turns the DB into the new shape
- Runs that SQL
- Saves the SQL as a file in `prisma/migrations/`

**Mental model:** I describe the destination, Prisma figures out how to get there. I never write `CREATE TABLE` myself.

### Migrations

A migration is **a SQL file** that says "do this to the database." Prisma writes them for me.

Example:

```sql
CREATE TABLE "Order" (
  "order_id"    SERIAL NOT NULL,
  "customer_id" TEXT NOT NULL,
  "total_price" DECIMAL(10,2) NOT NULL,
  ...
);
```

**Why migrations exist instead of modifying the DB directly:**

- Teammates need to catch up — they run the same files
- Production needs the same changes — same files
- New developers need to see the history — it's all in git

Every change is a file, checked into git, with a timestamp. `prisma migrate dev` applies any that haven't run yet, in order.

In this project:

```
prisma/migrations/
  ├─ 20260622222420_init_products_table/
  ├─ 20260623040211_init_orders_table/
  └─ 20260623141417_init_order_items_table/
```

---

## Why both Orders AND OrderItems?

This is the conceptual leap that trips most people up.

### The naive approach (broken)

```
Order
  order_id: 42
  customer_id: ada@codepath.org
  items: [Hydroflask, Notebook, Mug]
```

Questions you can't answer:

- "How many Hydroflasks did Ada buy?" → no idea, just a name
- "What did she pay for each?" → unknown
- "Sort orders by total quantity" → impossible
- "Find all orders that contained product 7" → would have to scan every row's array

Items need their **own data** (quantity, price), so they need their own table.

### The relational way

```
Product table             Order table              OrderItem table
─────────────             ───────────              ───────────────
id  name      price       order_id  customer       order_item_id  order_id  product_id  qty  price
1   Hydro     34.99       42        ada@...        1              42        1           3    34.99
2   Notebook  19.99                                 2              42        2           1    19.99
3   Mug       9.99                                  3              42        3           2    9.99
```

Each OrderItem says: *"On order 42, the customer bought 3 of product 1 at $34.99 each."*

### Why OrderItem exists

OrderItem isn't a "thing" in the real world. There's no such thing as an "order item" outside a database.

But the **relationship between an Order and a Product carries data**:

- How many of *this product* on *this order* (quantity)
- What was paid for *this product* on *this order* at the moment of sale (price)

That data:

- Doesn't belong on Product (its current price might change)
- Doesn't belong on Order (one order has many products at different prices)
- Belongs in a third table that represents the intersection

This pattern is called a **join table** or **junction table**.

### Other examples of join tables

| Many-to-many | Join table | Data on the relationship |
| --- | --- | --- |
| Students ↔ Classes | Enrollment | grade, year |
| Movies ↔ Actors | Casting | role name, top-billed |
| **Orders ↔ Products** | **OrderItem** | **quantity, price** |

Whenever something is "many-to-many" AND the relationship has its own data, you need a join table.

### Concrete example — Ada's order

Ada buys 3 Hydroflasks, 1 Notebook, 2 Mugs.

**Order table — one new row:**

```
order_id  customer_id      total_price  status
42        ada@codepath.org 124.95       pending
```

**OrderItem table — three new rows:**

```
order_item_id  order_id  product_id  quantity  price
1              42        1           3         34.99    ← 3 × Hydroflask
2              42        2           1         19.99    ← 1 × Notebook
3              42        3           2         9.99     ← 2 × Mug
```

Each OrderItem points back to Order 42 (via `order_id`) and points at a Product (via `product_id`). The product's *name* isn't repeated — the OrderItem just refers to it.

### Why this is powerful

Once data is structured this way:

- **"Top 5 best-selling products"** → `GROUP BY product_id, SUM(quantity)` on OrderItem
- **"Total revenue from clothing"** → join OrderItem with Product, filter, sum
- **"Did Ada ever buy a Hydroflask?"** → one query

All trivial. If items were buried inside Order rows as a list, all of these would require painful scanning.

### Why the cascade rules make sense

OrderItem is the **bridge** between Order and Product:

- Delete a Product → the bridges to it are meaningless → delete them
- Delete an Order → the bridges from it are meaningless → delete them

But:

- Delete a Product → don't delete the Order (it's a real historical event)
- Delete an Order → don't delete the Product (it lives in the catalog independently)

**OrderItem is dependent. Order and Product are independent.**

In the schema, this is enforced with `onDelete: Cascade` on the OrderItem's foreign keys:

```prisma
order   Order   @relation(fields: [order_id], references: [order_id], onDelete: Cascade)
product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
```

Postgres takes care of the deletion automatically when the parent row goes away. The app code never has to manually clean up OrderItems.

### Indexes on the join table

The schema has `@@index([order_id])` and `@@index([product_id])` on OrderItem, plus `@@index([customer_id])` on Order. An **index** is a precomputed lookup that makes filtering on that column fast. Without an index, asking "all OrderItems where order_id = 42" forces Postgres to scan every row. With one, it's near-instant. We add indexes to the columns we filter by — foreign keys and frequently-queried fields.

---

## The full endpoints list

| Method | URL | What it does |
| --- | --- | --- |
| GET    | `/`                       | Health check — returns a welcome string |
| GET    | `/products`               | List products. Optional `?category=clothing&sort=price&order=asc` |
| GET    | `/products/:id`           | Get one product |
| POST   | `/products`               | Create a product (all 5 fields required) |
| PUT    | `/products/:id`           | Update a product |
| DELETE | `/products/:id`           | Delete a product (cascades to its OrderItems) |
| GET    | `/orders`                 | List orders. Optional `?customer_id=ada@...&sort=total_price&order=desc` |
| GET    | `/orders/:order_id`       | Get one order + its items |
| POST   | `/orders`                 | Create an order with items in one shot |
| POST   | `/orders/:order_id/items` | Add another item to an existing order (or increment if duplicate) |
| PUT    | `/orders/:order_id`       | Update an order's `customer_id` and/or `status` |
| DELETE | `/orders/:order_id`       | Delete an order (cascades to its OrderItems) |
| GET    | `/order-items`            | List OrderItems. Optional `?order_id=42&product_id=1` |

### Query parameters (filtering & sorting)

- **`GET /products?category=clothing`** — only products in that category
- **`GET /products?sort=price&order=asc`** — sort by price ascending. Allowed sort fields: `id`, `name`, `price`, `created_at`. Allowed orders: `asc`, `desc`. Anything else falls back to defaults.
- **`GET /orders?customer_id=ada@...`** — only this customer's orders
- **`GET /orders?sort=total_price&order=desc`** — most-expensive first. Allowed sort fields: `order_id`, `customer_id`, `total_price`, `created_at`.
- **`GET /order-items?order_id=42`** — only items on order 42
- **`GET /order-items?product_id=1`** — only items referencing product 1

**Why the allowlist in the model?** If I let the caller pass any string into `orderBy`, they could potentially trigger errors or unexpected behavior. The `SORTABLE_FIELDS` set in each model is the gatekeeper — unknown fields silently fall back to the default.

---

## Money math — `Prisma.Decimal`

Why isn't `total_price` a regular JavaScript number?

Because JS numbers are floating-point, and `0.1 + 0.2` is `0.30000000000000004`. Cents drift. After enough orders, the total is wrong by pennies — and a financial system that's wrong by pennies is a financial system that's wrong.

So:

- The schema declares `price Decimal @db.Decimal(10, 2)` — Postgres stores exact decimals with up to 10 digits, 2 after the dot.
- Prisma reads them into JS as `Prisma.Decimal` objects, not numbers.
- All arithmetic uses `.add()`, `.mul()`, etc., never `+` or `*`:

```js
const total_price = lineItems.reduce(
  (sum, li) => sum.add(li.price.mul(li.quantity)),
  new Prisma.Decimal(0),
);
```

When JSON-serialized in a response, the Decimal becomes a string like `"124.95"`. The frontend should parse it as a string for display and only convert to a number for arithmetic if absolutely needed.

---

## Transactions — all-or-nothing writes

Creating an order means **two writes**: one row in `Order`, then one-or-more rows in `OrderItem`. If the Order row inserts but the OrderItem rows fail halfway, I have an order with zero items — a phantom record that breaks reports.

A **transaction** wraps multiple writes so they all succeed together or all roll back together. Either the Order *and* its items exist, or neither does. Never in-between.

In Prisma:

```js
return prisma.$transaction(async (tx) => {
  return tx.order.create({
    data: {
      customer_id,
      total_price,
      orderItems: { create: lineItems },
    },
    include: { orderItems: true },
  });
});
```

Two things to notice:

1. Inside the callback, use `tx` (the transaction handle), not `prisma`. That's what makes queries part of the transaction.
2. Prisma also supports **nested writes** (`orderItems: { create: lineItems }`) which already happen as a single atomic SQL transaction even without `$transaction`. The wrapper here makes it explicit and lets us add additional queries inside the same transaction later (which `addItem` does).

The SQL Postgres actually runs:

```sql
BEGIN;
INSERT INTO "Order" (...) VALUES (...);
INSERT INTO "OrderItem" (...) VALUES (...), (...), (...);
COMMIT;
```

If any of those `INSERT`s fail, Postgres `ROLLBACK`s — nothing is left behind.

---

## `POST /orders/:order_id/items` — adding to an existing order

This endpoint is more involved than it looks. Walk through the logic in `Order.addItem`:

```
1. Open a transaction
2. Look up the order — if missing, throw OrderNotFoundError → controller returns 404
3. Look up the product — if missing, throw MissingProductError → controller returns 409
4. Check if a line item already exists for (order_id, product_id):
     - If yes → UPDATE the existing row, adding to its quantity
     - If no  → CREATE a new line item with the product's current price
5. Re-read all line items on the order
6. Recompute total_price from scratch as Σ(price × quantity)
7. UPDATE the order with the new total_price
8. Return the updated order with all items included
```

**Why merge instead of inserting a second row?** Otherwise you'd see two rows for the same product on the same order (`product_id: 1, qty: 3` and `product_id: 1, qty: 2`), which is messy and makes "how many of X did this order have?" require a sum instead of a lookup. This mirrors the same merge rule used by `POST /orders` when the incoming `items` array has duplicates.

**Why recompute the total from scratch instead of just adding?** Defensive. If anything ever drifts (rounding, a race, a manual DB edit), the total gets corrected the next time someone adds an item. Always trust the line items as the source of truth; never trust an accumulated total.

**Why wrap all of it in a transaction?** Three writes (line item insert/update + order total update). If any fails, none should land — same reason as `createWithItems`.

---

## Custom error classes — `MissingProductError`, `OrderNotFoundError`

In `models/order.js`:

```js
class MissingProductError extends Error {
  constructor(missingId) {
    super(`Product not found: id ${missingId}`);
    this.name = "MissingProductError";
    this.missingId = missingId;
  }
}
```

**Why bother making a custom error class instead of just `throw new Error(...)`?**

Because the controller needs to know *what kind* of failure happened to pick the right HTTP status code:

```js
try {
  const order = await Order.createWithItems({ customer_id, items });
  res.status(201).json(order);
} catch (err) {
  if (err instanceof Order.MissingProductError) {
    return res.status(409).json({ error: err.message });   // 409 Conflict
  }
  console.error(err);
  res.status(500).json({ error: "Failed to create order" }); // any other failure
}
```

With a generic `Error`, the controller would have to string-match on `err.message` — fragile. With a custom class, `instanceof` is exact.

**Why 409 Conflict?** The request is well-formed (valid JSON, integer IDs, valid quantities) — it just refers to a product that doesn't exist. That's a "your request conflicts with the current state of the system" error, not a "your request is malformed" (400) error. 409 is the right code for "the request makes sense but I can't fulfill it because of how things stand right now."

---

## Prisma error codes — `P2025`

When Prisma's `update` or `delete` runs against a row that doesn't exist, it throws an error with `err.code === "P2025"`. We use that to return a clean 404:

```js
catch (err) {
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Order not found" });
  }
  console.error(err);
  res.status(500).json({ error: "Failed to update order" });
}
```

This is cleaner than doing a `findUnique` first to check existence and then `update` — that's two queries and a race condition. Let Prisma try the update, then react to its error.

Other Prisma error codes I might see eventually:
- `P2002` — unique constraint violation (e.g., trying to insert a duplicate primary key)
- `P2003` — foreign key constraint violation (e.g., creating an OrderItem with a `product_id` that doesn't exist — though we catch this earlier with our own check)
- Prisma's full reference: https://www.prisma.io/docs/orm/reference/error-reference

---

## Status validation — `VALID_STATUSES`

Orders have a `status` field. The schema declares it as a plain `String` (Postgres-level enums add migration complexity), so the model enforces the allowed values in JS:

```js
const VALID_STATUSES = new Set(["pending", "completed", "cancelled"]);
```

The controller checks against this set on `PUT /orders/:order_id`:

```js
if (status !== undefined && !Order.VALID_STATUSES.has(status)) {
  return res.status(400).json({ error: "status must be one of: pending, completed, cancelled" });
}
```

`undefined` is allowed because `PUT` is a partial update in this project — you might be updating only `customer_id`. Only reject `status` when it was explicitly provided AND invalid.

---

## Seeding — getting demo data into the database

`npm run seed` runs `seed.js`, which:

1. **Wipes everything** — `deleteMany()` on OrderItem, Order, then Product (in that order — children before parents, because of foreign keys).
2. **Loads JSON** — reads `data/products.json` and `data/orders.json`.
3. **Creates products** with explicit IDs (so the seed orders can refer to them).
4. **Creates orders** with their nested `orderItems` in a single Prisma call (nested write).
5. **Bumps the Postgres sequences** — explained below.

### Why the `setval` calls at the end?

Postgres `SERIAL` columns use a hidden sequence (a counter) to generate the next ID. When the seed script inserts rows with **explicit IDs** (e.g., `id: 1`, `id: 2`, ... `id: 12`), the sequence doesn't move — it still thinks the next ID to hand out is `1`. The next time the API tries to `POST /products` without specifying an ID, Postgres tries `id: 1`, collides with the seeded row, and the insert fails.

`SELECT setval(...)` manually fast-forwards the sequence past the highest seeded ID, so future auto-generated IDs start from there:

```sql
SELECT setval(pg_get_serial_sequence('"Product"', 'id'),
              COALESCE((SELECT MAX(id) FROM "Product"), 1), true)
```

Translation: "Set the Product table's id-sequence to MAX(id), and mark it as 'already used' so the next request gets MAX(id) + 1."

Done for all three tables (`Product.id`, `Order.order_id`, `OrderItem.order_item_id`) because the seed sets explicit IDs on all of them.

---

## Full trace — what happens on `POST /orders`

```
1. Browser sends POST http://localhost:3000/orders
   body: { customer_id: "ada@...", items: [{ product_id: 1, quantity: 3 }] }

2. server.js is listening on port 3000 — receives the request

3. CORS middleware checks the Origin header — allowed, lets it through

4. express.json() middleware parses the JSON body → req.body

5. Router matching: app.use("/orders", ordersRouter) routes to it,
   then router.post("/", ordersController.create) matches

6. Controller (create in src/controllers/orders.js) validates:
   - customer_id is a string ✓
   - items is non-empty array ✓
   - each item has integer product_id + quantity ≥ 1 ✓

7. Controller calls the model:
   await Order.createWithItems({ customer_id, items })

8. Order.createWithItems in src/models/order.js:
   - Merges duplicate product_ids (a duplicate becomes one line with summed qty)
   - prisma.product.findMany(...) → look up referenced products
   - Verifies all exist (throws MissingProductError if not → controller returns 409)
   - Snapshots prices from the looked-up products, computes total with Prisma.Decimal
   - prisma.$transaction → prisma.order.create({ ..., orderItems: { create: lineItems } })

9. Prisma Client translates that JS call into SQL — a transaction:
   BEGIN
     INSERT INTO "Order" (...) VALUES (...)
     INSERT INTO "OrderItem" (...) VALUES (...), (...)
   COMMIT
   (either all succeed or all roll back)

10. Postgres executes the SQL. Transaction commits.

11. Data flows back UP:
    Prisma returns the created order object (with orderItems included)
    → model returns it to the controller
    → controller calls res.status(201).json(order)
    → Express writes the JSON to the HTTP response
    → browser receives 201 Created with the new order body
```

Every layer did its one job. The model never touched HTTP. The route never wrote SQL. Prisma was the translator.

---

## Restaurant analogy (when I'm confused)

| Backend piece | Restaurant equivalent |
| --- | --- |
| HTTP request from browser | Customer walks in, says what they want |
| `server.js` | The restaurant itself — building, hours |
| CORS middleware | Bouncer — checks which neighborhoods customers are allowed in from |
| `express.json()` middleware | The host who reads the order request |
| Route in `routes/` | Host says "sit at table 5, server is Maria" |
| Controller | Maria takes the order, sends it to the kitchen |
| Model | The cook — gets order, makes food, hands it back |
| `src/db/db.js` | The kitchen's shared phone line to the pantry |
| Prisma | Kitchen translator — "Caesar salad" → recipe |
| Postgres | The pantry — where ingredients live |
| Migration | "This week we changed a recipe — here's how" |
| `schema.prisma` | The current recipe book |
| Transaction | Don't serve the entrée unless the appetizer is also ready — bring it all or nothing |
| Seed script | The owner stocking the pantry before opening day |

Customer never sees the kitchen. Host never cooks. Cook never talks to customer. Each role has one job — that's what keeps things sane.

---

## Status codes used in this project

| Code | Meaning | When we return it |
| --- | --- | --- |
| 200 | OK | Successful GET or PUT (response includes the resource) |
| 201 | Created | Successful POST (response includes the new resource) |
| 204 | No Content | Successful DELETE (no response body) |
| 400 | Bad Request | The request itself is malformed (missing fields, non-integer where integer expected, invalid status value) |
| 404 | Not Found | The resource doesn't exist (caught explicitly with a `findUnique` check, or from Prisma's P2025 on update/delete) |
| 409 | Conflict | The request is well-formed but conflicts with current state (e.g., referencing a product that doesn't exist when creating an order) |
| 500 | Server Error | Anything else — usually means I have a bug. Logged to `console.error` so I can see what blew up. |

---

## Quick reference — common terms

| Term | What it means |
| --- | --- |
| **HTTP request** | A message from a client (browser, Postman) asking the server to do something |
| **HTTP method / verb** | `GET` (read), `POST` (create), `PUT` (update), `DELETE` (delete) |
| **Status code** | A number returned with every response: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 404 Not Found, 409 Conflict, 500 Server Error |
| **Middleware** | A function that runs on every request before the route handler (e.g., `cors()`, `express.json()`) |
| **CORS** | Cross-Origin Resource Sharing — browser security mechanism that decides whether a JS fetch from origin A is allowed to hit API on origin B |
| **Route** | A pairing of (URL + method) → function |
| **Controller** | The function that handles a route — validates input, calls the model, sends response |
| **Model** | The class that talks to the database |
| **ORM** | "Object-Relational Mapper" — Prisma is an ORM. It turns JS objects/calls into SQL |
| **Schema** | The shape of the database — what tables and columns exist |
| **Migration** | A SQL file that changes the schema; checked into git |
| **Primary key (PK)** | A unique identifier column — `id`, `order_id`, etc. |
| **Foreign key (FK)** | A column that points at another table's primary key |
| **Cascade delete** | When deleting row A automatically deletes rows in another table that referenced A |
| **Index** | A precomputed lookup that makes filtering by a given column fast |
| **Transaction** | A group of database writes that succeed or fail together — never partially |
| **Join table** | A table whose only job is to represent a many-to-many relationship and carry its data |
| **Decimal** | An exact-arithmetic numeric type — used instead of float for money |
| **Sequence** | A Postgres counter that hands out the next auto-increment ID. Needs `setval` after manual ID inserts. |
| **Singleton** | Exactly one instance of something shared everywhere (our PrismaClient in `src/db/db.js`) |
| **`P2025`** | Prisma error code for "tried to update/delete a row that doesn't exist" — we catch it and return 404 |

---

## Past Orders — how the frontend uses the API

The Past Orders feature is two React components calling two backend endpoints. Each component does one thing and stays simple.

### Two screens, two components

- **`PastOrders.jsx`** — the table at `/orders` showing every order
- **`OrderDetail.jsx`** — the single-order page at `/orders/:order_id` you reach by clicking "View →"

That's it for the UI side. Each hits one backend endpoint and renders what comes back.

### `PastOrders.jsx` — the list

Three pieces of state matter:

```js
const [orders, setOrders] = useState([])             // the rows in the table
const [filterInput, setFilterInput] = useState("")    // what's typed in the box
const [activeFilter, setActiveFilter] = useState("")  // what was last submitted
```

The work is one function:

```js
const fetchOrders = async (customerFilter) => {
  const url = customerFilter
    ? `${API_URL}/orders?customer_id=${encodeURIComponent(customerFilter)}`
    : `${API_URL}/orders`
  const response = await axios.get(url)
  setOrders(response.data)
}
```

It calls `GET /orders` (or `GET /orders?customer_id=ada@...` if a filter is set) and dumps the result into state. Three things trigger it:

1. **On mount** — `useEffect(() => { fetchOrders("") }, [])` loads all orders when the page opens.
2. **On submit** — the form's `onSubmit` calls `fetchOrders(trimmedInput)` with the typed value.
3. **On clear** — the Clear button resets state and calls `fetchOrders("")` again.

Each row in the table comes from `orders.map(...)` and shows `order_id`, `created_at`, `customer_id`, `status`, `total_price`, plus a `<Link to={\`/orders/${order.order_id}\`}>` that routes to the detail page.

### What the backend returns

`GET /orders` runs `Order.list(...)` in `src/models/order.js`:

```js
return prisma.order.findMany({
  where: customer_id ? { customer_id } : undefined,
  orderBy: { [sortField]: sortOrder },     // defaults to created_at desc
  include: { orderItems: true },           // pulls line items too
})
```

Two important details:

- **`include: { orderItems: true }`** — each order in the response carries its line items array. The list view doesn't display them, but the detail view will use them without making a second request.
- **`where: customer_id ? { customer_id } : undefined`** — if a filter was provided, Postgres only returns matching rows; otherwise everything.

So one order coming back looks like:

```json
{
  "order_id": 42,
  "customer_id": "ada@codepath.org",
  "total_price": "124.95",
  "status": "pending",
  "created_at": "2026-06-20T14:30:00.000Z",
  "orderItems": [
    { "order_item_id": 1, "order_id": 42, "product_id": 1, "quantity": 3, "price": "34.99" }
  ]
}
```

### `OrderDetail.jsx` — one order

When you click "View →", react-router sends you to `/orders/42`. `useParams()` grabs `42` from the URL, and the effect fires:

```js
useEffect(() => {
  const response = await axios.get(`${API_URL}/orders/${order_id}`)
  setOrder(response.data)
}, [order_id])
```

That hits `GET /orders/:order_id`, which runs `Order.get(order_id)` — same shape as above (one order with its `orderItems` included).

Error handling is the interesting part:

```js
if (err.response?.status === 404 || err.response?.status === 400) {
  setNotFound(true)        // show <NotFound /> — the URL was bad
} else {
  setError("Failed to load order. Is the API running?")  // real error
}
```

- **404** = the order doesn't exist (backend returns this from `Order.get` returning `null`)
- **400** = `order_id` wasn't an integer (e.g., `/orders/abc`) — controller rejects it
- **Anything else** = network/server problem

### Line items render

The detail page maps `order.orderItems` into a table. Two small things:

```js
const productById = products.reduce((acc, p) => { acc[p.id] = p; return acc }, {})
```

The `products` prop comes from `App.jsx` (already loaded for the storefront). The detail page **looks up the product name from that map** instead of asking the API again, because the OrderItem only stores `product_id` and the historical `price` — not the product name. (Why not? Because product names can change, but the price paid at the moment of sale shouldn't — same reason `price` is snapshotted onto OrderItem in the first place.)

```js
const lineTotal = Number(item.price) * item.quantity
```

The price comes back as a string (because of `Prisma.Decimal` — see the Money math section), so it's coerced to a number for display math only.

### The end-to-end picture

```
User opens /orders
    │
    ▼
PastOrders mounts → useEffect → axios.get('/orders')
    │
    ▼
Express → ordersRouter → controllers/orders.js list()
    │
    ▼
Order.list() → prisma.order.findMany({ include: { orderItems: true } })
    │
    ▼
Postgres returns rows → Prisma → JSON response
    │
    ▼
setOrders(response.data) → table renders
    │
    ▼  (user clicks "View →" on order 42)
    ▼
Router navigates to /orders/42
    │
    ▼
OrderDetail mounts → useParams → axios.get('/orders/42')
    │
    ▼
Same backend pipeline → returns one order with its orderItems
    │
    ▼
setOrder(response.data) → meta + line items table renders
```

Two simple GETs, one with an optional `?customer_id=` filter, and React renders what comes back. The complexity that's *not* on the frontend — totals, joins, formatting — was done once on the backend or in the seed, so the frontend just displays.

---

## When in doubt — questions to ask

- "Which layer am I in?" → that tells me what I should and shouldn't be doing
- "Is this HTTP-aware or DB-aware?" → controller is HTTP, model is DB
- "Should this be wrapped in a transaction?" → if you're doing more than one write and they need to land together, yes
- "Should this be a custom error class?" → if the controller needs to map it to a specific HTTP status, yes
- "Where would I look this up later?" → think about that before writing code
- "What's the smallest piece I can ship to test this works?" → don't try to do everything at once
