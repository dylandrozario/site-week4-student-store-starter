import { useParams } from "react-router-dom";
import NotFound from "../NotFound/NotFound";
import { formatPrice } from "../../utils/format";
import "./ProductDetail.css";

function ProductDetail({ products, addToCart, removeFromCart, getQuantityOfItemInCart }) {
  const { productId } = useParams();

  if (!products || products.length === 0) {
    return <h1>Loading...</h1>;
  }

  const product = products.find((p) => String(p.id) === String(productId));

  if (!product) {
    return <NotFound />;
  }

  const quantity = getQuantityOfItemInCart(product);

  const handleAddToCart = () => addToCart(product);
  const handleRemoveFromCart = () => removeFromCart(product);

  return (
    <div className="ProductDetail">
      <div className="product-card">
        <div className="media">
          <img src={product.image_url || "/placeholder.png"} alt={product.name} />
        </div>
        <div className="product-info">
          <p className="product-name">{product.name}</p>
          <p className="product-price">{formatPrice(product.price)}</p>
          <p className="description">{product.description}</p>
          <div className="actions">
            <button onClick={handleAddToCart}>Add to Cart</button>
            {quantity > 0 && <button onClick={handleRemoveFromCart}>Remove from Cart</button>}
            {quantity > 0 && <span className="quantity">Quantity: {quantity}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}


export default ProductDetail;
