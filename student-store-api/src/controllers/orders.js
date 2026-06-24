const Order = require("../models/order");

async function list(req, res) {
  try {
    const { customer_id, sort, order } = req.query;
    const orders = await Order.list({ customer_id, sort, order });
    res.status(200).json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

async function get(req, res) {
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
}

async function create(req, res) {
  const { customer_id, items } = req.body ?? {};

  if (!customer_id || typeof customer_id !== "string") {
    return res.status(400).json({ error: "Missing required field: customer_id" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array" });
  }
  for (const item of items) {
    if (!Number.isInteger(item?.product_id)) {
      return res.status(400).json({ error: "Each item must have an integer product_id" });
    }
    if (!Number.isInteger(item?.quantity) || item.quantity < 1) {
      return res.status(400).json({ error: "Each item must have an integer quantity ≥ 1" });
    }
  }

  try {
    const order = await Order.createWithItems({ customer_id, items });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof Order.MissingProductError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
}

async function update(req, res) {
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
}

async function remove(req, res) {
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
}

module.exports = { list, get, create, update, remove };
