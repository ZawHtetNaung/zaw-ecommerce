import { Outlet } from 'react-router-dom';
import BackToTopButton from '../components/BackToTopButton';
import AiChatWidget from '../components/AiChatWidget';
import StorefrontFooter from '../components/StorefrontFooter';
import WhatsAppLiveChat from '../components/WhatsAppLiveChat';

export default function StorefrontLayout() {
  return (
    <div className="storefront-layout">
      <Outlet />
      <StorefrontFooter />
      <WhatsAppLiveChat />
      <AiChatWidget />
      <BackToTopButton />
    </div>
  );
}
