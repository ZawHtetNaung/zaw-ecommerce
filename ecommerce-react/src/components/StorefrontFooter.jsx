import { Link } from 'react-router-dom';

const currentYear = new Date().getFullYear();

export default function StorefrontFooter() {
  return (
    <footer className="storefront-footer">
      <div className="storefront-footer-main">
        <div className="storefront-footer-brand">
          <Link to="/" aria-label="MessaraLiving home">
            <img src="/messaraliving-logo.png" alt="MessaraLiving" />
          </Link>
          <p>Furniture, flooring, wallpaper, and outdoor collections selected for modern living in the UAE.</p>
          <div className="storefront-footer-location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            <span>AE | English</span>
          </div>
        </div>

        <nav className="storefront-footer-column" aria-label="Footer shopping links">
          <strong>Shop</strong>
          <Link to="/search">All products</Link>
          <Link to="/#featured-categories">Categories</Link>
          <Link to="/#products">New arrivals</Link>
          <Link to="/favourites">Favourites</Link>
        </nav>

        <nav className="storefront-footer-column" aria-label="Footer support links">
          <strong>Customer care</strong>
          <Link to="/services#delivery">Delivery information</Link>
          <Link to="/services#contact">Contact us</Link>
          <Link to="/services#faqs">FAQs</Link>
          <Link to="/services#about">About us</Link>
        </nav>

        <nav className="storefront-footer-column" aria-label="Footer account links">
          <strong>Your account</strong>
          <Link to="/profile">Profile</Link>
          <Link to="/cart">Shopping cart</Link>
          <Link to="/checkout">Checkout</Link>
          <Link to="/news">News</Link>
        </nav>
      </div>

      <div className="storefront-footer-bottom">
        <span>© {currentYear} MessaraLiving. All rights reserved.</span>
        <span>Designed for modern UAE homes.</span>
      </div>
    </footer>
  );
}
