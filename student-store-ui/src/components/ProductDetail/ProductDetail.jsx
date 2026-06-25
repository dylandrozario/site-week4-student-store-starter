import { Link, useNavigate, useParams } from "react-router-dom";
import NotFound from "../NotFound/NotFound";
import codepath from "../../assets/codepath.svg";
import { formatPrice } from "../../utils/format";
import "./ProductDetail.css";

function ProductDetail({
  products,
  cart,
  addToCart,
  removeFromCart,
  getQuantityOfItemInCart,
  setActiveCategory,
  toggleSidebar,
  clearCart,
}) {
  const { productId } = useParams();
  const navigate = useNavigate();

  if (!products || products.length === 0) {
    return <div className="ProductDetail"><p className="state">Loading...</p></div>;
  }

  const product = products.find((p) => String(p.id) === String(productId));

  if (!product) {
    return <NotFound />;
  }

  const quantity = getQuantityOfItemInCart(product);

  const handleAddToCart = () => addToCart(product);
  const handleRemoveFromCart = () => removeFromCart(product);

  const handleBuyNow = () => {
    addToCart(product);
    if (toggleSidebar) toggleSidebar();
  };

  const handleCategoryClick = (event) => {
    event.preventDefault();
    if (setActiveCategory) setActiveCategory(product.category);
    navigate("/");
  };

  return (
    <div className="ProductDetail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="separator">/</span>
        <a href="/" onClick={handleCategoryClick}>{product.category}</a>
        <span className="separator">/</span>
        <span className="current">{product.name}</span>
      </nav>

      <div className="product-layout">
        <div className="image-panel">
          <img
            src={product.image_url || codepath}
            alt={product.name}
            onError={(e) => {
              if (e.target.src !== codepath) e.target.src = codepath;
            }}
          />
        </div>

        <div className="info-panel">
          <h1 className="product-name">{product.name}</h1>
          <p className="product-description">{product.description}</p>

          <hr className="divider" />

          <div className="price-block">
            <p className="product-price">{formatPrice(product.price)}</p>
            <p className="price-sub">One-time payment · Pickup at the student store</p>
          </div>

          <hr className="divider" />

          <div className="actions">
            <div className="quantity-control">
              <button
                type="button"
                className="qty-btn"
                onClick={handleRemoveFromCart}
                disabled={quantity === 0}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="qty-count">{quantity}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={handleAddToCart}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {cart && Object.keys(cart).length > 0 && clearCart && (
              <button type="button" className="btn-clear-cart" onClick={clearCart}>
                Clear Cart
              </button>
            )}
          </div>

          <div className="cta-row">
            <button type="button" className="btn-primary" onClick={handleBuyNow}>
              Buy Now
            </button>
            <button type="button" className="btn-secondary" onClick={handleAddToCart}>
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
