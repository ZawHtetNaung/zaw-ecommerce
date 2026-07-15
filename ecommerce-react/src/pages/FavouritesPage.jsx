import { Link } from 'react-router-dom';
import StorefrontHeader from '../components/StorefrontHeader';
import StoreProductCard from '../components/StoreProductCard';
import { useStore } from '../context/StoreContext';

export default function FavouritesPage() {
  const { favorites, loading } = useStore();
  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell favourites-page">
        <section className="store-page-hero compact"><div><span className="store-eyebrow">Saved for later</span><h1>Your favourites</h1><p>A personal shortlist you can return to, compare, and move into your cart.</p></div><div className="search-result-total"><strong>{favorites.length}</strong><span>saved products</span></div></section>
        {loading ? <div className="store-empty-state"><h2>Loading favourites...</h2></div> : favorites.length > 0 ? (
          <div className="store-product-grid favourites-grid">{favorites.map((product) => <StoreProductCard key={product.id} product={product} />)}</div>
        ) : (
          <div className="store-empty-state"><span>Your edit starts here</span><h2>Save pieces you want to see again.</h2><p>Tap the heart on any product and it will stay connected to your account.</p><Link to="/search" className="store-primary-button">Find products</Link></div>
        )}
      </main>
    </div>
  );
}
