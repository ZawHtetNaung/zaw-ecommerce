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
    if (pathname.startsWith('/product/') || pathname.includes('/products/') || pathname.startsWith('/dashboard')) return;
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
