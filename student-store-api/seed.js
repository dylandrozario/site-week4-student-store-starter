const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const fs = require("fs")
const path = require("path")

async function seed() {
  console.log("🌱 Seeding database...\n")

  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()

  const productsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data/products.json"), "utf8")
  )
  const ordersData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data/orders.json"), "utf8")
  )

  for (const product of productsData.products) {
    await prisma.product.create({
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category: product.category,
      },
    })
  }
  console.log(`✅ Seeded ${productsData.products.length} products`)

  for (const order of ordersData.orders) {
    const createdOrder = await prisma.order.create({
      data: {
        order_id: order.order_id,
        customer_id: String(order.customer_id),
        total_price: order.total_price,
        status: order.status,
        created_at: new Date(order.created_at),
        orderItems: {
          create: order.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    })
    console.log(`✅ Created order #${createdOrder.order_id}`)
  }

  // Advance the Postgres sequences past the manually-inserted IDs so future
  // auto-increment inserts don't collide with seeded rows.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 1), true)`
  )
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Order"', 'order_id'), COALESCE((SELECT MAX(order_id) FROM "Order"), 1), true)`
  )
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"OrderItem"', 'order_item_id'), COALESCE((SELECT MAX(order_item_id) FROM "OrderItem"), 1), true)`
  )

  console.log("\n🎉 Seeding complete!")
}

seed()
  .catch((err) => {
    console.error("❌ Error seeding:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
