import { useLocation, useNavigate } from "react-router-dom"
import "./SubNavbar.css"

function SubNavbar({ activeCategory, setActiveCategory, searchInputValue, handleOnSearchInputChange }) {
  const navigate = useNavigate()
  const location = useLocation()

  const categories = ["All Categories", "Accessories", "Apparel", "Books", "Snacks", "Supplies"]

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat)
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

        <div className="row">
          <div className="search-bar">
            <input
              type="text"
              name="search"
              placeholder="Search"
              value={searchInputValue}
              onChange={handleSearchChange}
            />
            <i className="material-icons">search</i>
          </div>
        </div>

        <div className="row">
          <ul className={`category-menu`}>
            {categories.map((cat) => (
              <li className={activeCategory === cat ? "is-active" : ""} key={cat}>
                <button onClick={() => handleCategoryClick(cat)}>{cat}</button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </nav>
  )
}

export default SubNavbar;
