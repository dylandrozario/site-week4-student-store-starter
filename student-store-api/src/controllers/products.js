const Product = require("../models/product");

async function list(req, res) {
  try {
    const { category, sort, order } = req.query;
    const products = await Product.list({ category, sort, order });
    res.status(200).json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

async function get(req, res) {
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
}

async function create(req, res) {
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
}

async function update(req, res) {
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
}

async function remove(req, res) {
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
}

module.exports = { list, get, create, update, remove };
