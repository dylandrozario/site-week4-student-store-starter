import ProductGrid from "../ProductGrid/ProductGrid"
import gameday from "../../assets/gameday.png"
import "./Home.css"

function Home({ isFetching, products, addToCart, removeFromCart, searchInputValue, getQuantityOfItemInCart, activeCategory, clearFilters }) {

  const productsByCategory =
    Boolean(activeCategory) && activeCategory !== "All Categories"
      ? products.filter((p) => p.category === activeCategory)
      : products

  const productsToShow = Boolean(searchInputValue)
    ? productsByCategory.filter((p) => p.name.toLowerCase().indexOf(searchInputValue.toLowerCase()) !== -1)
    : productsByCategory

  const sectionHeading =
    activeCategory && activeCategory !== "All Categories"
      ? `${activeCategory} For You!`
      : "Student Picks!"

  const hasActiveFilters =
    (activeCategory && activeCategory !== "All Categories") ||
    Boolean(searchInputValue)

  return (
    <div className="Home">
      <section className="hero">
        <div className="hero-content">
          <h1>
            Save Big On <br /> Game Day Gear
          </h1>
          <p className="hero-sub">
            Hoodies, books, snacks, and supplies — everything a student needs, all in one place.
          </p>
        </div>
        <div className="hero-image" aria-hidden="true">
          <img src={gameday} alt="" className="hero-image-inner" />
        </div>
      </section>

      <section id="products" className="catalog">
        <div className="catalog-header">
          <h2 className="catalog-heading">{sectionHeading}</h2>
          {hasActiveFilters && clearFilters && (
            <button type="button" className="clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        {isFetching ? (
          <p className="catalog-state">Loading...</p>
        ) : productsToShow.length === 0 ? (
          <p className="catalog-state">No products found.</p>
        ) : (
          <ProductGrid
            products={productsToShow}
            isFetching={isFetching}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            getQuantityOfItemInCart={getQuantityOfItemInCart}
          />
        )}
      </section>
    </div>
  )
}

export default Home;
