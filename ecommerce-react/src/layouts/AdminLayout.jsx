import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CHeader,
  CNavGroup,
  CNavItem,
  CNavLink,
  CSidebar,
  CSidebarBrand,
  CSidebarHeader,
  CSidebarNav,
} from '@coreui/react';
import {
  cilAccountLogout,
  cilBasket,
  cilBell,
  cilCalendar,
  cilCart,
  cilColorBorder,
  cilDescription,
  cilExternalLink,
  cilImage,
  cilLayers,
  cilList,
  cilMenu,
  cilMoon,
  cilPeople,
  cilResizeBoth,
  cilSearch,
  cilSpeedometer,
  cilSun,
  cilTag,
} from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { fetchAdminNotifications } from '../api/client';
import { useAuth } from '../context/AuthContext';

const pageDetails = {
  '/dashboard/overview': ['Dashboard', 'Store performance at a glance'],
  '/dashboard/users': ['Customers', 'Customer accounts and access'],
  '/dashboard/admin-accounts': ['Admin approvals', 'Review administrator access requests'],
  '/dashboard/categories': ['Categories', 'Organize the main storefront collections'],
  '/dashboard/sub-categories': ['Sub categories', 'Manage detailed product groupings'],
  '/dashboard/brands': ['Brands', 'Brand identities, logos, and storefront links'],
  '/dashboard/colors': ['Colors', 'Manage finishes, swatches, and product imagery'],
  '/dashboard/measurements': ['Measurements', 'Reusable dimensions and selling units'],
  '/dashboard/events': ['Events', 'Homepage promotions and scheduled campaigns'],
  '/dashboard/banners': ['Banners', 'Storefront banners and responsive artwork'],
  '/dashboard/size-options': ['Size options', 'Furniture, flooring, and wallpaper sizing'],
  '/dashboard/seo': ['SEO', 'Metadata, page indexing, and robots.txt'],
  '/dashboard/quotations': ['Quotations', 'Customer project and bulk-order requests'],
  '/dashboard/orders': ['Orders', 'Customer orders, fulfillment, and payment status'],
  '/dashboard/ai-knowledge': ['AI knowledge', 'Verified information used by the site assistant'],
  '/dashboard/products/create': ['Create product', 'Add a new product to the catalog'],
  '/dashboard/products/list': ['Products', 'Manage the complete product catalog'],
};

function resolvePageDetails(pathname) {
  if (pageDetails[pathname]) return pageDetails[pathname];
  if (/^\/dashboard\/products\/[^/]+\/edit$/.test(pathname)) {
    return ['Edit product', 'Update product content, options, imagery, and SEO'];
  }
  if (/^\/dashboard\/products\/[^/]+$/.test(pathname)) {
    return ['Product details', 'Review the complete stored product record'];
  }
  return ['Admin workspace', 'Manage Messara Living'];
}

function SidebarLink({ to, icon, children, onNavigate }) {
  return (
    <CNavItem>
      <CNavLink as={NavLink} to={to} onClick={onNavigate}>
        <CIcon customClassName="nav-icon" icon={icon} />
        <span>{children}</span>
      </CNavLink>
    </CNavItem>
  );
}

function notificationTime(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  return `${Math.floor(elapsedMinutes / 1440)}d ago`;
}

