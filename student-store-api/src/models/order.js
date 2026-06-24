const { Prisma } = require("@prisma/client");
const prisma = require("../db/db");

const SORTABLE_FIELDS = new Set(["order_id", "customer_id", "total_price", "created_at"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);
const VALID_STATUSES = new Set(["pending", "completed", "cancelled"]);

class MissingProductError extends Error {
  constructor(missingId) {
    super(`Product not found: id ${missingId}`);
    this.name = "MissingProductError";
    this.missingId = missingId;
  }
}

class Order {
  static VALID_STATUSES = VALID_STATUSES;

  static async list({ customer_id, sort, order } = {}) {
    const sortField = SORTABLE_FIELDS.has(sort) ? sort : "created_at";
    const sortOrder = SORT_DIRECTIONS.has(order) ? order : "desc";

    return prisma.order.findMany({
      where: customer_id ? { customer_id } : undefined,
      orderBy: { [sortField]: sortOrder },
      include: { orderItems: true },
    });
  }

  static async get(order_id) {
    return prisma.order.findUnique({
      where: { order_id },
      include: { orderItems: true },
    });
  }

  static async create({ customer_id, total_price, status }) {
    return prisma.order.create({
      data: { customer_id, total_price, status },
    });
  }

  static async createWithItems({ customer_id, items }) {
    const merged = new Map();
    for (const { product_id, quantity } of items) {
      merged.set(product_id, (merged.get(product_id) ?? 0) + quantity);
    }
    const mergedItems = [...merged.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));

    const productIds = mergedItems.map(i => i.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const id of productIds) {
      if (!productMap.has(id)) {
        throw new MissingProductError(id);
      }
    }

    const lineItems = mergedItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: productMap.get(item.product_id).price,
    }));

    const total_price = lineItems.reduce(
      (sum, li) => sum.add(li.price.mul(li.quantity)),
      new Prisma.Decimal(0),
    );

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
  }

  static async update(order_id, { customer_id, status }) {
    return prisma.order.update({
      where: { order_id },
      data: { customer_id, status },
    });
  }

  static async remove(order_id) {
    return prisma.order.delete({
      where: { order_id },
    });
  }
}

module.exports = Order;
module.exports.MissingProductError = MissingProductError;
