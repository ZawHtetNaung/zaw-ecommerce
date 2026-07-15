import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CIcon from '@coreui/icons-react';
import { cilCart, cilHeart } from '@coreui/icons';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

function formatPrice(value) {
  return `AED ${Number(value || 0).toFixed(2)}`;
}

export default function StoreProductCard({ product }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addToCart, addToFavorites, removeFromFavorites, isFavorite } = useStore();
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const favorite = isFavorite(product.id);
  const hasDiscount = Number(product.discount_price || 0) > 0;

  async function runAuthenticatedAction(action, callback) {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }

    setBusyAction(action);
    setMessage('');
    try {
      await callback();
      setMessage(action === 'cart' ? 'Added to cart' : favorite ? 'Removed' : 'Saved');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Please try again.');
    } finally {
      setBusyAction('');
    }
  }

  return (
    <article className="store-product-card">
      <Link to={`/product/${product.slug}`} className="store-product-media">
        {product.image_url ? <img src={product.image_url} alt={product.name} /> : <span>{product.name?.charAt(0)}</span>}
        {hasDiscount && <span className="product-sale-badge">Sale</span>}
      </Link>
      <div className="store-product-copy">
        <span className="store-product-brand">{product.brand?.name || product.category?.name || 'MessaraLiving'}</span>
        <Link to={`/product/${product.slug}`}><h3>{product.name}</h3></Link>
        <div className="store-product-price">
          {hasDiscount && <small>{formatPrice(product.price)}</small>}
          <strong className={hasDiscount ? 'is-sale' : ''}>{formatPrice(product.discount_price || product.price)}</strong>
        </div>
        <div className="store-product-actions">
          <button
            type="button"
            className={favorite ? 'is-active' : ''}
            disabled={busyAction === 'favorite'}
            onClick={() => runAuthenticatedAction('favorite', () => favorite ? removeFromFavorites(product.id) : addToFavorites(product.id))}
            aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <CIcon icon={cilHeart} />
          </button>
          <button
            type="button"
            className="store-add-cart"
            disabled={busyAction === 'cart' || Number(product.stock || 0) < 1}
            onClick={() => runAuthenticatedAction('cart', () => addToCart(product.id))}
          >
            <CIcon icon={cilCart} />
            <span>{Number(product.stock || 0) > 0 ? 'Add to cart' : 'Out of stock'}</span>
          </button>
        </div>
        {message && <span className="store-card-message">{message}</span>}
      </div>
    </article>
  );
}
