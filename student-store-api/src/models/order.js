const prisma = require("../db/db");

const SORTABLE_FIELDS = new Set(["order_id", "customer_id", "total_price", "created_at"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);
const VALID_STATUSES = new Set(["pending", "completed", "cancelled"]);

class Order {
  static VALID_STATUSES = VALID_STATUSES;

  static async list({ customer_id, sort, order } = {}) {
    const sortField = SORTABLE_FIELDS.has(sort) ? sort : "created_at";
    const sortOrder = SORT_DIRECTIONS.has(order) ? order : "desc";

    return prisma.order.findMany({
      where: customer_id ? { customer_id } : undefined,
      orderBy: { [sortField]: sortOrder },
    });
  }

  static async get(order_id) {
    return prisma.order.findUnique({
      where: { order_id },
    });
  }

  static async create({ customer_id, total_price, status }) {
    return prisma.order.create({
      data: { customer_id, total_price, status },
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
