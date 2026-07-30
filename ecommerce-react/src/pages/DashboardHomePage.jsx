import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CIcon from '@coreui/icons-react';
import {
  cilArrowRight,
  cilBasket,
  cilCart,
  cilColorBorder,
  cilDescription,
  cilImage,
  cilLayers,
  cilList,
  cilPeople,
  cilPlus,
  cilResizeBoth,
  cilTag,
} from '@coreui/icons';
import {
  fetchCategories,
  fetchBrands,
  fetchColors,
  fetchMeasurements,
  fetchOrders,
  fetchProducts,
  fetchQuotationRequests,
  fetchSubCategories,
  fetchUsers,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

function collectionCount(response) {
  if (Array.isArray(response)) return response.length;
  if (Array.isArray(response?.data)) return response.data.length;
  return Number(response?.total || response?.meta?.total || 0);
}

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    categories: 0,
    subCategories: 0,
    products: 0,
    brands: 0,
    colors: 0,
    measurements: 0,
    orders: 0,
    newOrders: 0,
    quotations: 0,
    newQuotations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const currentDate = useMemo(() => new Intl.DateTimeFormat('en-AE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()), []);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setLoadError('');

      try {
        const [users, categories, subCategories, products, brands, colors, measurements, orders, quotations] = await Promise.all([
          fetchUsers(),
          fetchCategories(),
          fetchSubCategories(),
          fetchProducts(),
          fetchBrands(),
          fetchColors(),
          fetchMeasurements(),
          fetchOrders(),
          fetchQuotationRequests(),
        ]);

        if (!cancelled) {
          setStats({
            users: collectionCount(users),
            categories: collectionCount(categories),
            subCategories: collectionCount(subCategories),
            products: collectionCount(products),
            brands: collectionCount(brands),
            colors: collectionCount(colors),
            measurements: collectionCount(measurements),
            orders: collectionCount(orders),
            newOrders: Array.isArray(orders) ? orders.filter((order) => order.status === 'new').length : 0,
            quotations: collectionCount(quotations),
            newQuotations: Array.isArray(quotations) ? quotations.filter((quotation) => quotation.status === 'new').length : 0,
          });
        }
      } catch {
        if (!cancelled) setLoadError('Some dashboard totals could not be loaded. You can still use all management tools.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const metricCards = [
    { key: 'orders', label: 'Orders', detail: `${stats.newOrders} new to review`, icon: cilCart, tone: 'red', to: '/dashboard/orders' },
    { key: 'quotations', label: 'Quotations', detail: `${stats.newQuotations} new requests`, icon: cilDescription, tone: 'blue', to: '/dashboard/quotations' },
    { key: 'products', label: 'Products', detail: 'Complete catalog', icon: cilBasket, tone: 'red', to: '/dashboard/products/list' },
    { key: 'users', label: 'Customers', detail: 'Registered accounts', icon: cilPeople, tone: 'cyan', to: '/dashboard/users' },
    { key: 'categories', label: 'Categories', detail: 'Main collections', icon: cilList, tone: 'amber', to: '/dashboard/categories' },
    { key: 'subCategories', label: 'Sub categories', detail: 'Catalog groupings', icon: cilLayers, tone: 'violet', to: '/dashboard/sub-categories' },
    { key: 'brands', label: 'Brands', detail: 'Connected partners', icon: cilTag, tone: 'green', to: '/dashboard/brands' },
    { key: 'colors', label: 'Colors', detail: 'Swatches and finishes', icon: cilColorBorder, tone: 'rose', to: '/dashboard/colors' },
    { key: 'measurements', label: 'Measurements', detail: 'Reusable values', icon: cilResizeBoth, tone: 'cyan', to: '/dashboard/measurements' },
  ];

  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard-welcome">
        <div>
          <span className="admin-dashboard-kicker">Store overview</span>
          <h2>Welcome back, {user?.name?.split(' ')[0] || 'Administrator'}.</h2>
          <p>Manage the catalog, customer requests, storefront content, and search visibility from one workspace.</p>
        </div>
        <div className="admin-dashboard-date">
          <span>Today</span>
          <strong>{currentDate}</strong>
        </div>
      </section>

      {loadError && <div className="admin-dashboard-notice">{loadError}</div>}

      <section className="admin-metric-grid" aria-label="Store totals">
        {metricCards.map((metric) => (
          <Link to={metric.to} className={`admin-metric-card tone-${metric.tone}`} key={metric.key}>
            <span className="admin-metric-icon"><CIcon icon={metric.icon} /></span>
            <span className="admin-metric-copy">
              <small>{metric.label}</small>
              <strong className={loading ? 'is-loading' : ''}>{loading ? '—' : stats[metric.key]}</strong>
              <span>{metric.detail}</span>
            </span>
            <CIcon className="admin-metric-arrow" icon={cilArrowRight} />
          </Link>
        ))}
      </section>

      <section className="admin-dashboard-lower">
        <div className="admin-quick-panel">
          <div className="admin-panel-heading">
            <div>
              <span>Quick actions</span>
              <h3>Keep the store moving</h3>
            </div>
            <p>Jump directly to the tasks used most often.</p>
          </div>
          <div className="admin-quick-grid">
            <Link to="/dashboard/orders">
              <span><CIcon icon={cilCart} /></span>
              <strong>Manage orders</strong>
              <small>Confirm new orders and update fulfillment and payment status.</small>
            </Link>
            <Link to="/dashboard/products/create">
              <span><CIcon icon={cilPlus} /></span>
              <strong>Create product</strong>
              <small>Add content, images, colors, stock, measurements, and SEO.</small>
            </Link>
            <Link to="/dashboard/banners">
              <span><CIcon icon={cilImage} /></span>
              <strong>Update banners</strong>
              <small>Refresh responsive storefront campaigns and artwork.</small>
            </Link>
            <Link to="/dashboard/quotations">
              <span><CIcon icon={cilDescription} /></span>
              <strong>Review quotations</strong>
              <small>Follow up on customer projects and bulk order requests.</small>
            </Link>
          </div>
        </div>

        <aside className="admin-catalog-health">
          <span className="admin-dashboard-kicker">Catalog structure</span>
          <h3>Everything connected</h3>
          <p>Your product organization is built from categories, brands, colors, and reusable measurements.</p>
          <div>
            <span><strong>{stats.categories + stats.subCategories}</strong> category levels</span>
            <span><strong>{stats.brands}</strong> brands</span>
            <span><strong>{stats.colors + stats.measurements}</strong> product options</span>
          </div>
          <Link to="/dashboard/products/list">Review catalog <CIcon icon={cilArrowRight} /></Link>
        </aside>
      </section>
    </div>
  );
}