export default function AdminLayout() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 992px)').matches);
  const [sidebarVisible, setSidebarVisible] = useState(() => window.matchMedia('(min-width: 992px)').matches);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('messara_admin_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [notifications, setNotifications] = useState({
    unread_count: 0,
    order_count: 0,
    quotation_count: 0,
    items: [],
  });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationShake, setNotificationShake] = useState(false);
  const notificationRef = useRef(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pageTitle, pageSubtitle] = useMemo(() => resolvePageDetails(location.pathname), [location.pathname]);
  const userInitial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'A';
  const roleLabel = user?.role === 'super_admin' ? 'Super administrator' : 'Administrator';

  useEffect(() => {
    const media = window.matchMedia('(min-width: 992px)');
    const syncSidebar = (event) => {
      setIsDesktop(event.matches);
      setSidebarVisible(event.matches);
    };

    media.addEventListener('change', syncSidebar);
    return () => media.removeEventListener('change', syncSidebar);
  }, []);

  useEffect(() => {
    if (!isDesktop) setSidebarVisible(false);
    setNotificationOpen(false);
  }, [location.pathname, isDesktop]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-coreui-theme', theme);
    root.style.colorScheme = theme;
    localStorage.setItem('messara_admin_theme', theme);

    return () => {
      root.removeAttribute('data-coreui-theme');
      root.style.colorScheme = '';
    };
  }, [theme]);

  useEffect(() => {
    let active = true;
    let previousCount = 0;
    let shakeTimer;

    async function loadNotifications() {
      try {
        const data = await fetchAdminNotifications();
        if (!active) return;

        const nextCount = Number(data?.unread_count || 0);
        if (nextCount > previousCount) {
          setNotificationShake(true);
          window.clearTimeout(shakeTimer);
          shakeTimer = window.setTimeout(() => setNotificationShake(false), 1700);
        }
        previousCount = nextCount;
        setNotifications({
          unread_count: nextCount,
          order_count: Number(data?.order_count || 0),
          quotation_count: Number(data?.quotation_count || 0),
          items: Array.isArray(data?.items) ? data.items : [],
        });
      } catch {
        // Keep the last successful notification state when a background refresh fails.
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') loadNotifications();
    }

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 20000);
    window.addEventListener('focus', loadNotifications);
    window.addEventListener('admin:notifications-refresh', loadNotifications);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(shakeTimer);
      window.removeEventListener('focus', loadNotifications);
      window.removeEventListener('admin:notifications-refresh', loadNotifications);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    function closeNotificationOnOutsideClick(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', closeNotificationOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeNotificationOnOutsideClick);
  }, []);

  function closeSidebarOnMobile() {
    if (!isDesktop) setSidebarVisible(false);
  }

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell" data-admin-theme={theme}>
      <CSidebar className="admin-sidebar" position="fixed" visible={sidebarVisible}>
        <CSidebarHeader className="admin-sidebar-header">
          <CSidebarBrand className="admin-sidebar-brand">
            <Link to="/dashboard/overview" onClick={closeSidebarOnMobile} aria-label="Messara Living dashboard">
              <span className="admin-brand-logo">
                <img src="/messaraliving-logo.png" alt="Messara Living" />
              </span>
              <span className="admin-brand-copy">
                <strong>Commerce control</strong>
                <small>Admin workspace</small>
              </span>
            </Link>
          </CSidebarBrand>
        </CSidebarHeader>

        <CSidebarNav className="admin-sidebar-nav">
          <div className="admin-nav-label">Workspace</div>
          <SidebarLink to="/dashboard/overview" icon={cilSpeedometer} onNavigate={closeSidebarOnMobile}>Dashboard</SidebarLink>
          <SidebarLink to="/dashboard/users" icon={cilPeople} onNavigate={closeSidebarOnMobile}>Customers</SidebarLink>
          {user?.role === 'super_admin' && (
            <SidebarLink to="/dashboard/admin-accounts" icon={cilPeople} onNavigate={closeSidebarOnMobile}>Admin approvals</SidebarLink>
          )}

          <div className="admin-nav-label">Catalog</div>
          <CNavGroup
            toggler={<><CIcon customClassName="nav-icon" icon={cilBasket} /><span>Products</span></>}
          >
            <CNavItem>
              <CNavLink as={NavLink} to="/dashboard/products/list" onClick={closeSidebarOnMobile}>All products</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink as={NavLink} to="/dashboard/products/create" onClick={closeSidebarOnMobile}>Create product</CNavLink>
            </CNavItem>
          </CNavGroup>
          <SidebarLink to="/dashboard/categories" icon={cilList} onNavigate={closeSidebarOnMobile}>Categories</SidebarLink>
          <SidebarLink to="/dashboard/sub-categories" icon={cilLayers} onNavigate={closeSidebarOnMobile}>Sub categories</SidebarLink>
          <SidebarLink to="/dashboard/brands" icon={cilTag} onNavigate={closeSidebarOnMobile}>Brands</SidebarLink>
          <SidebarLink to="/dashboard/colors" icon={cilColorBorder} onNavigate={closeSidebarOnMobile}>Colors</SidebarLink>
          <SidebarLink to="/dashboard/measurements" icon={cilResizeBoth} onNavigate={closeSidebarOnMobile}>Measurements</SidebarLink>
          <SidebarLink to="/dashboard/size-options" icon={cilResizeBoth} onNavigate={closeSidebarOnMobile}>Size options</SidebarLink>

          <div className="admin-nav-label">Experience</div>
          <SidebarLink to="/dashboard/events" icon={cilCalendar} onNavigate={closeSidebarOnMobile}>Events</SidebarLink>
          <SidebarLink to="/dashboard/banners" icon={cilImage} onNavigate={closeSidebarOnMobile}>Banners</SidebarLink>
          <SidebarLink to="/dashboard/seo" icon={cilSearch} onNavigate={closeSidebarOnMobile}>SEO</SidebarLink>
          <SidebarLink to="/dashboard/orders" icon={cilCart} onNavigate={closeSidebarOnMobile}>Orders</SidebarLink>
          <SidebarLink to="/dashboard/quotations" icon={cilDescription} onNavigate={closeSidebarOnMobile}>Quotations</SidebarLink>
          <SidebarLink to="/dashboard/ai-knowledge" icon={cilDescription} onNavigate={closeSidebarOnMobile}>AI knowledge</SidebarLink>
        </CSidebarNav>

        <div className="admin-sidebar-account">
          <span className="admin-user-avatar">{userInitial}</span>
          <span>
            <strong>{user?.name || 'Administrator'}</strong>
            <small>{roleLabel}</small>
          </span>
        </div>
      </CSidebar>

      {!isDesktop && sidebarVisible && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarVisible(false)}
        />
      )}

      <div className="admin-main">
        <CHeader position="sticky" className="admin-topbar">
          <div className="admin-topbar-inner">
            <div className="admin-header-start">
              <button
                type="button"
                className="admin-icon-button admin-menu-button"
                aria-label={sidebarVisible ? 'Close navigation' : 'Open navigation'}
                aria-expanded={sidebarVisible}
                onClick={() => setSidebarVisible((visible) => !visible)}
              >
                <CIcon icon={cilMenu} />
              </button>
              <Link to="/dashboard/overview" className="admin-mobile-brand" aria-label="Messara Living dashboard">
                <img src="/messaraliving-logo.png" alt="" />
              </Link>
              <div className="admin-page-context">
                <span>Messara Living admin</span>
                <h1>{pageTitle}</h1>
                <p>{pageSubtitle}</p>
              </div>
            </div>

            <div className="admin-header-actions">
              <Link to="/" className="admin-view-store" target="_blank" rel="noreferrer">
                <CIcon icon={cilExternalLink} />
                <span>View store</span>
              </Link>
              <div className="admin-notification-wrap" ref={notificationRef}>
                <button
                  type="button"
                  className={`admin-icon-button admin-notification-button ${notifications.unread_count > 0 ? 'has-new' : ''} ${notificationShake ? 'is-shaking' : ''}`}
                  aria-label={`${notifications.unread_count} new order and quotation notifications`}
                  aria-expanded={notificationOpen}
                  title="New orders and quotations"
                  onClick={() => setNotificationOpen((open) => !open)}
                >
                  <CIcon icon={cilBell} />
                  {notifications.unread_count > 0 && (
                    <span className="admin-notification-badge">
                      {notifications.unread_count > 99 ? '99+' : notifications.unread_count}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <section className="admin-notification-panel" aria-label="Admin notifications">
                    <header>
                      <div>
                        <span>Activity inbox</span>
                        <strong>New notifications</strong>
                      </div>
                      <b>{notifications.unread_count}</b>
                    </header>
                    <div className="admin-notification-summary">
                      <span><strong>{notifications.order_count}</strong> orders</span>
                      <span><strong>{notifications.quotation_count}</strong> quotations</span>
                    </div>
                    <div className="admin-notification-list">
                      {notifications.items.length === 0 ? (
                        <div className="admin-notification-empty">
                          <CIcon icon={cilBell} />
                          <strong>You’re all caught up</strong>
                          <span>No new orders or quotation requests.</span>
                        </div>
                      ) : notifications.items.map((item) => (
                        <Link
                          to={item.route}
                          className="admin-notification-item is-new"
                          key={item.id}
                          onClick={() => setNotificationOpen(false)}
                        >
                          <span className={`admin-notification-type type-${item.type}`}>
                            <CIcon icon={item.type === 'order' ? cilCart : cilDescription} />
                          </span>
                          <span>
                            <small>{item.type === 'order' ? 'New order' : 'New quotation'} · {notificationTime(item.created_at)}</small>
                            <strong>{item.reference}</strong>
                            <span>{item.customer_name} · {item.currency || 'AED'} {Number(item.amount || 0).toFixed(2)}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                    <footer>
                      <Link to="/dashboard/orders" onClick={() => setNotificationOpen(false)}>View orders</Link>
                      <Link to="/dashboard/quotations" onClick={() => setNotificationOpen(false)}>View quotations</Link>
                    </footer>
                  </section>
                )}
              </div>
              <button
                type="button"
                className="admin-icon-button admin-theme-toggle"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                <CIcon icon={theme === 'dark' ? cilSun : cilMoon} />
              </button>
              <div className="admin-header-user">
                <span className="admin-user-avatar">{userInitial}</span>
                <span>
                  <strong>{user?.name || 'Administrator'}</strong>
                  <small>{roleLabel}</small>
                </span>
              </div>
              <button type="button" className="admin-logout-button" onClick={handleLogout}>
                <CIcon icon={cilAccountLogout} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </CHeader>

        <main className="admin-content">
          <Outlet />
        </main>

        <footer className="admin-footer">
          <span>Messara Living commerce control</span>
          <span>Secure administrator workspace</span>
        </footer>
      </div>
    </div>
  );
}
