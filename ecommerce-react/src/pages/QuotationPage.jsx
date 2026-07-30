import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitQuotationRequest } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

const initialForm = {
  customer_name: '',
  email: '',
  phone: '',
  company: '',
  project_type: '',
  emirate: '',
  required_by: '',
  message: '',
};

function money(value) {
  return `AED ${Number(value || 0).toFixed(2)}`;
}

function requestErrorMessage(error) {
  const validationErrors = error.response?.data?.errors;
  if (validationErrors && typeof validationErrors === 'object') {
    const firstError = Object.values(validationErrors).flat().find(Boolean);
    if (firstError) return firstError;
  }
  return error.response?.data?.message || error.message || 'Unable to send your quotation request.';
}

export default function QuotationPage() {
  const { user } = useAuth();
  const {
    quotation,
    changeQuotationQuantity,
    removeFromQuotation,
    clearQuotation,
  } = useStore();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      customer_name: current.customer_name || user.name || '',
      email: current.email || user.email || '',
    }));
  }, [user]);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!quotation.items.length) {
      setError('Add at least one product before sending your request.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await submitQuotationRequest({
        ...form,
        project_type: form.project_type || null,
        emirate: form.emirate || null,
        required_by: form.required_by || null,
        company: form.company || null,
        message: form.message || null,
        items: quotation.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_color_id: item.selected_color?.id || null,
          selected_size_option_id: item.selected_size_option?.id || null,
        })),
      });
      setSuccess({
        reference: response.reference,
        name: form.customer_name,
      });
      clearQuotation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page quotation-page">
      <StorefrontHeader />
      <main className="store-page-shell quotation-shell">
        {success ? (
          <section className="quotation-success" role="status">
            <span className="store-eyebrow">Request received</span>
            <div className="quotation-success-mark" aria-hidden="true">✓</div>
            <h1>Thank you, {success.name}.</h1>
            <p>Our team will review your products and contact you with the best available quotation.</p>
            <div><span>Your reference</span><strong>{success.reference}</strong></div>
            <Link to="/search" className="store-primary-button">Continue shopping</Link>
          </section>
        ) : (
          <>
            <section className="quotation-heading">
              <div>
                <span className="store-eyebrow">Project pricing</span>
                <h1>Request a quotation</h1>
                <p>Add one or more products, tell us about your space, and our team will prepare a personalised quotation.</p>
              </div>
              {quotation.items.length > 0 && (
                <button type="button" onClick={clearQuotation}>Clear quotation</button>
              )}
            </section>

            {quotation.items.length === 0 ? (
              <section className="store-empty-state quotation-empty">
                <h2>Your quotation list is empty.</h2>
                <p>Open a product and select “Add to quotation” to start your request.</p>
                <Link to="/search" className="store-primary-button">Browse products</Link>
              </section>
            ) : (
              <form className="quotation-layout" onSubmit={onSubmit}>
                <section className="quotation-products" aria-labelledby="quotation-products-heading">
                  <div className="quotation-section-heading">
                    <span>{quotation.items.length} selected product{quotation.items.length === 1 ? '' : 's'}</span>
                    <h2 id="quotation-products-heading">Products for your quote</h2>
                  </div>

                  <div className="quotation-item-list">
                    {quotation.items.map((item) => (
                      <article className="quotation-item" key={item.id}>
                        <Link to={`/product/${item.product.slug}`} className="quotation-item-image">
                          {item.product.image_url
                            ? <img src={item.product.image_url} alt={item.product.name} />
                            : <span>{item.product.name.charAt(0)}</span>}
                        </Link>
                        <div className="quotation-item-copy">
                          <span>{item.product.brand?.name || item.product.category?.name || 'Messara Living'}</span>
                          <Link to={`/product/${item.product.slug}`}><h3>{item.product.name}</h3></Link>
                          {(item.selected_color || item.selected_size_option) && (
                            <div className="quotation-item-options">
                              {item.selected_color && <span>Colour: <strong>{item.selected_color.name}</strong></span>}
                              {item.selected_size_option && <span>Size: <strong>{item.selected_size_option.name}</strong></span>}
                            </div>
                          )}
                          <small>Current price reference: {money(item.unit_price)}</small>
                          <button type="button" onClick={() => removeFromQuotation(item.id)}>Remove</button>
                        </div>
                        <div className="quotation-item-quantity">
                          <label htmlFor={`quotation-quantity-${item.id}`}>Quantity</label>
                          <input
                            id={`quotation-quantity-${item.id}`}
                            type="number"
                            min="1"
                            max="9999"
                            value={item.quantity}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (value >= 1) changeQuotationQuantity(item.id, value);
                            }}
                          />
                          <strong>{money(item.line_total)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="quotation-reference-total">
                    <span>Current product total</span>
                    <strong>{money(quotation.total)}</strong>
                    <small>Final pricing, delivery, installation, and availability will be confirmed by our team.</small>
                  </div>
                </section>

                <aside className="quotation-form-card">
                  <div className="quotation-section-heading">
                    <span>Your details</span>
                    <h2>Where should we send the quote?</h2>
                  </div>

                  {error && <div className="store-alert error" role="alert">{error}</div>}

                  <div className="quotation-form-grid">
                    <label>
                      <span>Full name *</span>
                      <input name="customer_name" value={form.customer_name} onChange={onChange} required autoComplete="name" />
                    </label>
                    <label>
                      <span>Email *</span>
                      <input name="email" type="email" value={form.email} onChange={onChange} required autoComplete="email" />
                    </label>
                    <label>
                      <span>Phone / WhatsApp *</span>
                      <input name="phone" type="tel" value={form.phone} onChange={onChange} required autoComplete="tel" placeholder="+971" />
                    </label>
                    <label>
                      <span>Company</span>
                      <input name="company" value={form.company} onChange={onChange} autoComplete="organization" />
                    </label>
                    <label>
                      <span>Project type</span>
                      <select name="project_type" value={form.project_type} onChange={onChange}>
                        <option value="">Select project type</option>
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="hospitality">Hospitality</option>
                        <option value="office">Office</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label>
                      <span>Emirate</span>
                      <select name="emirate" value={form.emirate} onChange={onChange}>
                        <option value="">Select emirate</option>
                        {['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map((emirate) => (
                          <option value={emirate} key={emirate}>{emirate}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Required by</span>
                      <input name="required_by" type="date" value={form.required_by} onChange={onChange} />
                    </label>
                    <label className="quotation-message-field">
                      <span>Project details</span>
                      <textarea
                        name="message"
                        value={form.message}
                        onChange={onChange}
                        rows="5"
                        placeholder="Tell us about the space, measurements, delivery, installation, or anything else we should know."
                      />
                    </label>
                  </div>

                  <button type="submit" className="store-primary-button quotation-submit" disabled={submitting}>
                    {submitting ? 'Sending request...' : 'Send quotation request'}
                  </button>
                  <small className="quotation-privacy-note">Our team will only use these details to prepare and follow up on your quotation.</small>
                </aside>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
