import ShoppingCart from "../ShoppingCart/ShoppingCart"
import "./Sidebar.css"

function Sidebar({ cart, isOpen, products, userInfo, setUserInfo, toggleSidebar, handleOnCheckout, isCheckingOut, order, setOrder, error, clearCart }) {
  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? "visible" : ""}`} onClick={toggleSidebar} />
      <aside className={`Sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="wrapper">
          <button
            type="button"
            className="toggle-button"
            onClick={toggleSidebar}
            aria-label="Close cart"
          >
            <i className="material-icons">close</i>
          </button>

          <ShoppingCart
            isOpen={isOpen}
            cart={cart}
            products={products}
            toggleSidebar={toggleSidebar}
            userInfo={userInfo}
            setUserInfo={setUserInfo}
            handleOnCheckout={handleOnCheckout}
            isCheckingOut={isCheckingOut}
            error={error}
            order={order}
            setOrder={setOrder}
            clearCart={clearCart}
          />
        </div>
      </aside>
    </>
  )
}

export default Sidebar;
