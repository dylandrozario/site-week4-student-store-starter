const express = require("express");
const orderItemsController = require("../controllers/orderItems");

const router = express.Router();

router.get("/", orderItemsController.list);

module.exports = router;
