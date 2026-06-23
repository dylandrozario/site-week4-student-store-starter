In the Student Store project, you'll design and build the backend API and database for an online store for the College of CodePath. The provided React frontend lets customers browse products, manage a shopping cart, and place orders. Your task is to build the backend using Node and Express, set up a Prisma-managed PostgreSQL database, and connect the two.

This is the first project where you're building a multi-model system from scratch — three related data models with foreign key constraints, cascade delete rules, and a transactional endpoint that touches multiple tables at once. That complexity is exactly why you're starting with a planning.md.

Before writing any code, you'll define a system spec covering the data models, the full API contract, and the transactional flow for order creation. Every milestone that follows references that plan. By the time you deploy, the spec is a complete record of what you built and why.

🎯 Goals
By the end of this project, you will be able to:

Author a system-level planning.md covering data models, API contracts, and transactional data flow before implementation.
Design a Prisma schema with multiple related models, foreign key relationships, and cascade delete behavior.
Build a backend API that allows for CRUD operations on products and handles order processing.
Validate that your implementation matches the documented spec before connecting to the frontend.
Student Store README template

✅ Features
Required Features

Database Creation

Set up a Postgres database to store information about products and orders.
Use Prisma to define models for products, orders, and order_items.

Products Model

Develop a products model to represent individual items available in the store.
This model should at minimum include the attributes:
id
name
description
price
image_url
category
Implement methods for CRUD operations on products.
Ensure transaction handling such that when a product is deleted, any order_items that reference that product are also deleted.

Orders Model

Develop a model to manage orders.
This model should at minimum include the attributes:
order_id
customer_id
total_price
status
created_at
Implement methods for CRUD operations on orders.
Ensure transaction handling such that when an order is deleted, any order_items that reference that order are also deleted.

Order Items Model

Develop a model to represent the items within an order.
This model should at minimum include the attributes:
order_item_id
order_id
product_id
quantity
price
Implement methods for fetching and creating order items.

API Endpoints

Application supports the following Product Endpoints:
GET /products: Fetch a list of all products.
GET /products/:id: Fetch details of a specific product by its ID.
POST /products: Add a new product to the database.
PUT /products/:id: Update the details of an existing product.
DELETE /products/:id: Remove a product from the database.
Application supports the following Order Endpoints:
GET /orders: Fetch a list of all orders.
GET /orders/:order_id: Fetch details of a specific order by its ID, including the order items.
POST /orders: Create a new order with specified order items.
PUT /orders/:order_id: Update the details of an existing order (e.g., change status).
DELETE /orders/:order_id: Remove an order from the database.

Frontend Integration

Connect the backend API to the provided frontend interface, ensuring dynamic interaction for product browsing, cart management, and order placement. Adjust the frontend as necessary to work with your API.
Ensure the home page displays products contained in the product table.
Stretch Features
Added Endpoints
GET /order-items: Create an endpoint for fetching all order items in the database.
POST /orders/:order_id/items Create an endpoint that adds a new order item to an existing order.
Past Orders Page
Build a page in the UI that displays the list of all past orders.
The page lists all past orders for the user, including relevant information such as:
Order ID
Date
Total cost
Order status.
The user should be able to click on any individual order to take them to a separate page detailing the transaction.
The individual transaction page provides comprehensive information about the transaction, including:
List of order items
Order item quantities
Individual order item costs
Total order cost
Filter Orders.
Create an input on the Past Orders page of the frontend application that allows the user to filter orders by the email of the person who placed the order.
Users can type in an email and click a button to filter the orders.
Upon entering an email address adn submitting the input, the list of orders is filtered to only show orders placed by the user with the provided email.
The user can easily navigate back to the full list of ordres after filtering.
Proper error handling is implemented, such as displaying "no orders found" when an invalid email is provided.
Deployment
Website is deployed using Render.