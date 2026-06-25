import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import axios from "axios"
import { formatPrice } from "../../utils/format"
import "./PastOrders.css"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

function PastOrders() {
  const [orders, setOrders] = useState([])
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState(null)
  const [filterInput, setFilterInput] = useState("")
  const [activeFilter, setActiveFilter] = useState("")

  const fetchOrders = async (customerFilter) => {
    setIsFetching(true)
    setError(null)
    try {
      const url = customerFilter
        ? `${API_URL}/orders?customer_id=${encodeURIComponent(customerFilter)}`
        : `${API_URL}/orders`
      const response = await axios.get(url)
      setOrders(response.data)
    } catch (err) {
      console.error(err)
      setError("Failed to load orders. Is the API running?")
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchOrders("")
  }, [])

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    const trimmed = filterInput.trim()
    setActiveFilter(trimmed)
    fetchOrders(trimmed)
  }

  const handleClearFilter = () => {
    setFilterInput("")
    setActiveFilter("")
    fetchOrders("")
  }

  return (
    <div className="PastOrders">
      <h1>Past Orders</h1>

      <form className="filter-bar" onSubmit={handleFilterSubmit}>
        <div className="input-wrap">
          <input
            type="text"
            placeholder="Filter by customer (email or ID)"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
          />
          {filterInput && (
            <button
              type="button"
              className="clear-input"
              aria-label="Clear input"
              onClick={() => setFilterInput("")}
            >
              ×
            </button>
          )}
        </div>
        <button type="submit" disabled={isFetching}>
          Filter
        </button>
        {activeFilter && (
          <button type="button" onClick={handleClearFilter} disabled={isFetching}>
            Clear
          </button>
        )}
      </form>

      {activeFilter && (
        <p className="filter-status">
          Showing orders for <strong>{activeFilter}</strong>
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {isFetching ? (
        <p>Loading...</p>
      ) : orders.length === 0 ? (
        <p className="empty">No orders found.</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.order_id}>
                <td>#{order.order_id}</td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td>{order.customer_id}</td>
                <td>{order.status}</td>
                <td>{formatPrice(order.total_price)}</td>
                <td>
                  <Link to={`/orders/${order.order_id}`}>View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default PastOrders
