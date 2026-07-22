import { Link } from 'react-router-dom';
import StorefrontHeader from '../components/StorefrontHeader';
import { useStore } from '../context/StoreContext';
import { getProductPurchaseLimit, isCartItemAvailable, isProductInStock } from '../utils/productStock';

function money(value) { return `AED ${Number(value || 0).toFixed(2)}`; }

function availabilityLabel(item) {
  if (isCartItemAvailable(item)) return 'Quantity';
  if (!isProductInStock(item.product)) return 'Out of stock';

  const purchaseLimit = getProductPurchaseLimit(item.product);
  if (purchaseLimit > 0 && Number(item.quantity) > purchaseLimit) return `Only ${purchaseLimit} available`;
  return 'Unavailable';
}

export default function CartPage() {
  const { cart, loading, changeCartQuantity, removeFromCart, clearCart } = useStore();
  const items = cart.items || [];
  const hasUnavailableItems = items.some((item) => !isCartItemAvailable(item));

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell basket-page">
        <section className="basket-heading"><div><span className="store-eyebrow">Your selection</span><h1>Shopping cart</h1><p>{cart.count || 0} items ready for your space.</p></div>{items.length > 0 && <button type="button" onClick={clearCart}>Clear cart</button>}</section>
        {loading ? <div className="store-empty-state"><h2>Loading your cart...</h2></div> : items.length === 0 ? (
          <div className="store-empty-state"><span>Your cart is ready</span><h2>Choose something worth making room for.</h2><p>Explore furniture and add your favourites when you are ready.</p><Link to="/search" className="store-primary-button">Browse products</Link></div>
        ) : (
          <div className="basket-layout">
            <section className="basket-items">
              {items.map((item) => (
                <article className="basket-item" key={item.id}>
                  <Link to={`/product/${item.product.slug}`} className="basket-item-image">{item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} /> : <span>{item.product.name?.charAt(0)}</span>}</Link>
                  <div className="basket-item-copy"><span>{item.product.brand?.name || item.product.category?.name || 'MessaraLiving'}</span><Link to={`/product/${item.product.slug}`}><h2>{item.product.name}</h2></Link><strong>{money(item.unit_price)}</strong><button type="button" onClick={() => removeFromCart(item.id)}>Remove</button></div>
                  <div className="basket-quantity"><span>{availabilityLabel(item)}</span><div><button type="button" disabled={!isCartItemAvailable(item) || item.quantity <= 1} onClick={() => changeCartQuantity(item.id, item.quantity - 1)}>−</button><strong>{item.quantity}</strong><button type="button" disabled={!isCartItemAvailable(item) || item.quantity >= getProductPurchaseLimit(item.product)} onClick={() => changeCartQuantity(item.id, item.quantity + 1)}>+</button></div></div>
                  <strong className="basket-line-total">{money(item.line_total)}</strong>
                </article>
              ))}
            </section>
            <aside className="basket-summary"><span>Order summary</span><h2>{money(cart.subtotal)}</h2><div><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><div><span>Delivery</span><strong>Calculated at checkout</strong></div><div className="basket-summary-total"><span>Estimated total</span><strong>{money(cart.subtotal)}</strong></div>{hasUnavailableItems && <small>Remove unavailable products before checkout.</small>}{hasUnavailableItems ? <button type="button" className="store-primary-button" disabled>Unavailable item in cart</button> : <Link to="/checkout" className="store-primary-button">Continue to checkout</Link>}<small>Delivery depends on the UAE area and merchandise subtotal.</small></aside>
          </div>
        )}
      </main>
    </div>
  );
}
