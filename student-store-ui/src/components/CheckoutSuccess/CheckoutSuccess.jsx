import { formatPrice } from "../../utils/format"
import "./CheckoutSuccess.css"

const CheckoutSuccess = ({ order, setOrder, products = [] }) => {
  const handleOnClose = () => {
    setOrder(null)
  }

  const productById = products.reduce((acc, p) => {
    acc[p.id] = p
    return acc
  }, {})

  const renderReceipt = () => (
    <>
      <p className="header">Order #{order.order_id} — {order.customer_id}</p>
      <ul className="purchase">
        {order.orderItems.map((item) => {
          const product = productById[item.product_id]
          const name = product?.name ?? `Product #${item.product_id}`
          return (
            <li key={item.order_item_id}>
              {item.quantity} × {name} @ {formatPrice(item.price)}
            </li>
          )
        })}
        <li className="total">
          <strong>Total: {formatPrice(order.total_price)}</strong>
        </li>
      </ul>
    </>
  )

  return (
    <div className="CheckoutSuccess">
      <h3>
        Checkout Info{" "}
        <span className={`icon button`}>
          <i className="material-icons md-48">fact_check</i>
        </span>
      </h3>
      {order ? (
        <div className="card">
          <header className="card-head">
            <h4 className="card-title">Receipt</h4>
          </header>
          <section className="card-body">{renderReceipt()}</section>
          <footer className="card-foot">
            <button className="button is-success" onClick={handleOnClose}>
              Shop More
            </button>
            <button className="button" onClick={handleOnClose}>
              Exit
            </button>
          </footer>
        </div>
      ) : (
        <div className="content">
          <p>
            A confirmation email will be sent to you so that you can confirm this order. Once you have confirmed the
            order, it will be delivered to your dorm room.
          </p>
        </div>
      )}
    </div>
  )
}

export default CheckoutSuccess
