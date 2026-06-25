import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import SubNavbar from "../SubNavbar/SubNavbar";
import Sidebar from "../Sidebar/Sidebar";
import Home from "../Home/Home";
import ProductDetail from "../ProductDetail/ProductDetail";
import PastOrders from "../PastOrders/PastOrders";
import OrderDetail from "../OrderDetail/OrderDetail";
import NotFound from "../NotFound/NotFound";
import { removeFromCart, addToCart, getQuantityOfItemInCart, getTotalItemsInCart } from "../../utils/cart";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Diagnostic: log the API URL the frontend was built with
console.log("[StudentStore] API_URL =", API_URL);
console.log("[StudentStore] import.meta.env.MODE =", import.meta.env.MODE);
console.log("[StudentStore] import.meta.env.VITE_API_URL =", import.meta.env.VITE_API_URL);

function App() {

  // State variables
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [userInfo, setUserInfo] = useState({ customer_id: "" });
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [isFetching, setIsFetching] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      const url = `${API_URL}/products`;
      console.log("[StudentStore] Fetching products from:", url);
      setIsFetching(true);
      setError(null);
      try {
        const response = await axios.get(url);
        console.log("[StudentStore] Products response status:", response.status);
        console.log("[StudentStore] Products response data:", response.data);
        console.log("[StudentStore] Products count:", Array.isArray(response.data) ? response.data.length : "(not an array)");
        setProducts(response.data);
      } catch (err) {
        console.error("[StudentStore] Failed to fetch products");
        console.error("[StudentStore] Error message:", err.message);
        console.error("[StudentStore] Error code:", err.code);
        if (err.response) {
          console.error("[StudentStore] Response status:", err.response.status);
          console.error("[StudentStore] Response body:", err.response.data);
        } else if (err.request) {
          console.error("[StudentStore] No response received — likely CORS, network failure, or backend asleep/down");
        }
        console.error("[StudentStore] Full error:", err);
        setError(`Failed to load products: ${err.message}`);
      } finally {
        setIsFetching(false);
      }
    };
    fetchProducts();
  }, []);

  // Toggles sidebar
  const toggleSidebar = () => setSidebarOpen((isOpen) => !isOpen);

  // Functions to change state (used for lifting state)
  const handleOnRemoveFromCart = (item) => setCart(removeFromCart(cart, item));
  const handleOnAddToCart = (item) => setCart(addToCart(cart, item));
  const handleGetItemQuantity = (item) => getQuantityOfItemInCart(cart, item);
  const handleGetTotalCartItems = () => getTotalItemsInCart(cart);
  const handleClearCart = () => setCart({});

  const handleClearFilters = () => {
    setActiveCategory("All Categories");
    setSearchInputValue("");
  };

  const handleOnSearchInputChange = (event) => {
    setSearchInputValue(event.target.value);
  };

  const handleOnCheckout = async () => {
    if (!userInfo.customer_id) {
      setError("Please enter your email before checking out.");
      return;
    }
    if (Object.keys(cart).length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setIsCheckingOut(true);
    setError(null);

    const items = Object.entries(cart).map(([id, quantity]) => ({
      product_id: Number(id),
      quantity,
    }));

    try {
      const response = await axios.post(`${API_URL}/orders`, {
        customer_id: userInfo.customer_id,
        items,
      });
      setOrder(response.data);
      setCart({});
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error ?? "Checkout failed. Please try again.";
      setError(message);
    } finally {
      setIsCheckingOut(false);
    }
  };


  const totalCartItems = handleGetTotalCartItems();

  return (
    <div className="App">
      <BrowserRouter>
        <Sidebar
          cart={cart}
          error={error}
          userInfo={userInfo}
          setUserInfo={setUserInfo}
          isOpen={sidebarOpen}
          products={products}
          toggleSidebar={toggleSidebar}
          isCheckingOut={isCheckingOut}
          addToCart={handleOnAddToCart}
          removeFromCart={handleOnRemoveFromCart}
          getQuantityOfItemInCart={handleGetItemQuantity}
          getTotalItemsInCart={handleGetTotalCartItems}
          handleOnCheckout={handleOnCheckout}
          clearCart={handleClearCart}
          order={order}
          setOrder={setOrder}
        />
        <main>
          <SubNavbar
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchInputValue={searchInputValue}
            handleOnSearchInputChange={handleOnSearchInputChange}
            totalCartItems={totalCartItems}
            toggleSidebar={toggleSidebar}
          />
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  error={error}
                  products={products}
                  isFetching={isFetching}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  addToCart={handleOnAddToCart}
                  searchInputValue={searchInputValue}
                  removeFromCart={handleOnRemoveFromCart}
                  getQuantityOfItemInCart={handleGetItemQuantity}
                  clearFilters={handleClearFilters}
                />
              }
            />
            <Route
              path="/orders"
              element={<PastOrders />}
            />
            <Route
              path="/orders/:order_id"
              element={<OrderDetail products={products} />}
            />
            <Route
              path="/:productId"
              element={
                <ProductDetail
                  cart={cart}
                  error={error}
                  products={products}
                  addToCart={handleOnAddToCart}
                  removeFromCart={handleOnRemoveFromCart}
                  getQuantityOfItemInCart={handleGetItemQuantity}
                  setActiveCategory={setActiveCategory}
                  toggleSidebar={toggleSidebar}
                  clearCart={handleClearCart}
                />
              }
            />
            <Route
              path="*"
              element={
                <NotFound
                  error={error}
                  products={products}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                />
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;
