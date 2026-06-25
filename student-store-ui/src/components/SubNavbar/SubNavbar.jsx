import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import "./SubNavbar.css"

function SubNavbar({
  activeCategory,
  setActiveCategory,
  searchInputValue,
  handleOnSearchInputChange,
  totalCartItems,
  toggleSidebar,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)

  const categories = ["All Categories", "Accessories", "Apparel", "Books", "Snacks", "Supplies"]

  const isOnOrdersPage = location.pathname.startsWith("/orders")
  const hasCategoryFilter = activeCategory && activeCategory !== "All Categories"

  const isOrdersActive = isOnOrdersPage
  const isCategoriesActive = !isOnOrdersPage && hasCategoryFilter

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setCategoriesOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleCategorySelect = (cat) => {
    setActiveCategory(cat)
    setCategoriesOpen(false)
    setMobileMenuOpen(false)
    navigate("/")
  }

  const handleBrandClick = (event) => {
    event.preventDefault()
    setActiveCategory("All Categories")
    setCategoriesOpen(false)
    setMobileMenuOpen(false)
    navigate("/")
  }

  const handleSearchChange = (event) => {
    handleOnSearchInputChange(event)
    if (location.pathname !== "/") {
      navigate("/")
    }
  }

  return (
    <nav className="SubNavbar">
      <div className="content">
        <a href="/" onClick={handleBrandClick} className="brand">
          <span className="material-icons">school</span>
          <span className="brand-text">CodePath Store</span>
        </a>

        <div className={`nav-links ${mobileMenuOpen ? "is-open" : ""}`}>
          <div className="dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`nav-button ${categoriesOpen ? "is-open" : ""} ${isCategoriesActive ? "is-active" : ""}`}
              onClick={() => setCategoriesOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={categoriesOpen}
            >
              <span>{hasCategoryFilter ? activeCategory : "Categories"}</span>
              <span className="material-icons caret">expand_more</span>
            </button>

            {categoriesOpen && (
              <ul className="dropdown-menu" role="menu">
                {categories.map((cat) => (
                  <li key={cat} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className={activeCategory === cat ? "is-active" : ""}
                      onClick={() => handleCategorySelect(cat)}
                    >
                      {cat}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/orders"
            className={`nav-button ${isOrdersActive ? "is-active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Past Orders
          </Link>
        </div>

        <div className="search-bar">
          <input
            type="text"
            name="search"
            placeholder="Search products"
            value={searchInputValue}
            onChange={handleSearchChange}
          />
          <i className="material-icons">search</i>
        </div>

        <button type="button" className="cart-button" onClick={toggleSidebar} aria-label="Open cart">
          <span className="material-icons">shopping_cart</span>
          <span className="cart-label">Cart{totalCartItems > 0 ? ` (${totalCartItems})` : ""}</span>
          {totalCartItems > 0 && <span className="cart-badge">{totalCartItems}</span>}
        </button>

        <button
          type="button"
          className={`hamburger ${mobileMenuOpen ? "is-open" : ""}`}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          <span className="material-icons">{mobileMenuOpen ? "close" : "menu"}</span>
        </button>
      </div>
    </nav>
  )
}

export default SubNavbar;
