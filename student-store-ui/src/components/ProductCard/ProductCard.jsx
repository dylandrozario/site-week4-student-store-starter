import { Link } from "react-router-dom"
import codepath from "../../assets/codepath.svg"
import { formatPrice } from "../../utils/format"
import "./ProductCard.css"

function ProductCard({ product, quantity, addToCart, removeFromCart }) {
  return (
    <div className="ProductCard">
      <Link to={`/${product.id}`} className="media">
        <img
          src={product.image_url || codepath}
          alt={product.name}
          onError={(e) => {
            if (e.target.src !== codepath) e.target.src = codepath;
          }}
        />
      </Link>

      <div className="product-info">
        <div className="info-row">
          <p className="product-name">{product.name}</p>
          <p className="product-price">{formatPrice(product.price)}</p>
        </div>
        {product.category && <p className="product-category">{product.category}</p>}

        {quantity > 0 ? (
          <div className="quantity-controls">
            <button className="qty-btn" onClick={removeFromCart} aria-label="Remove one">−</button>
            <span className="qty-count">{quantity}</span>
            <button className="qty-btn" onClick={addToCart} aria-label="Add one">+</button>
          </div>
        ) : (
          <button className="add-to-cart" onClick={addToCart}>Add to Cart</button>
        )}
      </div>
    </div>
  )
}

export default ProductCard;
