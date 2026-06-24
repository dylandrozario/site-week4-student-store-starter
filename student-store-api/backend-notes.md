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
   │   (entry point)        │
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

> **In this project**, the route and controller layers are split into separate files: `src/routes/products.js` + `src/controllers/products.js`, and the same for orders. `server.js` only boots the app and mounts the routers.

---

## What each piece does

### `server.js` — the entry point

The file that runs when I type `npm run dev`.

Its jobs:

1. **Create the Express app** — `const app = express();`
2. **Register middleware** — `app.use(express.json())` so JSON request bodies get parsed
3. **Define routes** — `app.get("/products", ...)` etc.
4. **Listen on a port** — `app.listen(3000, ...)`

Without `server.js`, nothing runs. Everything else is imported by it.

### `routes/` — the receptionist

In this project, routes live in `src/routes/products.js` and `src/routes/orders.js`. They look like:

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

**Why split them out?** Once you have 20+ endpoints, `server.js` becomes unreadable. Even with ~10 endpoints like this project, separating routes from controllers means each file does one thing: routes wire URLs to functions; controllers do the actual request handling.

### `controllers/` — the manager

The function that runs when a route matches. In this project, controllers live in `src/controllers/products.js` and `src/controllers/orders.js`. Each controller exports named functions (`list`, `get`, `create`, `update`, `remove`) that the matching route file wires up.

The controller's job:

1. **Read the request** — `req.params.id`, `req.query.category`, `req.body.name`
2. **Validate** — "Is id an integer? Is customer_id present?"
3. **Call the model** — `await Product.create({ ... })`
4. **Translate model output to HTTP response** — pick the status code (200/201/404/500), format the body, send it

The controller is **HTTP-aware**. It knows about `req`, `res`, status codes. The model below it doesn't.

Example:

```js
app.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Product id must be an integer" });
  }
  try {
    const product = await Product.get(id);          // ← calls the model
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json(product);                  // ← formats HTTP response
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});
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

---

## Full trace — what happens on `POST /orders`

```
1. Browser sends POST http://localhost:3000/orders
   body: { customer_id: "ada@...", items: [{ product_id: 1, quantity: 3 }] }

2. server.js is listening on port 3000 — receives the request

3. express.json() middleware parses the JSON body → req.body

4. Route matching: app.post("/orders", ...) matches → calls the handler

5. Handler (acts as controller) validates:
   - customer_id is a string ✓
   - items is non-empty array ✓
   - each item has integer product_id + quantity ≥ 1 ✓

6. Handler calls the model:
   await Order.createWithItems({ customer_id, items })

7. Order.createWithItems in models/order.js:
   - Merges duplicate product_ids
   - prisma.product.findMany(...) → look up referenced products
   - Verifies all exist (throws MissingProductError if not)
   - Snapshots prices, computes total with Prisma.Decimal
   - prisma.order.create({ ..., orderItems: { create: lineItems } })

8. Prisma Client translates that JS call into SQL — a transaction:
   BEGIN
     INSERT INTO "Order" (...) VALUES (...)
     INSERT INTO "OrderItem" (...) VALUES (...), (...)
   COMMIT
   (either all succeed or all roll back)

9. Postgres executes the SQL. Transaction commits.

10. Data flows back UP:
    Prisma returns the created order object
    → model returns it to the controller
    → controller calls res.status(201).json(order)
    → Express writes the JSON to the HTTP response
    → browser receives 201 Created
```

Every layer did its one job. The model never touched HTTP. The route never wrote SQL. Prisma was the translator.

---

## Restaurant analogy (when I'm confused)

| Backend piece | Restaurant equivalent |
| --- | --- |
| HTTP request from browser | Customer walks in, says what they want |
| `server.js` | The restaurant itself — building, hours |
| `express.json()` middleware | The host who reads the order request |
| Route in `server.js` | Host says "sit at table 5, server is Maria" |
| Controller / route handler | Maria takes the order, sends it to the kitchen |
| Model | The cook — gets order, makes food, hands it back |
| Prisma | Kitchen translator — "Caesar salad" → recipe |
| Postgres | The pantry — where ingredients live |
| Migration | "This week we changed a recipe — here's how" |
| `schema.prisma` | The current recipe book |

Customer never sees the kitchen. Host never cooks. Cook never talks to customer. Each role has one job — that's what keeps things sane.

---

## Quick reference — common terms

| Term | What it means |
| --- | --- |
| **HTTP request** | A message from a client (browser, Postman) asking the server to do something |
| **HTTP method / verb** | `GET` (read), `POST` (create), `PUT` (update), `DELETE` (delete) |
| **Status code** | A number returned with every response: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Server Error |
| **Middleware** | A function that runs on every request before the route handler (e.g., `express.json()`) |
| **Route** | A pairing of (URL + method) → function |
| **Controller** | The function that handles a route — validates input, calls the model, sends response |
| **Model** | The class that talks to the database |
| **ORM** | "Object-Relational Mapper" — Prisma is an ORM. It turns JS objects/calls into SQL |
| **Schema** | The shape of the database — what tables and columns exist |
| **Migration** | A SQL file that changes the schema; checked into git |
| **Foreign key (FK)** | A column that points at another table's primary key |
| **Cascade delete** | When deleting row A automatically deletes rows in another table that referenced A |
| **Transaction** | A group of database writes that succeed or fail together — never partially |
| **Join table** | A table whose only job is to represent a many-to-many relationship and carry its data |

---

## When in doubt — questions to ask

- "Which layer am I in?" → that tells me what I should and shouldn't be doing
- "Is this HTTP-aware or DB-aware?" → controller is HTTP, model is DB
- "Where would I look this up later?" → think about that before writing code
- "What's the smallest piece I can ship to test this works?" → don't try to do everything at once
