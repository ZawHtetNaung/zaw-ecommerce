import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchPublicCategories, fetchPublicSubCategories } from '../api/client';

let categoryMenuCache = null;
let categoryMenuRequest = null;

function loadCategoryMenuData() {
  if (categoryMenuCache) return Promise.resolve(categoryMenuCache);
  if (categoryMenuRequest) return categoryMenuRequest;

  categoryMenuRequest = Promise.all([
    fetchPublicCategories(),
    fetchPublicSubCategories(),
  ]).then(([categoryData, subCategoryData]) => {
    categoryMenuCache = {
      categories: Array.isArray(categoryData) ? categoryData : [],
      subCategories: Array.isArray(subCategoryData) ? subCategoryData : [],
    };
    return categoryMenuCache;
  }).finally(() => {
    categoryMenuRequest = null;
  });

  return categoryMenuRequest;
}

function categoryPath(category) {
  return `/categories/${category.slug}`;
}

function subCategoryPath(subCategory) {
  return `/categories/${subCategory.category.slug}/sub-categories/${subCategory.slug}`;
}

export default function CategoryMenu() {
  const location = useLocation();
  const menuRef = useRef(null);
  const [categories, setCategories] = useState(() => categoryMenuCache?.categories || []);
  const [subCategories, setSubCategories] = useState(() => categoryMenuCache?.subCategories || []);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategoryId, setMobileCategoryId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    loadCategoryMenuData().then((menuData) => {
      if (cancelled) return;
      setCategories(menuData.categories);
      setSubCategories(menuData.subCategories);
    }).catch(() => {
      if (cancelled) return;
      setCategories([]);
      setSubCategories([]);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOpenCategoryId(null);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenCategoryId(null);
        setMobileOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      setOpenCategoryId(null);
      setMobileOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const subCategoriesByCategory = useMemo(() => {
    const grouped = new Map();
    subCategories.forEach((subCategory) => {
      const categoryId = Number(subCategory?.category?.id || subCategory?.category_id);
      if (!categoryId) return;
      if (!grouped.has(categoryId)) grouped.set(categoryId, []);
      grouped.get(categoryId).push(subCategory);
    });
    return grouped;
  }, [subCategories]);

  const activeCategorySlug = useMemo(() => {
    const match = location.pathname.match(/^\/categories\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, [location.pathname]);

  const openCategory = categories.find((category) => Number(category.id) === Number(openCategoryId));
  const openSubCategories = openCategory
    ? subCategoriesByCategory.get(Number(openCategory.id)) || []
    : [];

  if (categories.length === 0) return null;

  return (
    <nav className="global-category-menu" aria-label="Product categories" ref={menuRef}>
      <div
        className="global-category-menu-inner"
        onMouseLeave={() => setOpenCategoryId(null)}
      >
        <div className="global-category-menu-desktop">
          <Link className="global-category-shop-link" to="/search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span>Shop</span>
          </Link>

          <ul className="global-category-list">
            {categories.map((category) => {
              const categorySubCategories = subCategoriesByCategory.get(Number(category.id)) || [];
              const active = category.slug === activeCategorySlug;
              const expanded = Number(openCategoryId) === Number(category.id);

              return (
                <li
                  key={category.id}
                  className={`${active ? 'is-active' : ''} ${expanded ? 'is-expanded' : ''}`}
                  onMouseEnter={() => setOpenCategoryId(category.id)}
                >
                  <Link
                    to={categoryPath(category)}
                    onFocus={() => setOpenCategoryId(category.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {category.name}
                  </Link>
                  {categorySubCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpenCategoryId(expanded ? null : category.id)}
                      aria-label={`${expanded ? 'Close' : 'Open'} ${category.name} menu`}
                      aria-expanded={expanded}
                      aria-controls="global-category-mega-panel"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {openCategory && openSubCategories.length > 0 && (
          <section
            className="global-category-mega-panel"
            id="global-category-mega-panel"
            aria-label={`${openCategory.name} subcategories`}
            onMouseEnter={() => setOpenCategoryId(openCategory.id)}
          >
            <Link to={categoryPath(openCategory)} className="global-category-mega-feature">
              <div>
                <span>Explore category</span>
                <h2>{openCategory.name}</h2>
                <strong>View all products <span aria-hidden="true">→</span></strong>
              </div>
              {openCategory.image_url && (
                <img
                  src={openCategory.image_url}
                  alt={openCategory.image_alt_text || ''}
                />
              )}
            </Link>

            <div className="global-category-mega-links">
              <div className="global-category-mega-heading">
                <span>Shop {openCategory.name}</span>
                <small>{openSubCategories.length} collections</small>
              </div>
              <div className="global-category-mega-grid">
                {openSubCategories.map((subCategory) => (
                  <Link to={subCategoryPath(subCategory)} key={subCategory.id}>
                    <span>{subCategory.name}</span>
                    {Number(subCategory.active_products_count || 0) > 0 && (
                      <small>{subCategory.active_products_count}</small>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="global-category-menu-mobile">
          <button
            type="button"
            className="global-category-mobile-toggle"
            onClick={() => setMobileOpen((current) => !current)}
            aria-expanded={mobileOpen}
            aria-controls="global-category-mobile-panel"
          >
            <span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              Shop categories
            </span>
            <svg className={mobileOpen ? 'is-open' : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
          </button>

          {mobileOpen && (
            <div className="global-category-mobile-panel" id="global-category-mobile-panel">
              <Link className="global-category-mobile-all" to="/search">Browse all products <span>→</span></Link>
              {categories.map((category) => {
                const categorySubCategories = subCategoriesByCategory.get(Number(category.id)) || [];
                const expanded = Number(mobileCategoryId) === Number(category.id);
                const active = category.slug === activeCategorySlug;

                return (
                  <div className={`global-category-mobile-group ${active ? 'is-active' : ''}`} key={category.id}>
                    <div>
                      <Link to={categoryPath(category)} aria-current={active ? 'page' : undefined}>
                        {category.name}
                      </Link>
                      {categorySubCategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMobileCategoryId(expanded ? null : category.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.name}`}
                        >
                          <svg className={expanded ? 'is-open' : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="global-category-mobile-subcategories">
                        {categorySubCategories.map((subCategory) => (
                          <Link to={subCategoryPath(subCategory)} key={subCategory.id}>
                            {subCategory.name}
                          </Link>
                        ))}
                        <Link className="view-all" to={categoryPath(category)}>View all {category.name}</Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
