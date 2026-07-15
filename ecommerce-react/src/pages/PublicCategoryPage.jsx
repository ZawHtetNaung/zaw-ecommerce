import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPublicCategory } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';

export default function PublicCategoryPage() {
  const { categorySlug } = useParams();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCategory() {
      setLoading(true);
      setError('');

      try {
        const data = await fetchPublicCategory(categorySlug);
        if (!cancelled) {
          setCategory(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setCategory(null);
          setError(requestError.response?.status === 404 ? 'Category not found.' : 'Unable to load this category right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCategory();

    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  const subCategories = useMemo(
    () => (Array.isArray(category?.sub_categories) ? category.sub_categories : []),
    [category]
  );

  const heroImage = category?.image_url || (category?.image_path ? `${apiBaseUrl}/storage/${category.image_path}` : '');
  const activeProductCount = Number(category?.active_products_count || 0);
  const activeSubCategoryCount = Number(category?.active_sub_categories_count || subCategories.length || 0);

  return (
    <div className="catalog-page">
      <StorefrontHeader />
      <div className="catalog-shell">
        <div className="catalog-breadcrumbs">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{loading ? 'Loading...' : category?.name || 'Category'}</span>
        </div>

        {loading ? (
          <>
            <section className="catalog-hero catalog-hero-loading" />
            <section className="catalog-loading-grid">
              {[0, 1, 2].map((item) => (
                <div key={item} className="catalog-loading-card" />
              ))}
            </section>
          </>
        ) : error ? (
          <section className="catalog-empty-state">
            <h1>{error}</h1>
            <p>We could not find that category page. Please head back home and choose another collection.</p>
            <Link to="/" className="catalog-primary-link">Return Home</Link>
          </section>
        ) : (
          <>
            <section className="catalog-hero">
              <div className="catalog-hero-copy">
                <span className="catalog-eyebrow">MessaraLiving Collection</span>
                <h1>{category.name}</h1>
                <p className="catalog-hero-description">
                  {category.description || `Explore the ${category.name} collection and jump into the sub categories that best match the room, finish, and style you have in mind.`}
                </p>
                <div className="catalog-stat-grid">
                  <div className="catalog-stat-card">
                    <strong>{activeSubCategoryCount}</strong>
                    <span>Sub categories</span>
                  </div>
                  <div className="catalog-stat-card">
                    <strong>{activeProductCount}</strong>
                    <span>Active products</span>
                  </div>
                </div>
              </div>
              <div className="catalog-hero-media">
                {heroImage ? (
                  <img src={heroImage} alt={category.name} />
                ) : (
                  <div className="catalog-hero-placeholder">{category.name}</div>
                )}
              </div>
            </section>

            <section className="catalog-section">
              <div className="catalog-section-head">
                <div>
                  <h2>Browse sub categories</h2>
                  <p>Clean sections to help you move through the category faster and understand what is available at a glance.</p>
                </div>
                <span className="catalog-section-meta">{activeSubCategoryCount} sections live</span>
              </div>

              {subCategories.length > 0 ? (
                <div className="subcategory-grid-public">
                  {subCategories.map((subCategory) => {
                    const imageUrl =
                      subCategory.image_url || (subCategory.image_path ? `${apiBaseUrl}/storage/${subCategory.image_path}` : '');
                    const productCount = Number(subCategory.active_products_count || 0);

                    return (
                      <Link
                        key={subCategory.id}
                        to={`/categories/${category.slug}/sub-categories/${subCategory.slug}`}
                        className="subcategory-card-public"
                      >
                        <div className="subcategory-card-media">
                          {imageUrl ? (
                            <img src={imageUrl} alt={subCategory.name} />
                          ) : (
                            <div className="subcategory-card-placeholder" />
                          )}
                        </div>
                        <div className="subcategory-card-content">
                          <span className="subcategory-card-badge">{productCount} products</span>
                          <h3>{subCategory.name}</h3>
                          <p>
                            {subCategory.description || `A focused ${subCategory.name.toLowerCase()} section inside ${category.name.toLowerCase()} for quick browsing.`}
                          </p>
                          <div className="subcategory-card-footer">
                            <span>See products</span>
                            <span>→</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="catalog-empty-panel">
                  <h3>No sub categories yet</h3>
                  <p>This category is live, but no sub categories have been added to it yet.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
