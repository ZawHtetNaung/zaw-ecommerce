import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchPublicProduct } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

function formatPrice(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
}

export default function PublicProductDetailPage() {
  const { categorySlug, subCategorySlug, productSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addToCart, addToFavorites, removeFromFavorites, isFavorite } = useStore();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [actionBusy, setActionBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError('');

      try {
        const data = await fetchPublicProduct(categorySlug, subCategorySlug, productSlug);
        if (!cancelled) {
          setProduct(data);
          setActiveIndex(0);
        }
      } catch (requestError) {
        if (!cancelled) {
          setProduct(null);
          setError(requestError.response?.status === 404 ? 'Product not found.' : 'Unable to load product details right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [categorySlug, subCategorySlug, productSlug]);

  useEffect(() => {
    if (!product) return undefined;
    const previousTitle = document.title;
    document.title = product.seo_title || `${product.name} | Messara Living`;
    let description = document.querySelector('meta[name="description"]');
    const created = !description;
    if (created) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    const previousDescription = description.content;
    description.content = product.seo_description || product.short_description || product.description || '';
    return () => {
      document.title = previousTitle;
      if (created) description.remove();
      else description.content = previousDescription;
    };
  }, [product]);

  const resolvedCategorySlug = categorySlug || product?.category?.slug;
  const resolvedSubCategorySlug = subCategorySlug || product?.sub_category?.slug;

  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.image_urls) && product.image_urls.length > 0) return product.image_urls;
    if (product.image_url) return [product.image_url];
    return [];
  }, [product]);

  function showPrev() {
    if (images.length === 0) return;
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }

  function showNext() {
    if (images.length === 0) return;
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }

  async function runProductAction(type, callback) {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }

    setActionBusy(type);
    setActionMessage('');
    try {
      await callback();
      setActionMessage(type === 'cart' ? `${quantity} item${quantity > 1 ? 's' : ''} added to your cart.` : 'Your favourites have been updated.');
    } catch (requestError) {
      setActionMessage(requestError.response?.data?.message || 'Unable to update this product right now.');
    } finally {
      setActionBusy('');
    }
  }

  return (
    <div className="catalog-page">
      <StorefrontHeader />
      <div className="catalog-shell product-detail-shell">
        <div className="catalog-breadcrumbs">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to={`/categories/${resolvedCategorySlug}`}>{product?.category?.name || 'Category'}</Link>
          <span>/</span>
          <Link to={`/categories/${resolvedCategorySlug}/sub-categories/${resolvedSubCategorySlug}`}>{product?.sub_category?.name || 'Products'}</Link>
          <span>/</span>
          <span>{loading ? 'Loading...' : product?.name || 'Product'}</span>
        </div>

        {loading ? (
          <section className="catalog-hero catalog-hero-loading" />
        ) : error ? (
          <section className="catalog-empty-state">
            <h1>{error}</h1>
            <p>We could not load that product right now. Please return to the product list and try again.</p>
            <Link to={`/categories/${resolvedCategorySlug}/sub-categories/${resolvedSubCategorySlug}`} className="catalog-primary-link">Back to Products</Link>
          </section>
        ) : product ? (
          <>
            <section className="public-product-detail-grid">
              <div className="public-product-gallery">
                <div className="public-product-slider-box">
                  {images.length > 0 ? (
                    <img src={images[activeIndex]} alt={product.name} className="public-product-main-image" />
                  ) : (
                    <div className="catalog-hero-placeholder">No image</div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="public-product-gallery-actions">
                    <button type="button" className="catalog-home-link" onClick={showPrev}>Prev</button>
                    <button type="button" className="catalog-home-link" onClick={showNext}>Next</button>
                  </div>
                )}
                {images.length > 1 && (
                  <div className="public-thumb-row">
                    {images.map((image, index) => (
                      <button
                        type="button"
                        key={`${image}-${index}`}
                        className={`public-thumb-button ${activeIndex === index ? 'public-thumb-button-active' : ''}`}
                        onClick={() => setActiveIndex(index)}
                      >
                        <img src={image} alt={`${product.name} ${index + 1}`} className="product-thumb" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="public-product-summary">
                <span className="catalog-eyebrow">MessaraLiving Product</span>
                <h1>{product.name}</h1>
                <p className="catalog-hero-description">
                  {product.description || `A clean and modern ${product.sub_category?.name?.toLowerCase() || 'product'} presentation with the key details kept easy to read.`}
                </p>

                <div className="public-product-price-row">
                  {Number(product.discount_price || 0) > 0 ? (
                    <>
                      <span className="price-old">AED {formatPrice(product.price)}</span>
                      <span className="price-discount public-price-highlight">AED {formatPrice(product.discount_price)}</span>
                    </>
                  ) : (
                    <span className="public-price-highlight">AED {formatPrice(product.price)}</span>
                  )}
                </div>

                <div className="public-purchase-panel">
                  <div className="public-quantity-control">
                    <span>Quantity</span>
                    <div>
                      <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1}>−</button>
                      <strong>{quantity}</strong>
                      <button type="button" onClick={() => setQuantity((current) => Math.min(Number(product.stock || 1), current + 1))} disabled={quantity >= Number(product.stock || 0)}>+</button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="public-add-cart-button"
                    disabled={actionBusy === 'cart' || Number(product.stock || 0) < 1}
                    onClick={() => runProductAction('cart', () => addToCart(product.id, quantity))}
                  >
                    {actionBusy === 'cart' ? 'Adding...' : Number(product.stock || 0) > 0 ? 'Add to cart' : 'Out of stock'}
                  </button>
                  <button
                    type="button"
                    className={`public-favourite-button ${isFavorite(product.id) ? 'is-active' : ''}`}
                    disabled={actionBusy === 'favorite'}
                    onClick={() => runProductAction('favorite', () => isFavorite(product.id) ? removeFromFavorites(product.id) : addToFavorites(product.id))}
                  >
                    {isFavorite(product.id) ? '♥ Saved' : '♡ Save'}
                  </button>
                </div>
                {actionMessage && <div className="public-product-action-message">{actionMessage}</div>}

                <div className="public-product-meta-grid">
                  <div className="public-product-meta-card">
                    <span>Brand</span>
                    <strong>{product.brand?.name || 'MessaraLiving'}</strong>
                  </div>
                  <div className="public-product-meta-card">
                    <span>Stock</span>
                    <strong>{Number(product.stock || 0) > 0 ? `${product.stock} available` : 'Out of stock'}</strong>
                  </div>
                  <div className="public-product-meta-card">
                    <span>Category</span>
                    <strong>{product.category?.name || '-'}</strong>
                  </div>
                  <div className="public-product-meta-card">
                    <span>Sub category</span>
                    <strong>{product.sub_category?.name || '-'}</strong>
                  </div>
                </div>

                <div className="public-product-pill-row">
                  {(product.colors || []).map((color) => (
                    <span key={color.id} className="public-product-pill">{color.name}</span>
                  ))}
                  {(product.measurements || []).map((measurement) => (
                    <span key={measurement.id} className="public-product-pill secondary">{measurement.name}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="catalog-section">
              <div className="catalog-section-head">
                <div>
                  <h2>Product details</h2>
                  <p>Everything important is grouped in a simple layout so the page stays clean and easy to understand.</p>
                </div>
              </div>

              <div className="public-product-info-panels">
                <article className="catalog-empty-panel">
                  <h3>Description</h3>
                  <p>{product.description || 'No additional description has been added for this product yet.'}</p>
                </article>
                <article className="catalog-empty-panel">
                  <h3>Measurements</h3>
                  {Array.isArray(product.measurements) && product.measurements.length > 0 ? (
                    <div className="public-info-list">
                      {product.measurements.map((measurement) => (
                        <div key={measurement.id} className="public-info-row">
                          <span>{measurement.name}</span>
                          <strong>{measurement.pivot?.value ?? measurement.value} {measurement.pivot?.unit ?? measurement.unit}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No measurements added yet.</p>
                  )}
                </article>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
