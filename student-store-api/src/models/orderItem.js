const prisma = require("../db/db");

class OrderItem {
  static async list({ order_id, product_id } = {}) {
    const where = {};
    if (order_id !== undefined) where.order_id = order_id;
    if (product_id !== undefined) where.product_id = product_id;

    return prisma.orderItem.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { order_item_id: "asc" },
    });
  }

  static async get(order_item_id) {
    return prisma.orderItem.findUnique({
      where: { order_item_id },
    });
  }

  static async create({ order_id, product_id, quantity, price }) {
    return prisma.orderItem.create({
      data: { order_id, product_id, quantity, price },
    });
  }
}

module.exports = OrderItem;
