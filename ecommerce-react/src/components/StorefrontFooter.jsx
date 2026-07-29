import { Link } from 'react-router-dom';
import CIcon from '@coreui/icons-react';
import {
  cibFacebookF,
  cibInstagram,
  cibLinkedinIn,
  cibTwitter,
  cibYoutube,
} from '@coreui/icons';

const currentYear = new Date().getFullYear();

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/messaraliving/', icon: cibInstagram },
  { label: 'Facebook', href: 'https://www.facebook.com/messaraliving/', icon: cibFacebookF },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/messara-living/', icon: cibLinkedinIn },
  { label: 'Twitter', href: 'https://twitter.com/MessaraLiving/', icon: cibTwitter },
  { label: 'YouTube', href: 'https://www.youtube.com/@messaraliving9513', icon: cibYoutube },
];

const paymentMethods = [
  { label: 'Visa', src: '/payment-methods/visa.svg', trimSquareCanvas: true },
  { label: 'Mastercard', src: '/payment-methods/mastercard.svg', trimSquareCanvas: true },
  { label: 'PayPal', src: '/payment-methods/paypal.svg', trimSquareCanvas: true },
  { label: 'American Express', src: '/payment-methods/amex.svg', trimSquareCanvas: true },
  { label: 'Visa Electron', src: '/payment-methods/visaelectron.svg' },
  { label: 'Maestro', src: '/payment-methods/maestro.svg', trimSquareCanvas: true },
];

export default function StorefrontFooter() {
  return (
    <footer id="site-footer" className="storefront-footer">
      <div className="storefront-footer-main">
        <div className="storefront-footer-brand">
          <Link to="/" aria-label="Messara Living home">
            <img src="/messaraliving-logo.png" alt="Messara Living" />
          </Link>
          <p>
            Furniture, flooring, wallpaper, and outdoor collections for homes,
            hospitality, and commercial spaces across the UAE.
          </p>
          <div className="storefront-footer-location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            <span>Dubai &amp; Sharjah, UAE</span>
          </div>
        </div>

        <section className="storefront-footer-column storefront-footer-showroom" aria-labelledby="dubai-showroom-title">
          <strong id="dubai-showroom-title">Dubai Showroom</strong>
          <address>
            <span>Messara Living Showroom</span>
            <span>Umm Suqeim Road, Al Barsha 2</span>
            <span>Dubai, UAE</span>
          </address>
          <a href="tel:+97143597374">+971 4 359 7374</a>
          <a href="tel:8006377272">800 MESSARA (637 72 72)</a>
          <p className="storefront-footer-hours">Every day: 9 AM–10 PM</p>
        </section>

        <section className="storefront-footer-column storefront-footer-showroom" aria-labelledby="sharjah-gallery-title">
          <strong id="sharjah-gallery-title">Sharjah Gallery</strong>
          <address>
            <span>Messara Living Gallery</span>
            <span>Sharjah Furniture Complex</span>
            <span>Industrial Area 4, Sharjah</span>
          </address>
          <a href="tel:+97165331111">+971 6 533 1111</a>
          <p className="storefront-footer-hours">
            Saturday–Thursday: 9 AM–10 PM
            <br />
            Friday: 2 PM–10 PM
          </p>
        </section>

        <nav className="storefront-footer-column" aria-label="Footer support links">
          <strong>Useful Links</strong>
          <Link to="/services#delivery">Delivery information</Link>
          <Link to="/services#contact">Contact us</Link>
          <Link to="/services#faqs">FAQs</Link>
          <Link to="/services#about">About us</Link>
          <a href="https://www.messaraliving.com/privacy-policy-2/">Privacy policy</a>
        </nav>

        <section className="storefront-footer-column storefront-footer-connect" aria-labelledby="footer-connect-title">
          <strong id="footer-connect-title">Connect</strong>
          <p>Follow Messara Living for new collections, projects, and showroom updates.</p>
          <div className="storefront-footer-socials">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Messara Living on ${social.label}`}
                title={social.label}
              >
                <CIcon icon={social.icon} />
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className="storefront-footer-bottom">
        <span>© {currentYear} Messara Living. Owned &amp; managed by Messara Living.</span>
        <div className="storefront-footer-payments" aria-label="Accepted payment methods">
          {paymentMethods.map((method) => (
            <span key={method.label} className="storefront-footer-payment" title={method.label}>
              <img
                className={method.trimSquareCanvas ? 'is-square-source' : undefined}
                src={method.src}
                alt={method.label}
                loading="lazy"
                decoding="async"
              />
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
