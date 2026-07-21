import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  API_BASE_URL,
  fetchPublicBanners,
  fetchPublicBrands,
  fetchPublicCategories,
  fetchPublicEvents,
  fetchPublicProducts,
  fetchPublicSubCategories,
} from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { isProductInStock } from '../utils/productStock';

const rooms = [
  {
    title: 'Living Room',
    description: 'Layered seating, warm woods, and statement textiles for a softer premium look.',
    tone: 'Designed for everyday calm with bold details.',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
  },
  {
    title: 'Dining Room',
    description: 'Flexible tables and sculptural chairs that work for both family time and hosting.',
    tone: 'Balanced finishes with a refined, modern edge.',
    image:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
  },
  {
    title: 'Bedroom',
    description: 'Storage-forward compositions with cozy textures and quieter tones.',
    tone: 'Made for restful spaces that still feel elevated.',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
  },
];

const fallbackBanners = [
  {
    id: 'fallback-1',
    title: 'Made for homes that want clean lines and a stronger identity.',
    subtitle: 'Discover living, dining, bedroom, and storage pieces curated for a premium modern lifestyle.',
    button_text: 'Shop new arrivals',
    button_link: '#products',
    button_pos_x: 22,
    button_pos_y: 78,
    button_style: 'solid',
    button_radius: 999,
    button_bg_color: '#e2211c',
    button_text_color: '#ffffff',
    button_width: 170,
    button_height: 48,
    button_text_size: 14,
    image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=2200&q=80',
  },
  {
    id: 'fallback-2',
    title: 'Storage, seating, and surfaces that feel calmer and more refined.',
    subtitle: 'Premium everyday furniture with a storefront designed to feel modern, easy, and editorial.',
    button_text: 'Browse categories',
    button_link: '#featured-categories',
    button_pos_x: 24,
    button_pos_y: 78,
    button_style: 'outline',
    button_radius: 999,
    button_bg_color: '#ffffff',
    button_text_color: '#ffffff',
    button_width: 190,
    button_height: 48,
    button_text_size: 14,
    image_url: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=2200&q=80',
  },
  {
    id: 'fallback-3',
    title: 'Curated corners for living, dining, rest, and work.',
    subtitle: 'A more premium ecommerce experience with live categories, event offers, and branded hero banners.',
    button_text: 'See room ideas',
    button_link: '#rooms',
    button_pos_x: 22,
    button_pos_y: 78,
    button_style: 'ghost',
    button_radius: 999,
    button_bg_color: '#ffffff',
    button_text_color: '#ffffff',
    button_width: 170,
    button_height: 48,
    button_text_size: 14,
    image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=80',
  },
];

const fallbackLogoUrl = '/messaraliving-logo.png';
const homeProductPageSize = 8;
const homeProductLimit = 100;
const minimumProductLoadingTime = 650;
const homeProductSortOptions = [
  { value: 'popular', label: 'Popular' },
  { value: 'discount', label: 'Discount' },
  { value: 'newest', label: 'Latest' },
  { value: 'price_asc', label: 'Price: Low to High' },
];

function applyMainLogoFallback(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.classList.add('is-fallback-logo');
  image.src = fallbackLogoUrl;
}

function resolveAssetUrl(apiBaseUrl, imageUrl, imagePath) {
  if (imageUrl) {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    if (imageUrl.startsWith('/')) {
      return `${apiBaseUrl}${imageUrl}`;
    }

    return `${apiBaseUrl}/${imageUrl.replace(/^\/+/, '')}`;
  }

  if (imagePath) {
    return `${apiBaseUrl}/storage/${String(imagePath).replace(/^\/+/, '')}`;
  }

  return '';
}

function formatCurrency(value) {
  return `AED ${Number(value || 0).toFixed(2)}`;
}

function formatEventBadge(eventItem) {
  const value = Number(eventItem?.discount_value || 0);
  if (!value) return 'Featured drop';
  return eventItem?.discount_type === 'percent' ? `${value}% off` : `AED ${value.toFixed(0)} off`;
}

function isRouteLink(link) {
  return typeof link === 'string' && /^\/(?!\/)/.test(link);
}

function isExternalLink(link) {
  return typeof link === 'string' && /^https?:\/\//i.test(link);
}

