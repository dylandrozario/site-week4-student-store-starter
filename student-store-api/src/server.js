const express = require("express");
const cors = require("cors");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the Student Store API!");
});

app.use("/products", productsRouter);
app.use("/orders", ordersRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
