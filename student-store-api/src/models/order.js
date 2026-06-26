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

class OrderNotFoundError extends Error {
  constructor(orderId) {
    super(`Order not found: id ${orderId}`);
    this.name = "OrderNotFoundError";
    this.orderId = orderId;
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

  static async addItem(order_id, { product_id, quantity }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { order_id } });
      if (!order) throw new OrderNotFoundError(order_id);

      const product = await tx.product.findUnique({ where: { id: product_id } });
      if (!product) throw new MissingProductError(product_id);

      // If this product already has a line on the order, increment its quantity
      // instead of creating a second row (mirrors the merge rule from POST /orders).
      const existing = await tx.orderItem.findFirst({
        where: { order_id, product_id },
      });

      const lineItem = existing
        ? await tx.orderItem.update({
            where: { order_item_id: existing.order_item_id },
            data: { quantity: existing.quantity + quantity },
          })
        : await tx.orderItem.create({
            data: {
              order_id,
              product_id,
              quantity,
              price: product.price,
            },
          });

      // Recompute total_price from scratch over the order's current items.
      // This keeps total_price honest after every item add.
      const items = await tx.orderItem.findMany({ where: { order_id } });
      const total_price = items.reduce(
        (sum, item) => sum.add(item.price.mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      await tx.order.update({
        where: { order_id },
        data: { total_price },
      });

      return tx.order.findUnique({
        where: { order_id },
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
module.exports.OrderNotFoundError = OrderNotFoundError;