function getBannerButtonStyle(banner) {
  const style = banner?.button_style || 'solid';
  const backgroundColor = banner?.button_bg_color || '#e2211c';
  const textColor = banner?.button_text_color || '#ffffff';

  return {
    '--banner-button-text-color': textColor,
    width: `${Math.max(Number(banner?.button_width || 160), 100)}px`,
    height: `${Math.max(Number(banner?.button_height || 44), 38)}px`,
    borderRadius: `${Math.max(Number(banner?.button_radius ?? 24), 0)}px`,
    fontSize: `${Math.max(Number(banner?.button_text_size ?? 14), 12)}px`,
    background:
      style === 'solid'
        ? backgroundColor
        : style === 'ghost'
          ? 'rgba(255, 255, 255, 0.12)'
          : 'transparent',
    color: textColor,
    borderColor: style === 'ghost' ? 'rgba(255, 255, 255, 0.3)' : backgroundColor,
    boxShadow: style === 'solid' ? '0 18px 38px rgba(17, 17, 17, 0.22)' : 'none',
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [categories, setCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [banners, setBanners] = useState([]);
  const [brands, setBrands] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productPagination, setProductPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [productSort, setProductSort] = useState('newest');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState('');
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const categoryTrackRef = useRef(null);
  const brandTrackRef = useRef(null);
  const brandSliderPausedRef = useRef(false);
  const subCategoryTrackRef = useRef(null);
  const subCategorySliderPausedRef = useRef(false);
  const eventTrackRefs = useRef({});
  const productLoadMoreRef = useRef(null);
  const apiBaseUrl = API_BASE_URL;
  const [authModal, setAuthModal] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [submittingRegister, setSubmittingRegister] = useState(false);
  const dashboardPath = '/dashboard/overview';

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [categoriesData, eventsData, bannersData, brandsData, subCategoriesData, productsData] = await Promise.all([
          fetchPublicCategories(),
          fetchPublicEvents(),
          fetchPublicBanners(),
          fetchPublicBrands(),
          fetchPublicSubCategories(),
          fetchPublicProducts(1, homeProductPageSize, { sort: 'newest', offset: 0 }),
        ]);

        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        setBanners(Array.isArray(bannersData) ? bannersData : []);
        setBrands(Array.isArray(brandsData) ? brandsData : []);
        setSubCategories(Array.isArray(subCategoriesData) ? subCategoriesData : []);
        setProducts(Array.isArray(productsData?.data) ? productsData.data : []);
        setProductPagination({
          currentPage: Number(productsData?.current_page || 1),
          lastPage: Number(productsData?.last_page || 1),
          total: Number(productsData?.total || 0),
        });
      } catch {
        setCategories([]);
        setEvents([]);
        setBanners([]);
        setBrands([]);
        setSubCategories([]);
        setProducts([]);
        setProductLoadError('Unable to load products. Please try again.');
      } finally {
        setLoadingProducts(false);
      }
    }

    loadHomeData();
  }, []);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
  }, [categories]);

  const showcaseEvents = useMemo(() => {
    return events.filter((eventItem) => Array.isArray(eventItem?.products) && eventItem.products.length > 0);
  }, [events]);

  const displayBrands = useMemo(() => {
    return [...brands]
      .filter((brand) => brand?.is_active ?? true)
      .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
  }, [brands]);

  const displaySubCategories = useMemo(() => {
    return [...subCategories]
      .filter((subCategory) => (subCategory?.is_active ?? true) && subCategory?.category?.slug)
      .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
  }, [subCategories]);

  const displayBanners = useMemo(() => {
    const liveBanners = [...banners]
      .filter((banner) => banner?.is_active ?? true)
      .sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));

    return liveBanners.length > 0 ? liveBanners : fallbackBanners;
  }, [banners]);

  useEffect(() => {
    if (!displayBanners.length) {
      return;
    }

    if (activeBannerIndex >= displayBanners.length) {
      setActiveBannerIndex(0);
    }
  }, [activeBannerIndex, displayBanners.length]);

  useEffect(() => {
    if (displayBanners.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % displayBanners.length);
    }, 5500);

    return () => window.clearInterval(intervalId);
  }, [displayBanners.length]);

  useEffect(() => {
    if (displayBrands.length < 2) return undefined;

    const intervalId = window.setInterval(() => {
      if (!brandSliderPausedRef.current) scrollBrands(1);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, [displayBrands.length]);

  useEffect(() => {
    if (displaySubCategories.length < 2) return undefined;

    const intervalId = window.setInterval(() => {
      if (!subCategorySliderPausedRef.current) scrollSubCategories(1);
    }, 3800);

    return () => window.clearInterval(intervalId);
  }, [displaySubCategories.length]);

  const activeBanner = displayBanners[activeBannerIndex] ?? displayBanners[0] ?? null;
  const activeBannerImage = activeBanner
    ? resolveAssetUrl(apiBaseUrl, activeBanner.image_url, activeBanner.image_path)
    : '';
  const activeBannerButtonStyle = activeBanner ? getBannerButtonStyle(activeBanner) : {};
  const activeBannerButtonPosition = {
    left: `${Number(activeBanner?.button_pos_x ?? 22)}%`,
    top: `${Number(activeBanner?.button_pos_y ?? 78)}%`,
  };
  const bannerLink = activeBanner?.button_link?.trim() || '#products';
  const hasMoreProducts =
    products.length < Math.min(productPagination.total, homeProductLimit);

  useEffect(() => {
    const sentinel = productLoadMoreRef.current;
    if (!sentinel || !hasMoreProducts || loadingProducts || loadingMoreProducts || productLoadError) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreProducts();
      },
      { rootMargin: '0px', threshold: 0.2 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreProducts, loadingProducts, loadingMoreProducts, productLoadError, productPagination.currentPage, products.length]);

  function scrollEventProducts(eventId, direction) {
    const ref = eventTrackRefs.current[eventId];
    if (!ref) return;
    ref.scrollBy({ left: direction * 340, behavior: 'smooth' });
  }

  function scrollCategories(direction) {
    if (!categoryTrackRef.current) return;
    categoryTrackRef.current.scrollBy({ left: direction * 280, behavior: 'smooth' });
  }

  function scrollBrands(direction) {
    const track = brandTrackRef.current;
    const firstCard = track?.querySelector('.home-brand-logo-card');
    if (!track || !firstCard) return;

    const trackStyle = window.getComputedStyle(track);
    const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || '0');
    const step = firstCard.getBoundingClientRect().width + gap;
    const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0);
    if (maxScroll < 2) return;

    if (direction > 0 && track.scrollLeft >= maxScroll - step / 2) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    if (direction < 0 && track.scrollLeft <= step / 2) {
      track.scrollTo({ left: maxScroll, behavior: 'smooth' });
      return;
    }

    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  function scrollSubCategories(direction) {
    const track = subCategoryTrackRef.current;
    const firstCard = track?.querySelector('.home-subcategory-card');
    if (!track || !firstCard) return;

    const trackStyle = window.getComputedStyle(track);
    const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || '0');
    const step = firstCard.getBoundingClientRect().width + gap;
    const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0);
    if (maxScroll < 2) return;

    if (direction > 0 && track.scrollLeft >= maxScroll - step / 2) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    if (direction < 0 && track.scrollLeft <= step / 2) {
      track.scrollTo({ left: maxScroll, behavior: 'smooth' });
      return;
    }

    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  function showPreviousBanner() {
    setActiveBannerIndex((current) => (current - 1 + displayBanners.length) % displayBanners.length);
  }

  function showNextBanner() {
    setActiveBannerIndex((current) => (current + 1) % displayBanners.length);
  }

  async function loadMoreProducts() {
    if (loadingProducts || loadingMoreProducts || !hasMoreProducts || products.length >= homeProductLimit) return;

    setLoadingMoreProducts(true);
    setProductLoadError('');

    try {
      const [productsData] = await Promise.all([
        fetchPublicProducts(1, homeProductPageSize, { sort: productSort, offset: products.length }),
        new Promise((resolve) => window.setTimeout(resolve, minimumProductLoadingTime)),
      ]);
      const nextProducts = Array.isArray(productsData?.data) ? productsData.data : [];

      setProducts((currentProducts) => {
        const existingIds = new Set(currentProducts.map((product) => product.id));
        return [...currentProducts, ...nextProducts.filter((product) => !existingIds.has(product.id))].slice(
          0,
          homeProductLimit
        );
      });
      setProductPagination({
        currentPage: Number(productsData?.current_page || 1),
        lastPage: Number(productsData?.last_page || 1),
        total: Number(productsData?.total || products.length + nextProducts.length),
      });
    } catch (requestError) {
      setProductLoadError(requestError.response?.data?.message || 'Unable to load more products.');
    } finally {
      setLoadingMoreProducts(false);
    }
  }

  async function changeProductSort(nextSort) {
    if (nextSort === productSort || loadingProducts || loadingMoreProducts) return;

    setProductSort(nextSort);
    setLoadingProducts(true);
    setProductLoadError('');

    try {
      const productsData = await fetchPublicProducts(1, homeProductPageSize, { sort: nextSort, offset: 0 });
      const nextProducts = Array.isArray(productsData?.data) ? productsData.data : [];

      setProducts(nextProducts.slice(0, homeProductLimit));
      setProductPagination({
        currentPage: Number(productsData?.current_page || 1),
        lastPage: Number(productsData?.last_page || 1),
        total: Number(productsData?.total || nextProducts.length),
      });
    } catch (requestError) {
      setProducts([]);
      setProductPagination({ currentPage: 1, lastPage: 1, total: 0 });
      setProductLoadError(requestError.response?.data?.message || 'Unable to load products. Please try again.');
    } finally {
      setLoadingProducts(false);
    }
  }

  function openLogin() {
    setLoginError('');
    setAuthModal('login');
  }

  function openRegister() {
    setRegisterError('');
    setAuthModal('register');
  }

  function closeAuthModal() {
    setAuthModal(null);
  }

  function updateLoginField(event) {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateRegisterField(event) {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginError('');
    setSubmittingLogin(true);

    try {
      await login(loginForm);
      closeAuthModal();
      navigate(dashboardPath);
    } catch (requestError) {
      setLoginError(requestError.response?.data?.message || 'Login failed.');
    } finally {
      setSubmittingLogin(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setRegisterError('');
    setSubmittingRegister(true);

    try {
      await register(registerForm);
      closeAuthModal();
      navigate(dashboardPath);
    } catch (requestError) {
      setRegisterError(requestError.response?.data?.message || 'Unable to register.');
    } finally {
      setSubmittingRegister(false);
    }
  }

  return (
    <div className="home-page premium-home">
      <StorefrontHeader onLogin={openLogin} onRegister={openRegister} />

      {sortedCategories.length > 0 && (
        <div className="category-nav">
          <div className="category-nav-inner">
            <span className="category-nav-title">Shop by Category</span>
            <button
              type="button"
              className="category-nav-btn"
              onClick={() => scrollCategories(-1)}
              aria-label="Scroll categories left"
            >
              ‹
            </button>
            <div className="category-track" ref={categoryTrackRef}>
              {sortedCategories.map((category) => {
                const imageUrl = resolveAssetUrl(apiBaseUrl, category.image_url, category.image_path);

                return (
                  <Link
                    key={category.id}
                    to={`/categories/${category.slug}`}
                    className="category-chip"
                    aria-label={`Open ${category.name}`}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={category.image_alt_text || category.name} />
                    ) : (
                      <div className="category-chip-placeholder" />
                    )}
                    <span>{category.name}</span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              className="category-nav-btn"
              onClick={() => scrollCategories(1)}
              aria-label="Scroll categories right"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <section className="hero premium-hero">
        <div className="banner-slider-shell">
          <div className="banner-slider-stage">
            {activeBannerImage ? (
              <img className="banner-slide-media" src={activeBannerImage} alt={activeBanner?.image_alt_text || activeBanner?.title || 'Banner'} />
            ) : (
              <div className="banner-slide-placeholder" />
            )}
            <div className="banner-slide-overlay" />

            <div className="banner-slide-copy">
              <span className="banner-kicker">MessaraLiving Selection</span>
              <h1>{activeBanner?.title || 'Curated furniture for refined daily living.'}</h1>
              <p>
                {activeBanner?.subtitle ||
                  'Explore modern furniture, premium textures, and cleaner room styling with an ecommerce homepage built to feel more polished.'}
              </p>
              <div className="banner-slide-meta">
                <span>Premium furniture</span>
                <span>Live categories</span>
                <span>Event offers</span>
              </div>
            </div>

            {activeBanner?.button_text &&
              (isRouteLink(bannerLink) ? (
                <Link
                  to={bannerLink}
                  className={`banner-slide-button is-${activeBanner.button_style || 'solid'}`}
                  style={{ ...activeBannerButtonStyle, ...activeBannerButtonPosition }}
                >
                  {activeBanner.button_text}
                </Link>
              ) : (
                <a
                  href={bannerLink}
                  className={`banner-slide-button is-${activeBanner.button_style || 'solid'}`}
                  style={{ ...activeBannerButtonStyle, ...activeBannerButtonPosition }}
                  target={isExternalLink(bannerLink) ? '_blank' : undefined}
                  rel={isExternalLink(bannerLink) ? 'noreferrer' : undefined}
                >
                  {activeBanner.button_text}
                </a>
              ))}
          </div>

          <div className="banner-slider-controls">
            <div className="banner-dots">
              {displayBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  className={`banner-dot ${index === activeBannerIndex ? 'active' : ''}`}
                  onClick={() => setActiveBannerIndex(index)}
                  aria-label={`Show banner ${index + 1}: ${banner.title}`}
                />
              ))}
            </div>

            {displayBanners.length > 1 && (
              <div className="banner-arrows">
                <button type="button" className="banner-arrow" onClick={showPreviousBanner} aria-label="Previous banner">
                  ‹
                </button>
                <button type="button" className="banner-arrow" onClick={showNextBanner} aria-label="Next banner">
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

      </section>

      {displayBrands.length > 0 && (
        <section
          className="home-brand-showcase"
          aria-labelledby="home-brand-showcase-title"
          onMouseEnter={() => { brandSliderPausedRef.current = true; }}
          onMouseLeave={() => { brandSliderPausedRef.current = false; }}
          onFocusCapture={() => { brandSliderPausedRef.current = true; }}
          onBlurCapture={() => { brandSliderPausedRef.current = false; }}
        >
          <div className="home-brand-showcase-head">
            <div>
              <span>Shop by brand</span>
              <h2 id="home-brand-showcase-title">Design names, all in one place.</h2>
            </div>
            {displayBrands.length > 1 && (
              <div className="home-brand-showcase-controls">
                <button type="button" onClick={() => scrollBrands(-1)} aria-label="Previous brands">‹</button>
                <button type="button" onClick={() => scrollBrands(1)} aria-label="Next brands">›</button>
              </div>
            )}
          </div>

          <div className="home-brand-logo-track" ref={brandTrackRef}>
            {displayBrands.map((brand) => {
              const logoUrl = resolveAssetUrl(apiBaseUrl, brand.image_url, brand.image_path);

              return (
                <Link
                  key={brand.id}
                  to={`/search?brand_id=${encodeURIComponent(brand.id)}`}
                  className="home-brand-logo-card"
                  aria-label={`Shop ${brand.name} products`}
                  title={brand.name}
                >
                  <img
                    src={logoUrl || fallbackLogoUrl}
                    className={logoUrl ? undefined : 'is-fallback-logo'}
                    alt={brand.name}
                    loading="lazy"
                    onError={applyMainLogoFallback}
                  />
                  <span className="home-brand-logo-name">{brand.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {displaySubCategories.length > 0 && (
        <section
          className="home-subcategory-showcase"
          aria-labelledby="home-subcategory-showcase-title"
          onMouseEnter={() => { subCategorySliderPausedRef.current = true; }}
          onMouseLeave={() => { subCategorySliderPausedRef.current = false; }}
          onFocusCapture={() => { subCategorySliderPausedRef.current = true; }}
          onBlurCapture={() => { subCategorySliderPausedRef.current = false; }}
        >
          <div className="home-subcategory-showcase-head">
            <div>
              <span>Explore every collection</span>
              <h2 id="home-subcategory-showcase-title">Shop by subcategory.</h2>
            </div>
            {displaySubCategories.length > 1 && (
              <div className="home-subcategory-showcase-controls">
                <button type="button" onClick={() => scrollSubCategories(-1)} aria-label="Previous subcategories">‹</button>
                <button type="button" onClick={() => scrollSubCategories(1)} aria-label="Next subcategories">›</button>
              </div>
            )}
          </div>

          <div className="home-subcategory-track" ref={subCategoryTrackRef}>
            {displaySubCategories.map((subCategory) => {
              const imageUrl = resolveAssetUrl(
                apiBaseUrl,
                subCategory.image_url,
                subCategory.image_path
              );

              return (
                <Link
                  key={subCategory.id}
                  to={`/categories/${subCategory.category.slug}/sub-categories/${subCategory.slug}`}
                  className="home-subcategory-card"
                >
                  <div className="home-subcategory-media">
                    <img
                      src={imageUrl || fallbackLogoUrl}
                      className={imageUrl ? undefined : 'is-fallback-logo'}
                      alt={imageUrl ? subCategory.name : ''}
                      loading="lazy"
                      onError={applyMainLogoFallback}
                    />
                  </div>
                  <div className="home-subcategory-copy">
                    <span>{subCategory.category.name}</span>
                    <h3>{subCategory.name}</h3>
                    <small>{Number(subCategory.active_products_count || 0)} products</small>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {showcaseEvents.length > 0 && (
        <section className="event-showcase" id="events">
          {showcaseEvents.map((eventItem) => (
            <div key={eventItem.id} className="event-block">
              <div className="event-header">
                <div>
                  <span className="section-kicker">Event picks</span>
                  <h2>{eventItem.name}</h2>
                  <p className="event-subtitle">{formatEventBadge(eventItem)}</p>
                </div>
                <div className="event-controls">
                  <button type="button" onClick={() => scrollEventProducts(eventItem.id, -1)} aria-label="Scroll left">
                    ‹
                  </button>
                  <button type="button" onClick={() => scrollEventProducts(eventItem.id, 1)} aria-label="Scroll right">
                    ›
                  </button>
                </div>
              </div>
              <div
                className="event-track"
                ref={(node) => {
                  if (node) {
                    eventTrackRefs.current[eventItem.id] = node;
                  }
                }}
              >
                {(eventItem.products || []).map((product) => {
                  const productImage = resolveAssetUrl(apiBaseUrl, product.image_url, product.image_path);

                  return (
                    <article key={product.id} className="event-card">
                      <div className="event-image">
                        {productImage ? (
                          <img src={productImage} alt={product.name} />
                        ) : (
                          <div className="event-image-placeholder" />
                        )}
                      </div>
                      <div className="event-card-body">
                        <h3>{product.name}</h3>
                        {Number(product.discount_price || 0) > 0 ? (
                          <div className="event-product-price">
                            <span className="price-old">{formatCurrency(product.price)}</span>
                            <span className="price-discount">{formatCurrency(product.discount_price)}</span>
                          </div>
                        ) : (
                          <div className="event-product-price">{formatCurrency(product.price)}</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <section id="products" className="section home-products-section">
        <div className="section-head">
          <div>
            <span className="section-kicker">New arrivals</span>
            <h2>Fresh pieces for every room.</h2>
          </div>
          <p>
            Discover up to 100 catalog products in smooth batches of 8.
          </p>
        </div>

        <div className="home-product-filters" role="group" aria-label="Sort products">
          {homeProductSortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={productSort === option.value ? 'is-active' : ''}
              disabled={loadingProducts || loadingMoreProducts}
              aria-pressed={productSort === option.value}
              onClick={() => changeProductSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loadingProducts ? (
          <div className="home-product-grid" aria-label="Loading products" aria-busy="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="home-product-card home-product-skeleton" aria-hidden="true">
                <div className="home-product-media" />
                <div className="home-product-copy">
                  <span />
                  <strong />
                  <span />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="home-product-grid">
            {products.map((product) => {
              const imageUrl = resolveAssetUrl(apiBaseUrl, product.image_url, product.image_path);
              const productPath = `/categories/${product.category?.slug}/sub-categories/${product.sub_category?.slug}/products/${product.slug}`;
              const hasDiscount = Number(product.discount_price || 0) > 0;
              const inStock = isProductInStock(product);

              return (
                <Link key={product.id} to={productPath} className="home-product-card">
                  <div className="home-product-media">
                    {hasDiscount && <span className="home-product-badge">Sale</span>}
                    {imageUrl ? <img src={imageUrl} alt={product.name} /> : <div className="home-product-placeholder">M</div>}
                  </div>
                  <div className="home-product-copy">
                    <span className="home-product-category">{product.category?.name || 'Furniture'}</span>
                    <h3>{product.name}</h3>
                    <div className="home-product-price">
                      {hasDiscount && <span className="price-old">{formatCurrency(product.price)}</span>}
                      <strong className={hasDiscount ? 'price-discount' : ''}>
                        {formatCurrency(hasDiscount ? product.discount_price : product.price)}
                      </strong>
                    </div>
                    <div className="home-product-card-footer">
                      <span>{inStock ? 'In stock' : 'Out of stock'}</span>
                      <strong>View product</strong>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="home-product-empty">
            <strong>No products found</strong>
            <span>Try a different product filter.</span>
          </div>
        )}

        {!loadingProducts && (
          <div className="home-product-infinite" ref={productLoadMoreRef} aria-live="polite">
            {productLoadError && <p className="home-product-error">{productLoadError}</p>}
            {hasMoreProducts && !productLoadError ? (
              <div className={`home-infinite-status ${loadingMoreProducts ? 'is-loading' : ''}`}>
                {loadingMoreProducts && <span className="home-infinite-spinner" aria-hidden="true" />}
                <span>{loadingMoreProducts ? 'Loading 8 more products...' : 'Keep scrolling to discover more'}</span>
              </div>
            ) : !productLoadError && products.length > 0 ? (
              <span className="home-product-count">
                {Number(productPagination.total || 0) > homeProductLimit
                  ? `Showing the first ${homeProductLimit} products`
                  : `Showing all ${products.length} products`}
              </span>
            ) : null}
          </div>
        )}
      </section>

      <section id="rooms" className="section rooms">
        <div className="section-head">
          <div>
            <span className="section-kicker">Room ideas</span>
            <h2>Design each space with a clearer story.</h2>
          </div>
          <p>From living to bedroom zones, give shoppers inspiration before they move deeper into categories and products.</p>
        </div>
        <div className="room-grid">
          {rooms.map((room) => (
            <article key={room.title} className="room-card">
              <div className="room-image" style={{ backgroundImage: `url(${room.image})` }} />
              <div className="room-body">
                <h3>{room.title}</h3>
                <p>{room.description}</p>
                <span>{room.tone}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="promo" className="promo">
        <div>
          <span className="section-kicker on-dark">MessaraLiving Living</span>
          <h2>Discover products made for modern everyday living.</h2>
          <p>Browse the latest catalog pieces, live event prices, and room inspiration in one premium storefront.</p>
        </div>
        <a href="#products" className="primary-btn promo-btn">
          Browse products
        </a>
      </section>

      <footer className="home-footer">
        <div>
          <strong>MessaraLiving</strong>
          <p>Premium furniture, cleaner browsing, and a stronger modern ecommerce presentation.</p>
        </div>
        <div>
          <span>Support</span>
          <span>Shipping</span>
          <span>Returns</span>
        </div>
        <div>
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </footer>

      {authModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal">
            <button type="button" className="auth-modal-close" onClick={closeAuthModal} aria-label="Close">
              ×
            </button>
            {authModal === 'login' ? (
              <div className="auth-modal-card">
                <h1>Login</h1>
                <form onSubmit={handleLoginSubmit} className="d-grid gap-3">
                  <label>
                    Email
                    <input
                      className="form-control"
                      name="email"
                      type="email"
                      value={loginForm.email}
                      onChange={updateLoginField}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      className="form-control"
                      name="password"
                      type="password"
                      value={loginForm.password}
                      onChange={updateLoginField}
                      required
                    />
                  </label>
                  {loginError && <p className="error-text mb-0">{loginError}</p>}
                  <button className="btn btn-dark" type="submit" disabled={submittingLogin}>
                    {submittingLogin ? 'Checking...' : 'Login'}
                  </button>
                </form>
                <p className="mt-3 mb-0">
                  New user?{' '}
                  <button type="button" className="link-button" onClick={openRegister}>
                    Register
                  </button>
                </p>
                <p className="mb-0">
                  Forgot password? <Link to="/forgot-password">Reset here</Link>
                </p>
              </div>
            ) : (
              <div className="auth-modal-card">
                <h1>Create account</h1>
                <form onSubmit={handleRegisterSubmit} className="d-grid gap-3">
                  <label>
                    Name
                    <input
                      className="form-control"
                      name="name"
                      type="text"
                      value={registerForm.name}
                      onChange={updateRegisterField}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      className="form-control"
                      name="email"
                      type="email"
                      value={registerForm.email}
                      onChange={updateRegisterField}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      className="form-control"
                      name="password"
                      type="password"
                      value={registerForm.password}
                      onChange={updateRegisterField}
                      required
                    />
                  </label>
                  <label>
                    Confirm password
                    <input
                      className="form-control"
                      name="password_confirmation"
                      type="password"
                      value={registerForm.password_confirmation}
                      onChange={updateRegisterField}
                      required
                    />
                  </label>
                  {registerError && <p className="error-text mb-0">{registerError}</p>}
                  <button className="btn btn-dark" type="submit" disabled={submittingRegister}>
                    {submittingRegister ? 'Creating...' : 'Register'}
                  </button>
                </form>
                <p className="mt-3 mb-0">
                  Already have an account?{' '}
                  <button type="button" className="link-button" onClick={openLogin}>
                    Login
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
