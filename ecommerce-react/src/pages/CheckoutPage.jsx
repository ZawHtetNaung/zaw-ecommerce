import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCheckoutQuote } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { isCartItemAvailable } from '../utils/productStock';

const UAE_AREAS = [
  { code: 'DXB', label: 'Dubai' },
  { code: 'SHJ', label: 'Sharjah' },
  { code: 'AJM', label: 'Ajman' },
  { code: 'AUB', label: 'Abu Dhabi' },
  { code: 'ALN', label: 'Al Ain' },
  { code: 'WRN', label: 'Western Region' },
  { code: 'AAR', label: 'Abu Dhabi Al Ain Road' },
  { code: 'HTA', label: 'Hatta' },
  { code: 'FUJ', label: 'Fujairah' },
  { code: 'RAK', label: 'Ras Al Khaimah' },
  { code: 'UAQ', label: 'Umm Al Quwain' },
];

function money(value) {
  return `AED ${Number(value || 0).toFixed(2)}`;
}

function requestMessage(error) {
  const validationErrors = error.response?.data?.errors;
  if (validationErrors) return Object.values(validationErrors).flat()[0];
  return error.response?.data?.message || 'Unable to calculate delivery right now.';
}

export default function CheckoutPage() {
  const { user, isAuthenticated } = useAuth();
  const { cart, loading } = useStore();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    emirate_code: '',
    city_area: '',
    address_line_1: '',
    address_line_2: '',
    notes: '',
  });
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const items = cart.items || [];
  const hasUnavailableItems = items.some((item) => !isCartItemAvailable(item));
  const cartQuoteKey = useMemo(
    () => items.map((item) => `${item.id}:${item.quantity}:${item.unit_price}:${item.is_available}`).join('|'),
    [items]
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      full_name: current.full_name || user?.name || '',
      email: current.email || user?.email || '',
    }));
  }, [user]);

  useEffect(() => {
    if (!form.emirate_code || items.length === 0 || hasUnavailableItems) {
      setQuote(null);
      setQuoteError('');
      setQuoteLoading(false);
      return undefined;
    }

    let active = true;
    setQuote(null);
    setQuoteLoading(true);
    setQuoteError('');

    const guestItems = isAuthenticated ? null : items.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
    }));

    fetchCheckoutQuote(form.emirate_code, guestItems)
      .then((data) => {
        if (active) setQuote(data);
      })
      .catch((error) => {
        if (!active) return;
        setQuote(null);
        setQuoteError(requestMessage(error));
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.emirate_code, cartQuoteKey, hasUnavailableItems, isAuthenticated, items.length]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  const accountChoicePanel = !isAuthenticated ? (
    <section className="checkout-account-choice" aria-labelledby="checkout-account-title">
      <div className="checkout-account-copy">
        <span className="checkout-account-icon" aria-hidden="true">M</span>
        <div>
          <span className="store-eyebrow">Your account</span>
          <h2 id="checkout-account-title">Continue with your Messara Living account</h2>
          <p>Log in or create an account before payment. Your cart and delivery details will stay ready while you continue.</p>
        </div>
      </div>
      <div className="checkout-account-actions">
        <Link to="/login" state={{ from: '/checkout' }} className="store-primary-button">Log in</Link>
        <Link to="/register" state={{ from: '/checkout' }} className="checkout-secondary-button">Create account</Link>
      </div>
    </section>
  ) : null;

  if (loading) {
    return (
      <div className="storefront-page">
        <StorefrontHeader />
        <main className="store-page-shell checkout-page">
          {accountChoicePanel}
          <div className="store-empty-state"><h2>Loading your checkout...</h2></div>
        </main>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="storefront-page">
        <StorefrontHeader />
        <main className="store-page-shell checkout-page">
          {accountChoicePanel}
          <div className="store-empty-state">
            <span>Your cart is empty</span>
            <h2>Add products before starting checkout.</h2>
            <Link to="/search" className="store-primary-button">Browse products</Link>
          </div>
        </main>
      </div>
    );
  }

  const shippingAmount = quote?.shipping?.amount;
  const quoteHasUnavailableItems = Boolean(quote?.cart?.has_unavailable_items);
  const checkoutHasUnavailableItems = hasUnavailableItems || quoteHasUnavailableItems;
  const quoteCanCheckout = Boolean(quote?.can_checkout) && !checkoutHasUnavailableItems;

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell checkout-page">
        <nav className="checkout-steps" aria-label="Checkout progress">
          <Link to="/cart">Cart</Link><span aria-hidden="true">/</span><strong>Delivery</strong><span aria-hidden="true">/</span><span>Payment</span>
        </nav>

        <section className="checkout-heading">
          <div><span className="store-eyebrow">Secure checkout</span><h1>Where should we deliver?</h1><p>Select your UAE delivery area so we can calculate the correct delivery fee.</p></div>
          <Link to="/cart">Back to cart</Link>
        </section>

        {accountChoicePanel}

        <div className="checkout-layout">
          <section className="checkout-details-card">
            <div className="checkout-card-heading"><span>01</span><div><h2>Contact & delivery</h2><p>Your area determines the delivery charge. Add the contact and address details needed for delivery.</p></div></div>

            {checkoutHasUnavailableItems && <div className="store-alert error">Remove unavailable products from your cart before continuing.</div>}
            {quoteError && <div className="store-alert error">{quoteError}</div>}

            <form className="checkout-form" onSubmit={(event) => event.preventDefault()}>
              <label>Full name<input name="full_name" value={form.full_name} onChange={updateField} autoComplete="name" required /></label>
              <label>Email address<input type="email" name="email" value={form.email} onChange={updateField} autoComplete="email" required /></label>
              <label>Phone number<input type="tel" name="phone" value={form.phone} onChange={updateField} autoComplete="tel" placeholder="+971" required /></label>
              <label>Country<input value="United Arab Emirates" readOnly aria-readonly="true" /></label>
              <label className="checkout-field-wide">Emirate / delivery area<select name="emirate_code" value={form.emirate_code} onChange={updateField} required><option value="">Select your delivery area</option>{UAE_AREAS.map((area) => <option key={area.code} value={area.code}>{area.label}</option>)}</select></label>
              <label>City / area<input name="city_area" value={form.city_area} onChange={updateField} autoComplete="address-level2" required /></label>
              <label>Address line 1<input name="address_line_1" value={form.address_line_1} onChange={updateField} autoComplete="address-line1" required /></label>
              <label className="checkout-field-wide"><span>Address line 2 <small>Optional</small></span><input name="address_line_2" value={form.address_line_2} onChange={updateField} autoComplete="address-line2" /></label>
              <label className="checkout-field-wide"><span>Delivery notes <small>Optional</small></span><textarea name="notes" value={form.notes} onChange={updateField} rows="4" placeholder="Access, floor, preferred delivery details..." /></label>
            </form>
          </section>

          <aside className="checkout-summary">
            <div className="checkout-summary-heading"><span>Order summary</span><Link to="/cart">Edit cart</Link></div>
            <div className="checkout-summary-items">
              {items.map((item) => (
                <article key={item.id}>
                  <div className="checkout-summary-image">{item.product.image_url ? <img src={item.product.image_url} alt="" /> : <span>{item.product.name?.charAt(0)}</span>}<strong>{item.quantity}</strong></div>
                  <div><span>{item.product.brand?.name || item.product.category?.name || 'Messara Living'}</span><h3>{item.product.name}</h3></div>
                  <strong>{money(item.line_total)}</strong>
                </article>
              ))}
            </div>

            <div className="checkout-totals">
              <div><span>Subtotal</span><strong>{quote ? money(quote.subtotal) : '—'}</strong></div>
              <div><span>Delivery</span><strong aria-live="polite" className={quote?.shipping?.is_free ? 'is-free' : ''}>{quoteLoading ? 'Calculating...' : !form.emirate_code ? 'Select area' : quote ? (quote.shipping.is_free ? 'Free' : money(shippingAmount)) : 'Unavailable'}</strong></div>
              <div className="checkout-total"><span>Total</span><strong>{quote ? money(quote.total) : '—'}</strong></div>
            </div>

            {quote?.shipping?.paid_shipping_override && <div className="checkout-delivery-note">This cart includes a product that keeps the standard zone delivery charge above the normal free-delivery threshold.</div>}
            {!quote?.shipping?.paid_shipping_override && Number(quote?.shipping?.amount_until_free_shipping) > 0 && <div className="checkout-delivery-note">Add {money(quote.shipping.amount_until_free_shipping)} more in merchandise for free delivery to this area.</div>}
            {quote?.shipping?.is_free && <div className="checkout-delivery-note success">Free delivery unlocked for this area.</div>}

            <button type="button" className="store-primary-button" disabled>{quoteLoading ? 'Calculating delivery...' : checkoutHasUnavailableItems ? 'Unavailable item in cart' : !isAuthenticated ? 'Log in before payment' : quoteCanCheckout ? 'Delivery quote ready' : form.emirate_code ? 'Delivery unavailable' : 'Select a delivery area'}</button>
            <small>{isAuthenticated ? 'Delivery quoting is ready. Order placement and online payment are not connected yet.' : 'You can complete the address and see delivery pricing now. Log in or create an account before payment.'}</small>
          </aside>
        </div>
      </main>
    </div>
  );
}
