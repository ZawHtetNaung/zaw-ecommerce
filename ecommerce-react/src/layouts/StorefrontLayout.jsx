import { Outlet } from 'react-router-dom';
import StorefrontFooter from '../components/StorefrontFooter';

export default function StorefrontLayout() {
  return (
    <div className="storefront-layout">
      <Outlet />
      <StorefrontFooter />
    </div>
  );
}
