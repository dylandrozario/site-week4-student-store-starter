const express = require("express");
const ordersController = require("../controllers/orders");

const router = express.Router();

router.get("/", ordersController.list);
router.get("/:order_id", ordersController.get);
router.post("/", ordersController.create);
router.post("/:order_id/items", ordersController.addItem);
router.put("/:order_id", ordersController.update);
router.delete("/:order_id", ordersController.remove);

module.exports = router;
