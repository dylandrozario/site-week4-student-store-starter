## Unit Assignment: Student Store

Submitted by: **Dylan D'ROzario**

Deployed Application (optional): [Student Store Deployed Site](https://site-week4-student-store-starter-frontend-gds6.onrender.com/)

### Application Features

#### CORE FEATURES

- [X] **Database Creation**: Set up a Postgres database to store information about products and orders.
  - [X]  Use Prisma to define models for `products`, `orders`, and `order_items`.
  - [ ]  **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of your `products`, `orders`, and `order_items` tables. 
- [X] **Products Model**
  - [X] Develop a products model to represent individual items available in the store. 
  - [X] This model should at minimum include the attributes:
    - [X] `id`
    - [X] `name`
    - [X] `description`
    - [X] `price` 
    - [X] `image_url`
    - [X] `category`
  - [X] Implement methods for CRUD operations on products.
  - [X] Ensure transaction handling such that when an product is deleted, any `order_items` that reference that product are also deleted. 
  - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of all attributes (table columns) in your Products Model.
- [X] **Orders Model**
  - [X] Develop a model to manage orders. 
  - [X] This model should at minimum include the attributes:
    - [X] `order_id`
    - [X] `customer_id`
    - [X] `total_price`
    - [X] `status`
    - [X] `created_at`
  - [X] Implement methods for CRUD operations on orders.
  - [X] Ensure transaction handling such that when an order is deleted, any `order_items` that reference that order are also deleted. 
  - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of all attributes (table columns) in your Order Model.

- [X] **Order Items Model**
  - [X] Develop a model to represent the items within an order. 
  - [X] This model should at minimum include the attributes:
    - [X] `order_item_id`
    - [X] `order_id`
    - [X] `product_id`
    - [X] `quantity`
    - [X] `price`
  - [X] Implement methods for fetching and creating order items.  
  - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Prisma Studio to demonstrate the creation of all attributes (table columns) in your Order Items Model.
- [X] **API Endpoints**
  - [X] Application supports the following **Product Endpoints**:
    - [X] `GET /products`: Fetch a list of all products.
    - [X] `GET /products/:id`: Fetch details of a specific product by its ID.
    - [X] `POST /products`: Add a new product to the database.
    - [X] `PUT /products/:id`: Update the details of an existing product.
    - [X] `DELETE /products/:id`: Remove a product from the database.
  - [X] Application supports the following **Order Endpoints**:
    - [X] `GET /orders`: Fetch a list of all orders.
    - [X] `GET /orders/:order_id`: Fetch details of a specific order by its ID, including the order items.
    - [X] `POST /orders`: Create a new order with specified order items.
    - [X] `PUT /orders/:order_id`: Update the details of an existing order (e.g., change status).
    - [X] `DELETE /orders/:order_id`: Remove an order from the database.
    - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use Postman or another API testing tool to demonstrate the successful implementation of each endpoint. For the `DELETE` endpoints, please use Prisma Studio to demonstrate that any relevant order items have been deleted. 
- [X] **Frontend Integration**
  - [X] Connect the backend API to the provided frontend interface, ensuring dynamic interaction for product browsing, cart management, and order placement. Adjust the frontend as necessary to work with your API.
  - [X] Ensure the home page displays products contained in the product table.
  - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: Use `npm start` to run your server and display your website in your browser. 
    - [ ] Demonstrate that users can successfully add items to their shopping cart, delete items from their shopping cart, and place an order
    - [ ] After placing an order use Postman or Prisma Studio demonstrate that a corresponding order has been created in your orders table.

### Stretch Features

- [X] **Added Endpoints**
  - [X] `GET /order-items`: Create an endpoint for fetching all order items in the database.
  - [X] `POST /orders/:order_id/items` Create an endpoint that adds a new order item to an existing order. 
- [X] **Past Orders Page**
  - [X] Build a page in the UI that displays the list of all past orders.
  - [X] The page lists all past orders for the user, including relevant information such as:
    - [X] Order ID
    - [X] Date
    - [X] Total cost
    - [X] Order status.
  - [X] The user should be able to click on any individual order to take them to a separate page detailing the transaction.
  - [X] The individual transaction page provides comprehensive information about the transaction, including:
    - [X] List of order items
    - [X] Order item quantities
    - [X] Individual order item costs
    - [X] Total order cost
- [X] **Filter Orders**.
  - [X] Create an input on the Past Orders page of the frontend application that allows the user to filter orders by the email of the person who placed the order. 
  - [X] Users can type in an email and click a button to filter the orders.
  - [X] Upon entering an email address and submitting the input, the list of orders is filtered to only show orders placed by the user with the provided email. 
  - [X] The user can easily navigate back to the full list of orders after filtering. 
    - [X] Proper error handling is implemented, such as displaying "no orders found" when an invalid email is provided.
- [X] **Deployment**
  - [X] Website is deployed using [Render](https://courses.codepath.org/snippets/site/render_deployment_guide).
  - [ ] **VIDEO WALKTHROUGH SPECIAL INSTRUCTIONS**: To ease the grading process, please use the deployed version of your website in your walkthrough with the URL visible. 



### Walkthrough Video

`TODO://` Add the embedded URL code to your animated app walkthrough below, `ADD_EMBEDDED_CODE_HERE`. Make sure the video or gif actually renders and animates when viewing this README. (🚫 Remove this paragraph after adding walkthrough video)

`ADD_EMBEDDED_CODE_HERE`

### Reflection

* Did the topics discussed in your labs prepare you to complete the assignment? Be specific, which features in your weekly assignment did you feel unprepared to complete?

The labs covered Prisma basics and Express routing well, which made the single-table CRUD endpoints (products, basic orders) feel straightforward. The piece I felt least prepared for was the transactional `POST /orders` endpoint — coordinating an Order insert with multiple OrderItem inserts atomically, snapshotting product prices, and recomputing totals all in one rollback-safe operation went beyond what the labs demonstrated. Connecting the deployed frontend to the deployed backend (CORS, environment variables, seeding the production database) was also more involved than expected.

* If you had more time, what would you have done differently? Would you have added additional features? Changed the way your project responded to a particular event, etc.

I would have added persistent shopping carts via `localStorage` so refreshing the page doesn't wipe the cart, and built an admin view to edit product inventory and order statuses through the UI instead of having to use Postman. I'd also refactor the validation logic in the controllers to collect all errors at once (instead of failing on the first one), which would give the frontend richer error messages to display and reduce the back-and-forth for users filling out the checkout form.

* Reflect on your project demo, what went well? Were there things that maybe didn't go as planned? Did you notice something that your peer did that you would like to try next time?

The clean separation between routes, controllers, and models held up well during the demo — every part of the system was easy to point at and explain. What didn't go as planned was the initial Render deployment: I forgot to set the `Root Directory` setting to `student-store-api`, which made the build fail because Render couldn't find `package.json`. Next time I'd write out a deployment checklist before pushing so I'm not debugging config issues live.

### Open-source libraries used

- [Express](https://expressjs.com/) — HTTP server framework for the backend
- [Prisma](https://www.prisma.io/) — ORM and migration tool for Postgres
- [PostgreSQL](https://www.postgresql.org/) — relational database
- [pg](https://node-postgres.com/) — Postgres driver for Node.js
- [cors](https://www.npmjs.com/package/cors) — middleware for cross-origin request handling
- [dotenv](https://www.npmjs.com/package/dotenv) — loads environment variables from `.env`
- [nodemon](https://nodemon.io/) — auto-restarts the dev server on file changes
- [React](https://react.dev/) — frontend UI library
- [React Router](https://reactrouter.com/) — client-side routing
- [Vite](https://vitejs.dev/) — frontend build tool and dev server
- [axios](https://axios-http.com/) — HTTP client for API requests from the frontend

### Shout out

Big shout out to my cohort TAs and mentors for the live debugging help during the deployment phase, and to everyone in the cohort Slack who shared their Render configuration tips. Pair-debugging the CORS allow-list issue with another student saved me a lot of time.




