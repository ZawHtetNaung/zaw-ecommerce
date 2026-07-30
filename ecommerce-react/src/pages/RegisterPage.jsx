import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { apiValidationErrors, validateCustomerRegistration } from '../utils/authValidation';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  terms_accepted: false,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateCustomerRegistration(form);
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register(form);
      navigate(location.state?.from || '/profile', { replace: true });
    } catch (requestError) {
      setFieldErrors(apiValidationErrors(requestError));
      setError(requestError.response?.data?.message || 'Unable to create the customer account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="auth-experience customer-auth-experience">
        <section className="auth-intro">
          <span className="auth-kicker">Customer registration</span>
          <h1>Create your Messara Living account.</h1>
          <p>This account is for shopping, favourites, profile details and checkout. It does not provide dashboard access.</p>
          <div className="auth-feature-list">
            <span>Separate from staff access</span>
            <span>Protected account details</span>
            <span>Simple shopping experience</span>
          </div>
        </section>

        <section className="auth-form-panel" aria-labelledby="customer-register-title">
          <div className="auth-form-heading">
            <span>New customer</span>
            <h2 id="customer-register-title">Create an account</h2>
            <p>All required fields are validated before your account is created.</p>
          </div>

          {error && <div className="auth-form-alert">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <AuthField label="Full name" error={fieldErrors.name}>
              <input name="name" value={form.name} onChange={updateField} minLength="2" maxLength="100" autoComplete="name" />
            </AuthField>
            <AuthField label="Email address" error={fieldErrors.email}>
              <input name="email" type="email" value={form.email} onChange={updateField} maxLength="255" autoComplete="email" />
            </AuthField>
            <AuthField label="Telephone number (optional)" error={fieldErrors.phone}>
              <input name="phone" type="tel" value={form.phone} onChange={updateField} maxLength="30" autoComplete="tel" placeholder="+971 50 123 4567" />
            </AuthField>
            <AuthField label="Password" error={fieldErrors.password}>
              <input name="password" type="password" value={form.password} onChange={updateField} minLength="8" maxLength="255" autoComplete="new-password" />
            </AuthField>
            <div className="auth-password-hint">Use at least 8 characters with at least one letter and one number.</div>
            <AuthField label="Confirm password" error={fieldErrors.password_confirmation}>
              <input name="password_confirmation" type="password" value={form.password_confirmation} onChange={updateField} minLength="8" maxLength="255" autoComplete="new-password" />
            </AuthField>

            <label className={`auth-consent ${fieldErrors.terms_accepted ? 'has-error' : ''}`}>
              <input type="checkbox" name="terms_accepted" checked={form.terms_accepted} onChange={updateField} />
              <span>I agree to the <a href="https://www.messaraliving.com/privacy-policy-2/" target="_blank" rel="noreferrer">privacy policy</a> and account terms.</span>
            </label>
            {fieldErrors.terms_accepted && <small className="auth-consent-error">{fieldErrors.terms_accepted}</small>}

            <button className="auth-submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create customer account'}
            </button>
          </form>

          <p className="auth-switch-link">Already registered? <Link to="/login" state={location.state}>Sign in</Link></p>
          <div className="auth-admin-route">Messara staff? <Link to="/admin/register">Request administrator access</Link></div>
        </section>
      </main>
    </div>
  );
}

function AuthField({ label, error, children }) {
  return (
    <label className={`auth-field ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}
