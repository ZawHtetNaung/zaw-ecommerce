import { Link } from 'react-router-dom';
import StorefrontHeader from '../components/StorefrontHeader';

const services = [
  { number: '01', title: 'Delivery & assembly', text: 'Careful UAE-wide delivery with optional furniture assembly and placement in the room you choose.', id: 'delivery' },
  { number: '02', title: 'Interior consultation', text: 'Practical guidance on scale, layout, colour, and materials for a room that feels considered.' },
  { number: '03', title: 'Commercial projects', text: 'Furniture sourcing and coordinated support for offices, hospitality, and multi-unit spaces.' },
  { number: '04', title: 'After-sales care', text: 'Clear product support after delivery, with a team ready to help you protect your purchase.' },
];

export default function ServicesPage() {
  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell editorial-page">
        <section className="store-page-hero services-hero">
          <div>
            <span className="store-eyebrow">The Messara experience</span>
            <h1>Support that continues beyond the product.</h1>
            <p>From choosing the right piece to getting it placed perfectly, our services make every stage feel simpler.</p>
            <Link to="/search" className="store-primary-button">Explore furniture</Link>
          </div>
          <div className="service-hero-mark"><span>M</span><strong>Made easier</strong><small>Dubai · UAE</small></div>
        </section>

        <section className="editorial-section" id="delivery">
          <div className="editorial-section-heading"><span>How we help</span><h2>Designed around real homes and real schedules.</h2></div>
          <div className="service-grid">
            {services.map((service) => (
              <article key={service.number} id={service.id || undefined} className="service-card">
                <span>{service.number}</span><h3>{service.title}</h3><p>{service.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="service-contact-band" id="contact">
          <div><span>Need a recommendation?</span><h2>Let’s make the next decision easier.</h2></div>
          <a href="mailto:hello@messaraliving.com">hello@messaraliving.com</a>
        </section>

        <section className="service-faq" id="faqs">
          <div id="about"><span className="store-eyebrow">About us</span><h2>Furniture with an editorial eye and everyday purpose.</h2></div>
          <details open><summary>Where do you deliver?</summary><p>We serve customers across the UAE. Delivery timing is confirmed based on product availability and destination.</p></details>
          <details><summary>Can your team assemble furniture?</summary><p>Yes. Assembly availability is shown or confirmed with the delivery plan for each eligible item.</p></details>
          <details><summary>Can I get help choosing products?</summary><p>Yes. Share your room measurements, preferred style, and budget, and our team can help narrow the collection.</p></details>
        </section>
      </main>
    </div>
  );
}
