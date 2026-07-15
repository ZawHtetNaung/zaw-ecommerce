import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPublicProductFilters, fetchPublicProducts } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import StoreProductCard from '../components/StoreProductCard';

const defaultFilters = { category_id: '', brand_id: '', min_price: '', max_price: '', sort: 'newest' };

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() || '';
  const [filters, setFilters] = useState(defaultFilters);
  const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [], price: {} });
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPublicProductFilters()
      .then(setFilterOptions)
      .catch(() => setFilterOptions({ categories: [], brands: [], price: {} }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSearchResults() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPublicProducts(1, 12, { q: query, ...filters });
        if (!cancelled) {
          setProducts(Array.isArray(data?.data) ? data.data : []);
          setPagination({
            currentPage: Number(data?.current_page || 1),
            lastPage: Number(data?.last_page || 1),
            total: Number(data?.total || 0),
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setProducts([]);
          setError(requestError.response?.data?.message || 'Unable to load search results.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSearchResults();
    return () => { cancelled = true; };
  }, [query, filters]);

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'sort' && value !== '').length,
    [filters]
  );

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function loadMore() {
    if (loadingMore || pagination.currentPage >= pagination.lastPage) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextPage = pagination.currentPage + 1;
      const data = await fetchPublicProducts(nextPage, 12, { q: query, ...filters });
      const nextProducts = Array.isArray(data?.data) ? data.data : [];
      setProducts((current) => [...current, ...nextProducts]);
      setPagination({
        currentPage: Number(data?.current_page || nextPage),
        lastPage: Number(data?.last_page || nextPage),
        total: Number(data?.total || products.length + nextProducts.length),
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load more products.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell search-page-shell">
        <section className="store-page-hero compact">
          <div>
            <span className="store-eyebrow">Curated search</span>
            <h1>{query ? `Results for “${query}”` : 'Explore all products'}</h1>
            <p>Refine by category, brand, or price while keeping every matching product in one clear place.</p>
          </div>
          <div className="search-result-total">
            <strong>{pagination.total}</strong>
            <span>products found</span>
          </div>
        </section>

        <div className="search-layout">
          <aside className="search-filter-panel">
            <div className="search-filter-heading">
              <div><span>Refine</span><strong>Filters</strong></div>
              {activeFilterCount > 0 && <button type="button" onClick={() => setFilters(defaultFilters)}>Clear {activeFilterCount}</button>}
            </div>
            <label>
              Category
              <select name="category_id" value={filters.category_id} onChange={updateFilter}>
                <option value="">All categories</option>
                {(filterOptions.categories || []).map((category) => (
                  <option key={category.id} value={category.id}>{category.name} ({category.products_count})</option>
                ))}
              </select>
            </label>
            <label>
              Brand
              <select name="brand_id" value={filters.brand_id} onChange={updateFilter}>
                <option value="">All brands</option>
                {(filterOptions.brands || []).map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name} ({brand.products_count})</option>
                ))}
              </select>
            </label>
            <div className="search-price-fields">
              <label>Min AED<input type="number" min="0" name="min_price" value={filters.min_price} onChange={updateFilter} placeholder="0" /></label>
              <label>Max AED<input type="number" min="0" name="max_price" value={filters.max_price} onChange={updateFilter} placeholder={filterOptions.price?.max || 'Any'} /></label>
            </div>
          </aside>

          <section className="search-results-panel">
            <div className="search-results-toolbar">
              <span>{loading ? 'Searching products...' : `${pagination.total} matching products`}</span>
              <label>
                Sort
                <select name="sort" value={filters.sort} onChange={updateFilter}>
                  <option value="newest">Newest first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </label>
            </div>

            {error && <div className="store-alert error">{error}</div>}
            {loading ? (
              <div className="store-product-grid">
                {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="store-product-skeleton" />)}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="store-product-grid">
                  {products.map((product) => <StoreProductCard key={product.id} product={product} />)}
                </div>
                {pagination.currentPage < pagination.lastPage && (
                  <button type="button" className="store-load-more" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading...' : 'Load more products'}
                  </button>
                )}
              </>
            ) : (
              <div className="store-empty-state"><span>Nothing matched yet</span><h2>Try a broader search</h2><p>Remove a filter or search using a room, product, brand, or category name.</p></div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
