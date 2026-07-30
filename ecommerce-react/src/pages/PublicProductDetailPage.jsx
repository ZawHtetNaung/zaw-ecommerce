import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchPublicProduct,
  fetchPublicSubCategoryProducts,
} from '../api/client';
import StoreProductCard from '../components/StoreProductCard';
import StorefrontHeader from '../components/StorefrontHeader';
import RichTextContent from '../components/RichTextContent';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { buildProductMeasurements } from '../utils/productMeasurements';
import { getProductPurchaseLimit, isProductInStock } from '../utils/productStock';

const FALLBACK_IMAGE = '/messaraliving-logo.png';

function formatPrice(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
}

function humanize(value, fallback = 'Not specified') {
  if (!value) return fallback;
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function productImageError(event) {
  if (event.currentTarget.src.endsWith(FALLBACK_IMAGE)) return;
  event.currentTarget.src = FALLBACK_IMAGE;
  event.currentTarget.classList.add('is-fallback');
}

function FittedProductTitle({ name }) {
  const titleRef = useRef(null);

  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return undefined;

    let animationFrame = 0;
    const fitTitle = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        title.style.fontSize = '';
        const availableWidth = title.clientWidth;
        const naturalWidth = title.scrollWidth;
        if (!availableWidth || naturalWidth <= availableWidth) return;

        const naturalSize = Number.parseFloat(window.getComputedStyle(title).fontSize);
        const fittedSize = Math.max(18, naturalSize * (availableWidth / naturalWidth) * 0.98);
        title.style.fontSize = `${fittedSize}px`;
      });
    };

    fitTitle();
    document.fonts?.ready.then(fitTitle);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitTitle);
    resizeObserver?.observe(title.parentElement);
    window.addEventListener('resize', fitTitle);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', fitTitle);
    };
  }, [name]);

  return <h1 ref={titleRef} title={name}>{name}</h1>;
}

