const express = require("express");
const productsController = require("../controllers/products");

const router = express.Router();

router.get("/", productsController.list);
router.get("/:id", productsController.get);
router.post("/", productsController.create);
router.put("/:id", productsController.update);
router.delete("/:id", productsController.remove);

module.exports = router;
