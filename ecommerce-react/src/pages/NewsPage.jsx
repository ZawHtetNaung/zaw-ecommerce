import { Link } from 'react-router-dom';
import StorefrontHeader from '../components/StorefrontHeader';

const stories = [
  { tag: 'Rooms', title: 'Five ways to make a living room feel calmer', text: 'Balance open space, useful storage, and one confident material story.', date: 'July 12, 2026', tone: 'sand' },
  { tag: 'Buying guide', title: 'How to choose the right dining table size', text: 'A practical guide to circulation, chair clearance, and flexible hosting.', date: 'July 6, 2026', tone: 'red' },
  { tag: 'Materials', title: 'Warm woods are reshaping modern interiors', text: 'Why richer oak and walnut tones work especially well in bright UAE homes.', date: 'June 28, 2026', tone: 'charcoal' },
  { tag: 'New collection', title: 'Storage that looks lighter and works harder', text: 'Meet cleaner cabinets, modular shelving, and pieces that hide everyday clutter.', date: 'June 18, 2026', tone: 'cream' },
];

export default function NewsPage() {
  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell editorial-page">
        <section className="news-intro">
          <span className="store-eyebrow">Messara journal</span>
          <h1>Ideas for a home that feels good to live in.</h1>
          <p>Room inspiration, buying advice, materials, and a closer look at what is arriving next.</p>
        </section>
        <section className="news-feature">
          <div className="news-feature-art"><span>THE<br />EDIT</span></div>
          <div className="news-feature-copy"><span>Featured story · July 15, 2026</span><h2>A cleaner way to build a room, one useful layer at a time.</h2><p>Start with movement and function, then add texture, colour, and the details that make a space personal.</p><Link to="/search">Shop the edit <span>→</span></Link></div>
        </section>
        <section className="news-grid">
          {stories.map((story) => (
            <article className={`news-card tone-${story.tone}`} key={story.title}>
              <div className="news-card-art"><span>{story.tag}</span></div>
              <div className="news-card-copy"><small>{story.date}</small><h2>{story.title}</h2><p>{story.text}</p><Link to="/search">Discover products →</Link></div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