function ProductNavigation({ previousProduct, nextProduct, allProductsPath, productPath }) {
  return (
    <nav className="pdp-navigation" aria-label="Browse products">
      {previousProduct ? (
        <Link
          to={productPath(previousProduct)}
          className="pdp-navigation-button"
          aria-label={`Previous product: ${previousProduct.name}`}
          title={`Previous: ${previousProduct.name}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
      ) : (
        <span className="pdp-navigation-button is-disabled" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
        </span>
      )}
      <Link
        to={allProductsPath}
        className="pdp-navigation-button"
        aria-label="View all products in this collection"
        title="View all products"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="pdp-grid-icon">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      </Link>
      {nextProduct ? (
        <Link
          to={productPath(nextProduct)}
          className="pdp-navigation-button"
          aria-label={`Next product: ${nextProduct.name}`}
          title={`Next: ${nextProduct.name}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </Link>
      ) : (
        <span className="pdp-navigation-button is-disabled" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        </span>
      )}
    </nav>
  );
}

export default function PublicProductDetailPage() {
  const { categorySlug, subCategorySlug, productSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addToCart, addToQuotation, addToFavorites, removeFromFavorites, isFavorite } = useStore();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [actionBusy, setActionBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [selectedSizeId, setSelectedSizeId] = useState(null);
  const [optionValidationAttempt, setOptionValidationAttempt] = useState(0);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageViewerFullscreen, setImageViewerFullscreen] = useState(false);
  const productSectionRef = useRef(null);
  const imageViewerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError('');
      setRelatedProducts([]);

      try {
        const data = await fetchPublicProduct(categorySlug, subCategorySlug, productSlug);
        if (cancelled) return;

        setProduct(data);
        setActiveIndex(0);
        setQuantity(1);
        setSelectedColorId(null);
        setSelectedSizeId(data.size_options?.[0]?.id ? Number(data.size_options[0].id) : null);
        setOptionValidationAttempt(0);
      } catch (requestError) {
        if (!cancelled) {
          setProduct(null);
          setError(requestError.response?.status === 404 ? 'Product not found.' : 'Unable to load product details right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [categorySlug, subCategorySlug, productSlug]);

  useEffect(() => {
    if (!product?.id || !product.category?.slug || !product.sub_category?.slug) return undefined;
    let cancelled = false;

    fetchPublicSubCategoryProducts(product.category.slug, product.sub_category.slug)
      .then((data) => {
        if (cancelled) return;
        setRelatedProducts(
          (data.products || [])
            .filter((item) => Number(item.id) !== Number(product.id))
            .slice(0, 8),
        );
      })
      .catch(() => {
        if (!cancelled) setRelatedProducts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category?.slug, product?.sub_category?.slug]);

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

  useEffect(() => {
    if (!imageViewerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleViewerKeyboard(event) {
      if (event.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          setImageViewerOpen(false);
          setImageZoom(1);
        }
      }
      if (event.key === 'ArrowLeft') showPrev();
      if (event.key === 'ArrowRight') showNext();
      if (event.key === '+' || event.key === '=') {
        setImageZoom((current) => Math.min(4, Number((current + 0.25).toFixed(2))));
      }
      if (event.key === '-') {
        setImageZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))));
      }
    }

    document.addEventListener('keydown', handleViewerKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleViewerKeyboard);
    };
  }, [imageViewerOpen]);

  useEffect(() => {
    function handleFullscreenChange() {
      setImageViewerFullscreen(document.fullscreenElement === imageViewerRef.current);
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images.map((image, index) => ({
        id: image.id,
        url: image.url,
        alt: image.alt_text || `${product.name} ${index + 1}`,
      }));
    }
    if (Array.isArray(product.image_urls) && product.image_urls.length > 0) {
      return product.image_urls.map((url, index) => ({ url, alt: `${product.name} ${index + 1}` }));
    }
    if (product.image_url) return [{ url: product.image_url, alt: product.name }];
    return [{ url: FALLBACK_IMAGE, alt: 'Messara Living' }];
  }, [product]);

  const measurements = useMemo(() => buildProductMeasurements(product), [product]);

  const hasDiscount = Number(product?.discount_price || 0) > 0;
  const discountPercentage = hasDiscount && Number(product?.price || 0) > 0
    ? Math.round((1 - (Number(product.discount_price) / Number(product.price))) * 100)
    : 0;
  const summaryText = String(product?.short_description || product?.description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const summaryExcerpt = summaryText.length > 190
    ? `${summaryText.slice(0, 187).trimEnd()}...`
    : summaryText;
  const selectedColor = (product?.colors || []).find((color) => Number(color.id) === Number(selectedColorId));
  const selectedSize = (product?.size_options || []).find((size) => Number(size.id) === Number(selectedSizeId));

  function navigationProductPath(navigationProduct) {
    if (resolvedCategorySlug && resolvedSubCategorySlug) {
      return `/categories/${resolvedCategorySlug}/sub-categories/${resolvedSubCategorySlug}/products/${navigationProduct.slug}`;
    }
    return `/product/${navigationProduct.slug}`;
  }

  function showPrev() {
    if (images.length === 0) return;
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  }

  function showNext() {
    if (images.length === 0) return;
    setActiveIndex((current) => (current === images.length - 1 ? 0 : current + 1));
  }

  function openImageViewer() {
    setImageZoom(1);
    setImageViewerOpen(true);
  }

  async function closeImageViewer() {
    if (document.fullscreenElement === imageViewerRef.current) {
      await document.exitFullscreen?.();
    }
    setImageViewerOpen(false);
    setImageZoom(1);
  }

  async function toggleImageViewerFullscreen() {
    if (!imageViewerRef.current) return;

    if (document.fullscreenElement === imageViewerRef.current) {
      await document.exitFullscreen?.();
    } else {
      await imageViewerRef.current.requestFullscreen?.();
    }
  }

  function selectColor(color) {
    setSelectedColorId(Number(color.id));
    setOptionValidationAttempt(0);
    setActionMessage('');

    const productImageId = Number(color?.pivot?.product_image_id || 0);
    if (productImageId) {
      const imageIndex = images.findIndex((image) => Number(image.id) === productImageId);
      if (imageIndex >= 0) setActiveIndex(imageIndex);
    }
  }

  function addSelectedProductToCart() {
    const productColors = Array.isArray(product?.colors) ? product.colors : [];
    const productSizes = Array.isArray(product?.size_options) ? product.size_options : [];

    if (productColors.length > 0 && !selectedColorId) {
      setOptionValidationAttempt((attempt) => attempt + 1);
      setActionMessage('Please choose a colour first.');
      return;
    }

    if (productSizes.length > 0 && !selectedSizeId) {
      setOptionValidationAttempt((attempt) => attempt + 1);
      setActionMessage('Please choose a size first.');
      return;
    }

    runProductAction('cart', () => addToCart(product, quantity));
  }

  function addSelectedProductToQuotation() {
    const productColors = Array.isArray(product?.colors) ? product.colors : [];
    const productSizes = Array.isArray(product?.size_options) ? product.size_options : [];

    if (productColors.length > 0 && !selectedColorId) {
      setOptionValidationAttempt((attempt) => attempt + 1);
      setActionMessage('Please choose a colour first.');
      return;
    }

    if (productSizes.length > 0 && !selectedSizeId) {
      setOptionValidationAttempt((attempt) => attempt + 1);
      setActionMessage('Please choose a size first.');
      return;
    }

    addToQuotation({
      ...product,
      image_url: images[activeIndex]?.url || product.image_url,
    }, quantity, {
      color: selectedColor,
      size: selectedSize,
    });
    navigate('/quotation');
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
      setActionMessage(type === 'cart'
        ? `${quantity} item${quantity > 1 ? 's' : ''} added to your cart.`
        : 'Your favourites have been updated.');
    } catch (requestError) {
      setActionMessage(requestError.response?.data?.message || requestError.message || 'Unable to update this product right now.');
    } finally {
      setActionBusy('');
    }
  }

  return (
    <div className="catalog-page product-detail-page">
      <StorefrontHeader />
      <main className="pdp-shell">
        <div className="pdp-breadcrumb-row">
          <div className="catalog-breadcrumbs">
            <Link to="/">Home</Link>
            <span>/</span>
            {resolvedCategorySlug ? (
              <Link to={`/categories/${resolvedCategorySlug}`}>{product?.category?.name || 'Category'}</Link>
            ) : <span>Category</span>}
            <span>/</span>
            {resolvedCategorySlug && resolvedSubCategorySlug ? (
              <Link to={`/categories/${resolvedCategorySlug}/sub-categories/${resolvedSubCategorySlug}`}>
                {product?.sub_category?.name || 'Products'}
              </Link>
            ) : <span>Products</span>}
            <span>/</span>
            <span>{loading ? 'Loading...' : product?.name || 'Product'}</span>
          </div>

          {product && (
            <ProductNavigation
              previousProduct={previousProduct}
              nextProduct={nextProduct}
              allProductsPath={allProductsPath}
              productPath={navigationProductPath}
            />
          )}
        </div>

        {loading ? (
          <section className="pdp-loading" aria-label="Loading product">
            <div />
            <div />
          </section>
        ) : error ? (
          <section className="catalog-empty-state pdp-error-state">
            <span className="pdp-eyebrow">We could not open this item</span>
            <h1>{error}</h1>
            <p>Please return to the product list and try again.</p>
            <Link to={allProductsPath} className="catalog-primary-link">Back to products</Link>
          </section>
        ) : product ? (
          <>
            <section className="pdp-hero" ref={productSectionRef}>
              <div className="pdp-gallery">
                <div className="pdp-gallery-layout">
                  {images.length > 1 && (
                    <div className="pdp-thumbnail-rail" aria-label="Product images">
                      {images.map((image, index) => (
                        <button
                          type="button"
                          key={`${image.url}-${index}`}
                          className={`pdp-thumbnail ${activeIndex === index ? 'is-active' : ''}`}
                          onClick={() => setActiveIndex(index)}
                          aria-label={`Show product image ${index + 1}`}
                          aria-pressed={activeIndex === index}
                        >
                          <img src={image.url} alt="" onError={productImageError} />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pdp-media-frame">
                    <button
                      type="button"
                      className="pdp-main-image-trigger"
                      onClick={openImageViewer}
                      aria-label={`Open full-screen image viewer for ${product.name}`}
                    >
                      <img
                        src={images[activeIndex]?.url || FALLBACK_IMAGE}
                        alt={images[activeIndex]?.alt || product.name}
                        className="pdp-main-image"
                        onError={productImageError}
                      />
                      <span className="pdp-image-zoom-cue" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-4-4M11 8v6M8 11h6" />
                        </svg>
                        Zoom
                      </span>
                    </button>
                    {images.length > 1 && (
                      <>
                        <button type="button" className="pdp-media-arrow is-previous" onClick={showPrev} aria-label="Previous image">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <button type="button" className="pdp-media-arrow is-next" onClick={showNext} aria-label="Next image">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                        <span className="pdp-media-counter">{activeIndex + 1} / {images.length}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <aside className="pdp-buy-box">
                <div className="pdp-summary-kicker">
                  <span>{product.sub_category?.name || humanize(product.product_type)}</span>
                  {hasDiscount && <strong>{discountPercentage > 0 ? `${discountPercentage}% off` : 'Special price'}</strong>}
                </div>

                <div className="pdp-title-row">
                  <div>
                    <FittedProductTitle name={product.name} />
                    {summaryExcerpt && <p className="pdp-short-description">{summaryExcerpt}</p>}
                    {product.sku && <span className="pdp-article-number">Article number: {product.sku}</span>}
                  </div>
                  {product.brand?.image_url && (
                    <Link
                      to={`/search?brand_id=${encodeURIComponent(product.brand.id)}`}
                      className="pdp-brand-mark"
                      title={`Shop ${product.brand.name}`}
                    >
                      <img
                        src={product.brand.image_url}
                        alt={product.brand.image_alt_text || `${product.brand.name} logo`}
                        onError={productImageError}
                      />
                    </Link>
                  )}
                </div>

                {product.event?.name && (
                  <div className="pdp-event-note">
                    <span>Limited offer</span>
                    <strong>{product.event.name}</strong>
                  </div>
                )}

                <div className="pdp-price-block">
                  <div className="pdp-price-line">
                    {hasDiscount && <span className="pdp-old-price">AED {formatPrice(product.price)}</span>}
                    <strong className={hasDiscount ? 'is-discounted' : ''}>
                      AED {formatPrice(product.discount_price || product.price)}
                    </strong>
                  </div>
                  <small>Price includes VAT</small>
                </div>

                {(product.size_options || []).length > 0 && (
                  <fieldset className={`pdp-option-group ${optionValidationAttempt > 0 && !selectedSizeId ? 'has-error' : ''}`}>
                    <legend>
                      <span>Choose size</span>
                      {selectedSize && <strong>{selectedSize.name}</strong>}
                    </legend>
                    <div className="pdp-size-options">
                      {product.size_options.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={Number(selectedSizeId) === Number(option.id) ? 'is-selected' : ''}
                          onClick={() => {
                            setSelectedSizeId(Number(option.id));
                            setOptionValidationAttempt(0);
                            setActionMessage('');
                          }}
                          aria-pressed={Number(selectedSizeId) === Number(option.id)}
                        >
                          {option.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                {(product.colors || []).length > 0 && (
                  <fieldset className={`pdp-option-group ${optionValidationAttempt > 0 && !selectedColorId ? 'has-error' : ''}`}>
                    <legend>
                      <span>Choose colour</span>
                      <strong>{selectedColor?.name || 'Select an option'}</strong>
                    </legend>
                    <div className="pdp-colour-options">
                      {product.colors.map((color) => (
                        <button
                          type="button"
                          key={color.id}
                          className={Number(selectedColorId) === Number(color.id) ? 'is-selected' : ''}
                          onClick={() => selectColor(color)}
                          title={color.name}
                          aria-label={color.name}
                          aria-pressed={Number(selectedColorId) === Number(color.id)}
                        >
                          {color.image_url ? (
                            <img src={color.image_url} alt="" onError={productImageError} />
                          ) : (
                            <span style={color.hex_code ? { backgroundColor: color.hex_code } : undefined} />
                          )}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                <section className="pdp-fulfilment" aria-labelledby="pdp-fulfilment-title">
                  <h2 id="pdp-fulfilment-title">How to get it</h2>
                  <div className="pdp-fulfilment-list">
                    <div className="pdp-fulfilment-item">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 6h11v10H3zM14 10h3l4 4v2h-7z" />
                        <circle cx="7" cy="18" r="2" />
                        <circle cx="17" cy="18" r="2" />
                      </svg>
                      <div>
                        <strong>Delivery</strong>
                        <span>{inStock ? 'Available for delivery' : 'Currently unavailable'}</span>
                        <small>{product.requires_paid_shipping ? 'Delivery fee calculated at checkout' : 'Free delivery available'}</small>
                      </div>
                      <span className={`pdp-status-dot ${inStock ? 'is-available' : ''}`} />
                    </div>
                    <Link to="/services" className="pdp-fulfilment-item">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 10h16v10H4zM3 10l2-6h14l2 6M9 20v-5h6v5" />
                      </svg>
                      <div>
                        <strong>Showroom assistance</strong>
                        <span>Contact us to confirm availability</span>
                        <small>Our team can help with product selection</small>
                      </div>
                      <svg className="pdp-inline-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    </Link>
                  </div>
                </section>

                <div className="pdp-purchase-actions">
                  <div className="pdp-quantity-control" aria-label="Quantity">
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={!inStock || quantity <= 1}
                      aria-label="Decrease quantity"
                    >−</button>
                    <strong>{quantity}</strong>
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.min(purchaseLimit, current + 1))}
                      disabled={!inStock || quantity >= purchaseLimit}
                      aria-label="Increase quantity"
                    >+</button>
                  </div>
                  <button
                    type="button"
                    className="pdp-add-cart-button"
                    disabled={actionBusy === 'cart' || !inStock}
                    onClick={addSelectedProductToCart}
                  >
                    {actionBusy === 'cart' ? 'Adding...' : inStock ? 'Add to cart' : 'Out of stock'}
                  </button>
                  <button
                    type="button"
                    className={`pdp-favourite-button ${isFavorite(product.id) ? 'is-active' : ''}`}
                    disabled={actionBusy === 'favorite'}
                    onClick={() => runProductAction(
                      'favorite',
                      () => isFavorite(product.id) ? removeFromFavorites(product.id) : addToFavorites(product.id),
                    )}
                    aria-label={isFavorite(product.id) ? 'Remove from favourites' : 'Add to favourites'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  className="pdp-quotation-button"
                  onClick={addSelectedProductToQuotation}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h8" />
                  </svg>
                  Add to quotation
                </button>
                {actionMessage && <div className="pdp-action-message" role="status">{actionMessage}</div>}

                <div className="pdp-stock-line">
                  <span className={inStock ? 'is-available' : ''} />
                  <strong>{inStock ? 'In stock' : 'Out of stock'}</strong>
                  {inStock && <small>{purchaseLimit} available</small>}
                </div>
              </aside>
            </section>

            <section className="pdp-feature-strip" aria-label="Product highlights">
              <article>
                <span>01</span>
                <div><small>Product type</small><strong>{humanize(product.product_type, 'Furniture')}</strong></div>
              </article>
              <article>
                <span>02</span>
                <div><small>Sold</small><strong>{humanize(product.selling_method, 'Per item')}</strong></div>
              </article>
              <article>
                <span>03</span>
                <div><small>Collection</small><strong>{product.sub_category?.name || product.category?.name || 'Messara Living'}</strong></div>
              </article>
              <article>
                <span>04</span>
                <div><small>Delivery</small><strong>{product.requires_paid_shipping ? 'Calculated at checkout' : 'Free delivery'}</strong></div>
              </article>
            </section>

            <section className="pdp-story">
              <div className="pdp-story-copy">
                <span className="pdp-eyebrow">Made for your space</span>
                <h2>{product.name}</h2>
                {product.description || product.short_description ? (
                  <RichTextContent html={product.description || product.short_description} />
                ) : (
                  <p>Explore the available colours, sizes and product information to find the right fit for your room.</p>
                )}
              </div>
              <div className="pdp-article-card">
                <span>Product reference</span>
                <strong>{product.sku || `ML-${product.id}`}</strong>
                <small>{product.brand?.name || 'Messara Living'}</small>
              </div>
            </section>

            <section className="pdp-information" aria-labelledby="product-information-heading">
              <div className="pdp-section-heading">
                <span className="pdp-eyebrow">Know your product</span>
                <h2 id="product-information-heading">Product information</h2>
              </div>

              <div className="pdp-accordion">
                <details open>
                  <summary>
                    <span>Product details</span>
                    <span className="pdp-summary-plus" />
                  </summary>
                  <div className="pdp-accordion-content pdp-fact-grid">
                    <div><span>Brand</span><strong>{product.brand?.name || 'Messara Living'}</strong></div>
                    <div><span>Category</span><strong>{product.category?.name || 'Not specified'}</strong></div>
                    <div><span>Subcategory</span><strong>{product.sub_category?.name || 'Not specified'}</strong></div>
                    <div><span>Product type</span><strong>{humanize(product.product_type, 'Furniture')}</strong></div>
                    <div><span>Selling method</span><strong>{humanize(product.selling_method, 'Per item')}</strong></div>
                    <div><span>Article number</span><strong>{product.sku || `ML-${product.id}`}</strong></div>
                  </div>
                </details>

                <details>
                  <summary>
                    <span>Measurements</span>
                    <span className="pdp-summary-plus" />
                  </summary>
                  <div className="pdp-accordion-content">
                    {measurements.length > 0 ? (
                      <div className="pdp-measurement-list">
                        {measurements.map((measurement, index) => (
                          <div key={`${measurement.label}-${index}`}>
                            <span>{measurement.label}</span>
                            <strong>{measurement.value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>Measurements have not been added for this product yet.</p>
                    )}
                  </div>
                </details>

                <details>
                  <summary>
                    <span>Good to know</span>
                    <span className="pdp-summary-plus" />
                  </summary>
                  <div className="pdp-accordion-content pdp-good-to-know">
                    <p>{inStock ? 'This product is currently available to order.' : 'This product is currently out of stock.'}</p>
                    <p>{product.requires_paid_shipping
                      ? 'A delivery fee may apply and will be calculated during checkout.'
                      : 'This item is eligible for free delivery.'}</p>
                    {product.flooring_detail?.waste_percentage && (
                      <p>For flooring installation, allow approximately {product.flooring_detail.waste_percentage}% extra material for cutting and waste.</p>
                    )}
                  </div>
                </details>

                {Array.isArray(product.faqs) && product.faqs.length > 0 && (
                  <details>
                    <summary>
                      <span>Questions &amp; answers</span>
                      <span className="pdp-summary-plus" />
                    </summary>
                    <div className="pdp-accordion-content pdp-faq-list">
                      {product.faqs.map((faq, index) => (
                        <article key={faq.id || index}>
                          <h3>{faq.question}</h3>
                          <p>{faq.answer}</p>
                        </article>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </section>

            {relatedProducts.length > 0 && (
              <section className="pdp-related">
                <div className="pdp-section-heading">
                  <span className="pdp-eyebrow">Complete the room</span>
                  <h2>You may also like</h2>
                  <p>More pieces from the {product.sub_category?.name || 'same collection'}.</p>
                </div>
                <div className="pdp-related-track">
                  {relatedProducts.map((relatedProduct) => (
                    <div className="pdp-related-item" key={relatedProduct.id}>
                      <StoreProductCard product={relatedProduct} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>

      {imageViewerOpen && product && (
        <div
          className="pdp-image-viewer"
          ref={imageViewerRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} image viewer`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeImageViewer();
          }}
        >
          <div className="pdp-image-viewer-header">
            <div>
              <strong>{product.name}</strong>
              <span>{activeIndex + 1} of {images.length}</span>
            </div>
            <div className="pdp-image-viewer-controls">
              <button
                type="button"
                onClick={() => setImageZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
                disabled={imageZoom <= 1}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="M7.5 10.5h6M15.5 15.5 21 21" />
                </svg>
              </button>
              <span className="pdp-image-zoom-level">{Math.round(imageZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setImageZoom((current) => Math.min(4, Number((current + 0.25).toFixed(2))))}
                disabled={imageZoom >= 4}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="M7.5 10.5h6M10.5 7.5v6M15.5 15.5 21 21" />
                </svg>
              </button>
              <button type="button" onClick={() => setImageZoom(1)} aria-label="Reset zoom" title="Reset zoom">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4v6h6M20 20v-6h-6M5.5 15a7.5 7.5 0 0 0 12.4 2.8L20 14M4 10l2.1-3.8A7.5 7.5 0 0 1 18.5 9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={toggleImageViewerFullscreen}
                aria-label={imageViewerFullscreen ? 'Exit full screen' : 'View full screen'}
                title={imageViewerFullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {imageViewerFullscreen ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
                  </svg>
                )}
              </button>
              <button type="button" onClick={closeImageViewer} aria-label="Close image viewer" title="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>
              </button>
            </div>
          </div>

          <div
            className={`pdp-image-viewer-canvas ${imageZoom > 1 ? 'is-zoomed' : ''}`}
            onDoubleClick={() => setImageZoom((current) => current > 1 ? 1 : 2)}
          >
            <img
              src={images[activeIndex]?.url || FALLBACK_IMAGE}
              alt={images[activeIndex]?.alt || product.name}
              onError={productImageError}
              style={{ transform: `scale(${imageZoom})` }}
            />
          </div>

          {images.length > 1 && (
            <>
              <button type="button" className="pdp-viewer-arrow is-previous" onClick={showPrev} aria-label="Previous image">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button type="button" className="pdp-viewer-arrow is-next" onClick={showNext} aria-label="Next image">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </>
          )}

          <div className="pdp-image-viewer-thumbnails" aria-label="Viewer thumbnails">
            {images.map((image, index) => (
              <button
                type="button"
                key={`viewer-${image.url}-${index}`}
                className={activeIndex === index ? 'is-active' : ''}
                onClick={() => {
                  setActiveIndex(index);
                  setImageZoom(1);
                }}
                aria-label={`View image ${index + 1}`}
                aria-pressed={activeIndex === index}
              >
                <img src={image.url} alt="" onError={productImageError} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
