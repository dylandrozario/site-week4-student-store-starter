import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import axios from "axios"
import NotFound from "../NotFound/NotFound"
import { formatPrice } from "../../utils/format"
import "./OrderDetail.css"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

function OrderDetail({ products = [] }) {
  const { order_id } = useParams()
  const [order, setOrder] = useState(null)
  const [isFetching, setIsFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchOrder = async () => {
      setIsFetching(true)
      setError(null)
      setNotFound(false)
      try {
        const response = await axios.get(`${API_URL}/orders/${order_id}`)
        setOrder(response.data)
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 400) {
          setNotFound(true)
        } else {
          console.error(err)
          setError("Failed to load order. Is the API running?")
        }
      } finally {
        setIsFetching(false)
      }
    }
    fetchOrder()
  }, [order_id])

  if (notFound) return <NotFound />
  if (isFetching) return <div className="OrderDetail"><p>Loading...</p></div>
  if (error) return <div className="OrderDetail"><p className="error">{error}</p></div>
  if (!order) return null

  const productById = products.reduce((acc, p) => {
    acc[p.id] = p
    return acc
  }, {})

  return (
    <div className="OrderDetail">
      <div className="back-link">
        <Link to="/orders">← Back to Past Orders</Link>
      </div>

      <h1>Order #{order.order_id}</h1>

      <dl className="meta">
        <dt>Customer</dt>
        <dd>{order.customer_id}</dd>

        <dt>Status</dt>
        <dd className={`status status-${order.status}`}>{order.status}</dd>

        <dt>Placed</dt>
        <dd>{new Date(order.created_at).toLocaleString()}</dd>

        <dt>Total</dt>
        <dd className="total">{formatPrice(order.total_price)}</dd>
      </dl>

      <h2>Line Items</h2>

      {order.orderItems.length === 0 ? (
        <p className="empty">This order has no items.</p>
      ) : (
        <table className="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item) => {
              const product = productById[item.product_id]
              const name = product?.name ?? `Product #${item.product_id}`
              const lineTotal = Number(item.price) * item.quantity
              return (
                <tr key={item.order_item_id}>
                  <td>{name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.price)}</td>
                  <td>{formatPrice(lineTotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default OrderDetail
