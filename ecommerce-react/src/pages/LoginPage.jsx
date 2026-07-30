import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { apiValidationErrors, validateLogin } from '../utils/authValidation';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateLogin(form);
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login(form);
      const requestedPath = location.state?.from;
      navigate(requestedPath?.startsWith('/dashboard') ? '/profile' : requestedPath || '/profile', { replace: true });
    } catch (requestError) {
      setFieldErrors(apiValidationErrors(requestError));
      setError(requestError.response?.data?.message || 'Customer sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="auth-experience customer-auth-experience">
        <section className="auth-intro">
          <span className="auth-kicker">Customer account</span>
          <h1>Welcome back to Messara Living.</h1>
          <p>Sign in to keep your favourites, manage your profile, and continue with your selected products.</p>
          <div className="auth-feature-list">
            <span>Save favourite products</span>
            <span>Keep your shopping cart</span>
            <span>Faster checkout details</span>
          </div>
        </section>

        <section className="auth-form-panel" aria-labelledby="customer-login-title">
          <div className="auth-form-heading">
            <span>Customer sign in</span>
            <h2 id="customer-login-title">Access your account</h2>
            <p>Administrator accounts must use the separate admin portal.</p>
          </div>

          {error && <div className="auth-form-alert">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <AuthField label="Email address" error={fieldErrors.email}>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                maxLength="255"
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </AuthField>
            <AuthField label="Password" error={fieldErrors.password}>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                minLength="8"
                maxLength="255"
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.password)}
              />
            </AuthField>

            <div className="auth-form-links">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button className="auth-submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in as customer'}
            </button>
          </form>

          <p className="auth-switch-link">New customer? <Link to="/register" state={location.state}>Create an account</Link></p>
          <div className="auth-admin-route">Messara staff? <Link to="/admin/login">Open administrator portal</Link></div>
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
