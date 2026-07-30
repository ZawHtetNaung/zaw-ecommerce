import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const WHATSAPP_NUMBER = '971543057077';

export function buildWhatsAppUrl(currentUrl = '', isProductPage = false) {
  const message = isProductPage
    ? `Hi Messara Living,\nI'm interested in this product. Please share the best available price and more details.\n${currentUrl}`
    : `Hi, I'm interested in Messara Living products. Please share more details.\n${currentUrl}`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export default function WhatsAppLiveChat() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const href = useMemo(() => {
    const currentUrl = typeof window === 'undefined' ? '' : window.location.href;
    return buildWhatsAppUrl(currentUrl, location.pathname.startsWith('/product/')
      || location.pathname.includes('/products/'));
  }, [location.pathname, location.search]);

  return (
    <a
      className={`whatsapp-live-chat ${visible ? 'is-visible' : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Messara Living on WhatsApp"
    >
      <span className="whatsapp-live-chat-tip">Chat with us on WhatsApp</span>
      <span className="whatsapp-live-chat-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M27.3 4.6A15.5 15.5 0 0 0 2.9 23.3L.7 31.4l8.3-2.2A15.5 15.5 0 0 0 27.3 4.6Zm-11 24.2c-2.4 0-4.8-.7-6.8-1.9l-.5-.3-4.9 1.3 1.3-4.8-.3-.5A12.8 12.8 0 1 1 16.3 28.8Zm7-9.6c-.4-.2-2.4-1.2-2.8-1.3-.4-.1-.7-.2-1 .2-.3.4-1.1 1.3-1.4 1.6-.3.3-.5.3-.9.1-2.4-1.2-4-2.2-5.6-4.9-.4-.7.4-.7 1.2-2.2.1-.3.1-.5 0-.7-.1-.2-1-2.3-1.3-3.2-.3-.8-.7-.7-1-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.5 1.5-1.5 3.6s1.5 4.1 1.7 4.4c.2.3 3 4.6 7.3 6.4 2.7 1.2 3.8 1.3 5.1 1.1 1.6-.2 2.4-1.5 2.7-2.2.3-.7.3-1.4.2-1.6-.1-.2-.4-.3-.8-.5Z" />
        </svg>
      </span>
    </a>
  );
}
