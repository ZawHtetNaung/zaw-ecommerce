import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import CategoriesPage from './pages/CategoriesPage';
import ColorsPage from './pages/ColorsPage';
import DashboardHomePage from './pages/DashboardHomePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MeasurementsPage from './pages/MeasurementsPage';
import BrandsPage from './pages/BrandsPage';
import BannersPage from './pages/BannersPage';
import CartPage from './pages/CartPage';
import EventsPage from './pages/EventsPage';
import FavouritesPage from './pages/FavouritesPage';
import NewsPage from './pages/NewsPage';
import ProductCreatePage from './pages/ProductCreatePage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProductEditPage from './pages/ProductEditPage';
import ProductListPage from './pages/ProductListPage';
import PublicCategoryPage from './pages/PublicCategoryPage';
import PublicProductDetailPage from './pages/PublicProductDetailPage';
import PublicSubCategoryProductsPage from './pages/PublicSubCategoryProductsPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SearchResultsPage from './pages/SearchResultsPage';
import ServicesPage from './pages/ServicesPage';
import SubCategoriesPage from './pages/SubCategoriesPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/categories/:categorySlug" element={<PublicCategoryPage />} />
      <Route path="/product/:productSlug" element={<PublicProductDetailPage />} />
      <Route path="/categories/:categorySlug/sub-categories/:subCategorySlug" element={<PublicSubCategoryProductsPage />} />
      <Route
        path="/categories/:categorySlug/sub-categories/:subCategorySlug/products/:productSlug"
        element={<PublicProductDetailPage />}
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/search" element={<SearchResultsPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
      <Route path="/favourites" element={<ProtectedRoute><FavouritesPage /></ProtectedRoute>} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard/users" replace />} />
        <Route path="overview" element={<DashboardHomePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="sub-categories" element={<SubCategoriesPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="colors" element={<ColorsPage />} />
        <Route path="measurements" element={<MeasurementsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="banners" element={<BannersPage />} />
        <Route path="products" element={<Navigate to="/dashboard/products/list" replace />} />
        <Route path="products/create" element={<ProductCreatePage />} />
        <Route path="products/list" element={<ProductListPage />} />
        <Route path="products/:productId/edit" element={<ProductEditPage />} />
        <Route path="products/:productId" element={<ProductDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
