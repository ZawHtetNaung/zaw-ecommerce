import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchPublicProduct } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import RichTextContent from '../components/RichTextContent';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { getProductPurchaseLimit, isProductInStock } from '../utils/productStock';

function formatPrice(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
}

function SingleLineProductTitle({ name }) {
  const titleRef = useRef(null);

  useLayoutEffect(() => {
    const title = titleRef.current;
    const headingRow = title?.parentElement;
    if (!title || !headingRow) return undefined;

    let animationFrame = 0;
    let previousWidth = 0;

    const fitTitle = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        title.style.fontSize = '';
        const availableWidth = title.clientWidth;
        const naturalWidth = title.scrollWidth;

        if (availableWidth > 0 && naturalWidth > availableWidth) {
          const naturalSize = Number.parseFloat(window.getComputedStyle(title).fontSize);
          title.style.fontSize = `${naturalSize * (availableWidth / naturalWidth) * 0.98}px`;
        }
      });
    };

    fitTitle();
    document.fonts?.ready.then(fitTitle);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(([entry]) => {
          if (Math.abs(entry.contentRect.width - previousWidth) < 0.5) return;
          previousWidth = entry.contentRect.width;
          fitTitle();
        });

    resizeObserver?.observe(headingRow);
    window.addEventListener('resize', fitTitle);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', fitTitle);
    };
  }, [name]);

  return <h1 ref={titleRef}>{name}</h1>;
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
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [colorValidationAttempt, setColorValidationAttempt] = useState(0);
  const productSectionRef = useRef(null);

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
          setQuantity(1);
          setSelectedColorId(null);
          setColorValidationAttempt(0);
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
    const shortDescription = (product.short_description || '').replace(/<[^>]*>/g, ' ');
    const fallbackDescription = (product.description || '').replace(/<[^>]*>/g, ' ');
    description.content = product.seo_description || shortDescription || fallbackDescription;
    return () => {
      document.title = previousTitle;
      if (created) description.remove();
      else description.content = previousDescription;
    };
  }, [product]);

  const resolvedCategorySlug = categorySlug || product?.category?.slug;
  const resolvedSubCategorySlug = subCategorySlug || product?.sub_category?.slug;
  const inStock = isProductInStock(product);
  const purchaseLimit = getProductPurchaseLimit(product);
  const previousProduct = product?.navigation?.previous || null;
  const nextProduct = product?.navigation?.next || null;
  const allProductsPath = resolvedCategorySlug && resolvedSubCategorySlug
    ? `/categories/${resolvedCategorySlug}/sub-categories/${resolvedSubCategorySlug}`
    : resolvedCategorySlug
      ? `/categories/${resolvedCategorySlug}`
      : '/search';

  function navigationProductPath(navigationProduct) {
    if (resolvedCategorySlug && resolvedSubCategorySlug) {
      return `/categories/${resolvedCategorySlug}/sub-categories/${resolvedSubCategorySlug}/products/${navigationProduct.slug}`;
    }

    return `/product/${navigationProduct.slug}`;
  }

  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images.map((image, index) => ({ id: image.id, url: image.url, alt: image.alt_text || `${product.name} ${index + 1}` }));
    }
    if (Array.isArray(product.image_urls) && product.image_urls.length > 0) return product.image_urls.map((url, index) => ({ url, alt: `${product.name} ${index + 1}` }));
    if (product.image_url) return [{ url: product.image_url, alt: product.name }];
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

  function selectColor(color) {
    setSelectedColorId(Number(color.id));
    setColorValidationAttempt(0);
    setActionMessage('');

    const productImageId = Number(color?.pivot?.product_image_id || 0);
    if (productImageId) {
      const imageIndex = images.findIndex((image) => Number(image.id) === productImageId);
      if (imageIndex >= 0) setActiveIndex(imageIndex);
    }

    window.requestAnimationFrame(() => {
      productSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function addSelectedProductToCart() {
    const productColors = Array.isArray(product?.colors) ? product.colors : [];

    if (productColors.length > 0 && !selectedColorId) {
      setColorValidationAttempt((attempt) => attempt + 1);
      setActionMessage('Please choose a colour first.');
      return;
    }

    runProductAction('cart', () => addToCart(product, quantity));
  }

  async function runProductAction(type, callback) {
    if (type === 'favorite' && !isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }

    setActionBusy(type);
    setActionMessage('');
    try {
      await callback();
      setActionMessage(type === 'cart' ? `${quantity} item${quantity > 1 ? 's' : ''} added to your cart.` : 'Your favourites have been updated.');
    } catch (requestError) {
      setActionMessage(requestError.response?.data?.message || requestError.message || 'Unable to update this product right now.');
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
            <section className="public-product-detail-grid" ref={productSectionRef}>
              <div className="public-product-gallery">
                <div className="public-product-slider-box">
                  {images.length > 0 ? (
                    <img src={images[activeIndex].url} alt={images[activeIndex].alt} className="public-product-main-image" />
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
                        key={`${image.url}-${index}`}
                        className={`public-thumb-button ${activeIndex === index ? 'public-thumb-button-active' : ''}`}
                        onClick={() => setActiveIndex(index)}
                      >
                        <img src={image.url} alt={image.alt} className="product-thumb" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="public-product-summary">
                <div className="public-product-navigation-row">
                    <nav className="public-product-navigation" aria-label="Browse products">
                      {previousProduct ? (
                        <Link
                          to={navigationProductPath(previousProduct)}
                          className="public-product-navigation-button"
                          aria-label={`Previous product: ${previousProduct.name}`}
                          title={`Previous: ${previousProduct.name}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                        </Link>
                      ) : (
                        <span className="public-product-navigation-button is-disabled" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
                        </span>
                      )}
                      <Link
                        to={allProductsPath}
                        className="public-product-navigation-button"
                        aria-label={`View all ${product.sub_category?.name || 'products'}`}
                        title={`View all ${product.sub_category?.name || 'products'}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="public-product-grid-icon">
                          <rect x="4" y="4" width="6" height="6" rx="1" />
                          <rect x="14" y="4" width="6" height="6" rx="1" />
                          <rect x="4" y="14" width="6" height="6" rx="1" />
                          <rect x="14" y="14" width="6" height="6" rx="1" />
                        </svg>
                      </Link>
                      {nextProduct ? (
                        <Link
                          to={navigationProductPath(nextProduct)}
                          className="public-product-navigation-button"
                          aria-label={`Next product: ${nextProduct.name}`}
                          title={`Next: ${nextProduct.name}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                        </Link>
                      ) : (
                        <span className="public-product-navigation-button is-disabled" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
                        </span>
                      )}
                    </nav>
                </div>
                <div className="public-product-heading-row">
                    <SingleLineProductTitle name={product.name} />
                    {product.brand?.image_url && (
                      <Link
                        to={`/search?brand_id=${encodeURIComponent(product.brand.id)}`}
                        className="public-product-brand-logo"
                        aria-label={`Shop ${product.brand.name} products`}
                        title={`Shop ${product.brand.name}`}
                      >
                        <img
                          src={product.brand.image_url}
                          alt={product.brand.image_alt_text || `${product.brand.name} logo`}
                        />
                        <span className="public-product-brand-name">{product.brand.name}</span>
                      </Link>
                    )}
                </div>
                {product.short_description ? (
                  <RichTextContent className="catalog-hero-description" html={product.short_description} />
                ) : product.description ? (
                  <RichTextContent className="catalog-hero-description" html={product.description} />
                ) : (
                  <p className="catalog-hero-description">A clean and modern {product.sub_category?.name?.toLowerCase() || 'product'} presentation with the key details kept easy to read.</p>
                )}

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
                      <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={!inStock || quantity <= 1}>−</button>
                      <strong>{quantity}</strong>
                      <button type="button" onClick={() => setQuantity((current) => Math.min(purchaseLimit, current + 1))} disabled={!inStock || quantity >= purchaseLimit}>+</button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="public-add-cart-button"
                    disabled={actionBusy === 'cart' || !inStock}
                    onClick={addSelectedProductToCart}
                  >
                    {actionBusy === 'cart' ? 'Adding...' : inStock ? 'Add to cart' : 'Out of stock'}
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
                    <strong>{inStock ? `${purchaseLimit} available` : 'Out of stock'}</strong>
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

                <div
                  className={`public-product-pill-row ${colorValidationAttempt > 0 ? 'is-color-required' : ''}`}
                  key={`product-colors-${colorValidationAttempt}`}
                >
                  {(product.colors || []).map((color) => (
                    <button
                      type="button"
                      key={color.id}
                      className={`public-product-color ${Number(selectedColorId) === Number(color.id) ? 'is-selected' : ''}`}
                      title={color.name}
                      aria-pressed={Number(selectedColorId) === Number(color.id)}
                      onClick={() => selectColor(color)}
                    >
                      {color.image_url ? <img src={color.image_url} alt={color.image_alt_text || color.name} /> : <span className="public-product-color-placeholder" style={color.hex_code ? { backgroundColor: color.hex_code } : undefined} />}
                      <span className="public-product-color-name">{color.name}</span>
                    </button>
                  ))}
                  {(product.size_options || []).map((option) => (
                    <span key={option.id} className="public-product-pill secondary">Size: {option.name}</span>
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
                  {product.description ? <RichTextContent html={product.description} /> : <p>No additional description has been added for this product yet.</p>}
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
            {Array.isArray(product.faqs) && product.faqs.length > 0 && (
              <section className="catalog-section">
                <div className="catalog-section-head"><div><h2>Questions &amp; Answers</h2></div></div>
                <div className="public-product-info-panels">
                  {product.faqs.map((faq, index) => (
                    <article className="catalog-empty-panel" key={faq.id || index}>
                      <h3>Q: {faq.question}</h3>
                      <p>A: {faq.answer}</p>
                    </article>
                  ))}
                </div>

              </section>
            )}
            <section className="catalog-section">
              <div className="public-product-meta-grid">
                <div className="public-product-meta-card"><span>Product type</span><strong>{product.product_type ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1) : 'Furniture'}</strong></div>
                <div className="public-product-meta-card"><span>Sold</span><strong>{({ per_item: 'Per item', per_square_meter: 'Per m²', per_linear_meter: 'Per linear metre', per_roll: 'Per roll', per_box: 'Per box', unspecified: 'Unit to be confirmed' })[product.selling_method] || 'Unit to be confirmed'}</strong></div>
                {product.physical_weight && <div className="public-product-meta-card"><span>Weight</span><strong>{product.physical_weight} {product.weight_unit}</strong></div>}
                {product.flooring_detail?.coverage_per_box && <div className="public-product-meta-card"><span>Coverage per box</span><strong>{product.flooring_detail.coverage_per_box} m²</strong></div>}
                {product.wallpaper_detail?.coverage_per_roll && <div className="public-product-meta-card"><span>Coverage per roll</span><strong>{product.wallpaper_detail.coverage_per_roll} m²</strong></div>}
                {product.wallpaper_detail?.match_type && <div className="public-product-meta-card"><span>Pattern match</span><strong>{product.wallpaper_detail.match_type}</strong></div>}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
