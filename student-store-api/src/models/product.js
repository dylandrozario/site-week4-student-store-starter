const prisma = require("../db/db");

const SORTABLE_FIELDS = new Set(["id", "name", "price", "created_at"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

class Product {
  static async list({ category, sort, order } = {}) {
    const sortField = SORTABLE_FIELDS.has(sort) ? sort : "id";
    const sortOrder = SORT_DIRECTIONS.has(order) ? order : "asc";

    return prisma.product.findMany({
      where: category ? { category } : undefined,
      orderBy: { [sortField]: sortOrder },
    });
  }

  static async get(id) {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  static async create({ name, description, price, image_url, category }) {
    return prisma.product.create({
      data: { name, description, price, image_url, category },
    });
  }

  static async update(id, { name, description, price, image_url, category }) {
    return prisma.product.update({
      where: { id },
      data: { name, description, price, image_url, category },
    });
  }

  static async remove(id) {
    return prisma.product.delete({
      where: { id },
    });
  }
}

module.exports = Product;
