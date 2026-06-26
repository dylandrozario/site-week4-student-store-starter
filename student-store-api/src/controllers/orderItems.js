const OrderItem = require("../models/orderItem");

async function list(req, res) {
  const { order_id, product_id } = req.query;

  // Both filters are optional. If provided as query strings, coerce to int.
  const parsedOrderId = order_id !== undefined ? Number(order_id) : undefined;
  const parsedProductId = product_id !== undefined ? Number(product_id) : undefined;

  if (order_id !== undefined && !Number.isInteger(parsedOrderId)) {
    return res.status(400).json({ error: "order_id must be an integer" });
  }
  if (product_id !== undefined && !Number.isInteger(parsedProductId)) {
    return res.status(400).json({ error: "product_id must be an integer" });
  }

  try {
    const items = await OrderItem.list({
      order_id: parsedOrderId,
      product_id: parsedProductId,
    });
    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order items" });
  }
}

module.exports = { list };
