import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchPublicSeo } from '../api/client';

function setMeta(name, content) {
  let element = document.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function PageSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/checkout' || pathname === '/cart') {
      const isCheckout = pathname === '/checkout';
      document.title = `${isCheckout ? 'Checkout' : 'Shopping Cart'} | Messara Living`;
      setMeta('description', isCheckout ? 'Secure Messara Living checkout.' : 'Your Messara Living shopping cart.');
      setMeta('robots', 'noindex, nofollow');
      return undefined;
    }

    if (pathname.startsWith('/product/') || pathname.includes('/products/')) {
      setMeta('robots', 'index, follow');
      return undefined;
    }

    if (pathname.startsWith('/dashboard')) {
      setMeta('robots', 'noindex, nofollow');
      return undefined;
    }
    let active = true;
    fetchPublicSeo(pathname)
      .then((page) => {
        if (!active) return;
        document.title = page.meta_title || `${page.name} | Messara Living`;
        setMeta('description', page.meta_description || '');
        setMeta('robots', page.is_indexable ? 'index, follow' : 'noindex, nofollow');
      })
      .catch(() => {});
    return () => { active = false; };
  }, [pathname]);

  return null;
}
