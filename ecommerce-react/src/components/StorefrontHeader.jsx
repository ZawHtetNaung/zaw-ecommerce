import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CIcon from '@coreui/icons-react';
import {
  cibFacebookF,
  cibInstagram,
  cibLinkedinIn,
  cibTiktok,
  cibWhatsapp,
  cibYoutube,
  cilCart,
  cilGlobeAlt,
  cilHeart,
  cilSearch,
  cilTruck,
  cilUser,
} from '@coreui/icons';
import { fetchPublicProducts } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

function formatPrice(value) {
  return `AED ${Number(value || 0).toFixed(2)}`;
}

export default function StorefrontHeader({ onLogin, onRegister }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { cartCount, favoriteCount } = useStore();
  const searchRef = useRef(null);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (location.pathname === '/search') {
      setQuery(new URLSearchParams(location.search).get('q') || '');
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await fetchPublicProducts(1, 6, { q: trimmedQuery });
        if (!cancelled) setSuggestions(Array.isArray(data?.data) ? data.data : []);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  }

  function openAuth(type) {
    if (type === 'login' && onLogin) onLogin();
    else if (type === 'register' && onRegister) onRegister();
    else navigate(type === 'login' ? '/login' : '/register');
  }

  return (
    <div className="storefront-header-wrap">
      <div className="top-bar">
        <div className="top-bar-col">
          <button type="button" className="lang-switch">
            <CIcon icon={cilGlobeAlt} />
            <span>AE | English</span>
          </button>
        </div>
        <div className="top-bar-col center">
          <Link to="/services#delivery" className="delivery-link">
            <CIcon icon={cilTruck} />
            <span>Free delivery</span>
          </Link>
        </div>
        <div className="top-bar-col end">
          <div className="top-links">
            <Link to="/services#contact">Contact Us</Link>
            <Link to="/services#faqs">FAQs</Link>
            <Link to="/services#about">About Us</Link>
          </div>
        </div>
      </div>

      <header className="home-nav storefront-main-nav">
        <Link to="/" className="home-brand" aria-label="MessaraLiving home">
          <img className="home-logo" src="/messaraliving-logo.png" alt="MessaraLiving" />
        </Link>

        <div className="home-social" aria-label="Social links">
          <a className="social-dot" href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><CIcon icon={cibFacebookF} /></a>
          <a className="social-dot" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><CIcon icon={cibInstagram} /></a>
          <a className="social-dot" href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"><CIcon icon={cibYoutube} /></a>
          <a className="social-dot" href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><CIcon icon={cibLinkedinIn} /></a>
          <a className="social-dot" href="https://whatsapp.com" target="_blank" rel="noreferrer" aria-label="WhatsApp"><CIcon icon={cibWhatsapp} /></a>
          <a className="social-dot" href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok"><CIcon icon={cibTiktok} /></a>
        </div>

        <form className="home-search center-search" onSubmit={submitSearch} ref={searchRef}>
          <div className="home-search-field">
            <CIcon icon={cilSearch} className="search-icon" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch(event);
                }
              }}
              placeholder="what are you looking for?"
              aria-label="Search products"
              autoComplete="off"
            />
            {searchOpen && query.trim().length >= 2 && (
              <div className="search-suggestions">
                <div className="search-suggestions-label">
                  <span>{searching ? 'Searching...' : 'Product matches'}</span>
                  {!searching && <strong>{suggestions.length}</strong>}
                </div>
                {!searching && suggestions.length === 0 && (
                  <div className="search-suggestion-empty">No matching products yet. Press Enter to search all.</div>
                )}
                {suggestions.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    className="search-suggestion-item"
                    onClick={() => setSearchOpen(false)}
                  >
                    <div className="search-suggestion-image">
                      {product.image_url ? <img src={product.image_url} alt="" /> : <span>{product.name?.charAt(0)}</span>}
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.brand?.name || product.category?.name || 'MessaraLiving'}</span>
                    </div>
                    <div className="search-suggestion-price">
                      {Number(product.discount_price || 0) > 0 && <small>{formatPrice(product.price)}</small>}
                      <strong>{formatPrice(product.discount_price || product.price)}</strong>
                    </div>
                  </Link>
                ))}
                <button type="submit" className="search-view-all">
                  View all results for “{query.trim()}”
                </button>
              </div>
            )}
          </div>
        </form>

        <nav className="home-links" aria-label="Store links">
          <Link to="/services">Services</Link>
          <Link to="/news">News</Link>
        </nav>

        <div className="home-auth">
          {isAuthenticated ? (
            <Link className="account-link" to="/profile" title="My profile">
              <CIcon icon={cilUser} />
              <span>{user?.name || 'My account'}</span>
            </Link>
          ) : (
            <>
              <button type="button" className="auth-link" onClick={() => openAuth('login')}>Login</button>
              <button type="button" className="auth-link" onClick={() => openAuth('register')}>Register</button>
            </>
          )}
        </div>

        <div className="home-icons">
          <Link to="/services#delivery" title="Delivery services" aria-label="Delivery services"><CIcon icon={cilTruck} /></Link>
          <Link to="/favourites" title="Favourites" aria-label={`Favourites, ${favoriteCount} items`}>
            <CIcon icon={cilHeart} />
            {favoriteCount > 0 && <span className="store-icon-badge">{favoriteCount}</span>}
          </Link>
          <Link to="/cart" title="Cart" aria-label={`Cart, ${cartCount} items`}>
            <CIcon icon={cilCart} />
            {cartCount > 0 && <span className="store-icon-badge">{cartCount}</span>}
          </Link>
        </div>
      </header>
    </div>
  );
}
