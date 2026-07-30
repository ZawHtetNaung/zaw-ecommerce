import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CButton,
  CContainer,
  CHeader,
  CHeaderBrand,
  CHeaderNav,
  CHeaderToggler,
  CNavGroup,
  CNavItem,
  CNavLink,
  CSidebar,
  CSidebarBrand,
  CSidebarHeader,
  CSidebarNav,
} from '@coreui/react';
import {
  cilBasket,
  cilCalendar,
  cilColorBorder,
  cilDescription,
  cilImage,
  cilLayers,
  cilList,
  cilPeople,
  cilResizeBoth,
  cilSpeedometer,
  cilTag,
  cilSearch,
} from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell">
      <CSidebar className="border-end" position="fixed" visible={sidebarVisible}>
        <CSidebarHeader className="border-bottom">
          <CSidebarBrand>Admin Panel</CSidebarBrand>
        </CSidebarHeader>
        <CSidebarNav>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/overview">
              <CIcon customClassName="nav-icon" icon={cilSpeedometer} /> Dashboard
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/users">
              <CIcon customClassName="nav-icon" icon={cilPeople} /> Users
            </CNavLink>
          </CNavItem>
          {user?.role === 'super_admin' && (
            <CNavItem>
              <CNavLink as={NavLink} to="/dashboard/admin-accounts">
                <CIcon customClassName="nav-icon" icon={cilPeople} /> Admin Approvals
              </CNavLink>
            </CNavItem>
          )}
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/categories">
              <CIcon customClassName="nav-icon" icon={cilList} /> Categories
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/sub-categories">
              <CIcon customClassName="nav-icon" icon={cilLayers} /> Sub Categories
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/brands">
              <CIcon customClassName="nav-icon" icon={cilTag} /> Brands
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/colors">
              <CIcon customClassName="nav-icon" icon={cilColorBorder} /> Colors
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/measurements">
              <CIcon customClassName="nav-icon" icon={cilResizeBoth} /> Measurements
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/events">
              <CIcon customClassName="nav-icon" icon={cilCalendar} /> Events
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/banners">
              <CIcon customClassName="nav-icon" icon={cilImage} /> Banners
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/size-options">
              <CIcon customClassName="nav-icon" icon={cilResizeBoth} /> Size Options
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/seo">
              <CIcon customClassName="nav-icon" icon={cilSearch} /> SEO
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/quotations">
              <CIcon customClassName="nav-icon" icon={cilDescription} /> Quotations
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as={NavLink} to="/dashboard/ai-knowledge">
              <CIcon customClassName="nav-icon" icon={cilDescription} /> AI Knowledge
            </CNavLink>
          </CNavItem>
          <CNavGroup toggler={<><CIcon customClassName="nav-icon" icon={cilBasket} /> Products</>}>
            <CNavItem>
              <CNavLink as={NavLink} to="/dashboard/products/create">
                Create Product
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink as={NavLink} to="/dashboard/products/list">
                Products List
              </CNavLink>
            </CNavItem>
          </CNavGroup>
        </CSidebarNav>
      </CSidebar>

      <div className="admin-main">
        <CHeader position="sticky" className="mb-4 px-3">
          <CContainer fluid>
            <CHeaderToggler onClick={() => setSidebarVisible((prev) => !prev)} />
            <CHeaderBrand className="d-md-none">Admin</CHeaderBrand>
            <CHeaderNav className="ms-auto align-items-center gap-3">
              <span className="text-body-secondary small">
                {user?.name} · {user?.role === 'super_admin' ? 'Super admin' : 'Admin'}
              </span>
              <CButton color="dark" variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </CButton>
            </CHeaderNav>
          </CContainer>
        </CHeader>

        <CContainer fluid>
          <Outlet />
        </CContainer>
      </div>
    </div>
  );
}
