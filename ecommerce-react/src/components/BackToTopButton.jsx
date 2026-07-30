import { useEffect, useState } from 'react';

export default function BackToTopButton() {
  const [visible, setVisible] = useState(() => window.scrollY > 100);

  useEffect(() => {
    let animationFrame = 0;

    function updateVisibility() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setVisible(window.scrollY > 100);
      });
    }

    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', updateVisibility);
    };
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  return (
    <button
      type="button"
      className={`back-to-top-button ${visible ? 'is-visible' : ''}`}
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
  );
}
