import PaymentInfo from "../PaymentInfo/PaymentInfo";
import CheckoutSuccess from "../CheckoutSuccess/CheckoutSuccess";
import { calculateTaxesAndFees, calculateTotal } from "../../utils/calculations";
import { formatPrice } from "../../utils/format";
import "./ShoppingCart.css";


const CartTable = ({ products, cart }) => {
  const productMapping = products.reduce((acc, item) => {
    acc[item.id] = item; 
    return acc;
  }, {});

  const productRows = Object.keys(cart).map((productId) => {
    const product = productMapping[productId];

    if (!product) {
      console.error(`Product with ID ${productId} not found in products array.`);
      return null;
    }

    return {
      ...product,
      quantity: cart[productId],
      totalPrice: cart[productId] * product.price,
    };
  }).filter(row => row !== null); // Filter out any null values

  const subTotal = productRows.reduce((acc, p) => acc + p.totalPrice, 0);

  return (
    <>
      <div className="CartTable">
        <div className="header">
          <div className="header-row">
            <span className="flex-2">Name</span>
            <span className="center">Quantity</span>
            <span className="center">Unit Price</span>
            <span className="center">Cost</span>
          </div>

          {productRows.map((product) => (
            <div key={product.id} className="product-row">
              <span className="flex-2">{product.name}</span>
              <span className="center">{product.quantity}</span>
              <span className="center">{formatPrice(product.price)}</span>
              <span className="center">{formatPrice(product.totalPrice)}</span>
            </div>
          ))}
        </div>

        <div className="receipt">
          <div className="receipt-subtotal">
            <span className="label">Subtotal</span>
            <span />
            <span />
            <span className="center">{formatPrice(subTotal)}</span>
          </div>
          <div className="receipt-taxes">
            <span className="label">Taxes and Fees</span>
            <span />
            <span />
            <span className="center">{formatPrice(calculateTaxesAndFees(subTotal))}</span>
          </div>
          <div className="receipt-total">
            <span className="label">Total</span>
            <span />
            <span />
            <span className="center">{formatPrice(calculateTotal(subTotal))}</span>
          </div>
        </div>
      </div>
    </>
  );
};

const CartItems = ({ products, cart }) => {
  const hasItems = Object.keys(cart).length;

  return (
    <>
      <h3 className="">
        Shopping Cart{" "}
        <span className="button">
          <i className="material-icons md-48">add_shopping_cart</i>
        </span>
      </h3>
      {hasItems ? (
        <>
          <CartTable products={products} cart={cart} />
        </>
      ) : (
        <>
          <div className="notification">No items added to cart yet. Start shopping now!</div>
        </>
      )}
    </>
  );
};

export default function ShoppingCart({
  isOpen,
  products,
  cart,
  toggleSidebar,
  userInfo,
  setUserInfo,
  handleOnCheckout,
  isCheckingOut,
  order,
  setOrder,
  error,
}) {
  return (
    <div className="ShoppingCart">
      {isOpen ? (
        <div className="open">
          <CartItems products={products} cart={cart} />
          <PaymentInfo
            userInfo={userInfo}
            setUserInfo={setUserInfo}
            handleOnCheckout={handleOnCheckout}
            isCheckingOut={isCheckingOut}
            error={error}
          />
          <CheckoutSuccess userInfo={userInfo} order={order} setOrder={setOrder} products={products} />
        </div>
      ) : (
        null
      )}
    </div>
  );
}
