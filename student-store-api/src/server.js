const express = require("express");
const Product = require("./models/product");
const Order = require("./models/order");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the Student Store API!");
});

// GET /products — list all products (optional ?category, ?sort, ?order)
app.get("/products", async (req, res) => {
  try {
    const { category, sort, order } = req.query;
    const products = await Product.list({ category, sort, order });
    res.status(200).json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /products/:id — fetch one product
app.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Product id must be an integer" });
  }
  try {
    const product = await Product.get(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// POST /products — create a new product
app.post("/products", async (req, res) => {
  const { name, description, price, image_url, category } = req.body ?? {};
  const required = { name, description, price, image_url, category };
  for (const [field, value] of Object.entries(required)) {
    if (value === undefined || value === null || value === "") {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }
  try {
    const product = await Product.create({ name, description, price, image_url, category });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /products/:id — update an existing product (partial updates allowed)
app.put("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Product id must be an integer" });
  }
  const { name, description, price, image_url, category } = req.body ?? {};
  try {
    const product = await Product.update(id, { name, description, price, image_url, category });
    res.status(200).json(product);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /products/:id — delete a product (cascades to OrderItems once relation exists)
app.delete("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Product id must be an integer" });
  }
  try {
    await Product.remove(id);
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// GET /orders — list all orders (optional ?customer_id, ?sort, ?order)
app.get("/orders", async (req, res) => {
  try {
    const { customer_id, sort, order } = req.query;
    const orders = await Order.list({ customer_id, sort, order });
    res.status(200).json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /orders/:order_id — fetch one order
app.get("/orders/:order_id", async (req, res) => {
  const order_id = Number(req.params.order_id);
  if (!Number.isInteger(order_id)) {
    return res.status(400).json({ error: "order_id must be an integer" });
  }
  try {
    const order = await Order.get(order_id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(200).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /orders — create a new order (plain create; transactional flow comes later)
app.post("/orders", async (req, res) => {
  const { customer_id, total_price, status } = req.body ?? {};
  if (!customer_id || typeof customer_id !== "string") {
    return res.status(400).json({ error: "Missing required field: customer_id" });
  }
  if (total_price === undefined || total_price === null) {
    return res.status(400).json({ error: "Missing required field: total_price" });
  }
  if (status !== undefined && !Order.VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "status must be one of: pending, completed, cancelled" });
  }
  try {
    const order = await Order.create({ customer_id, total_price, status });
    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// PUT /orders/:order_id — update an existing order (customer_id and/or status only)
app.put("/orders/:order_id", async (req, res) => {
  const order_id = Number(req.params.order_id);
  if (!Number.isInteger(order_id)) {
    return res.status(400).json({ error: "order_id must be an integer" });
  }
  const { customer_id, status } = req.body ?? {};
  if (status !== undefined && !Order.VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "status must be one of: pending, completed, cancelled" });
  }
  try {
    const order = await Order.update(order_id, { customer_id, status });
    res.status(200).json(order);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// DELETE /orders/:order_id — delete an order (cascades to OrderItems once relation exists)
app.delete("/orders/:order_id", async (req, res) => {
  const order_id = Number(req.params.order_id);
  if (!Number.isInteger(order_id)) {
    return res.status(400).json({ error: "order_id must be an integer" });
  }
  try {
    await Order.remove(order_id);
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
