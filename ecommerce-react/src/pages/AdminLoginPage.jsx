import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiValidationErrors, validateLogin } from '../utils/authValidation';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(location.state?.accessMessage || '');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateLogin(form);
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await loginAdmin(form);
      const requestedPath = location.state?.from;
      navigate(requestedPath?.startsWith('/dashboard') ? requestedPath : '/dashboard/overview', { replace: true });
    } catch (requestError) {
      setFieldErrors(apiValidationErrors(requestError));
      setError(requestError.response?.data?.message || 'Administrator sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-brand">
        <Link to="/" aria-label="Messara Living website">
          <img src="/messaraliving-logo.png" alt="Messara Living" />
        </Link>
        <span>Secure administration</span>
        <h1>Manage the Messara Living digital catalogue.</h1>
        <p>This portal is restricted to approved staff accounts. Customer credentials cannot access the dashboard.</p>
        <div className="admin-auth-security">
          <span>Role-protected dashboard APIs</span>
          <span>Super-admin approval required</span>
          <span>Revocable administrator access</span>
        </div>
      </section>

      <section className="admin-auth-form-wrap">
        <div className="admin-auth-form">
          <div className="auth-form-heading">
            <span>Administrator portal</span>
            <h2>Sign in to dashboard</h2>
            <p>Use an approved administrator or super-administrator account.</p>
          </div>

          {error && <div className="auth-form-alert">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <AuthField label="Work email address" error={fieldErrors.email}>
              <input name="email" type="email" value={form.email} onChange={updateField} maxLength="255" autoComplete="username" />
            </AuthField>
            <AuthField label="Password" error={fieldErrors.password}>
              <input name="password" type="password" value={form.password} onChange={updateField} minLength="8" maxLength="255" autoComplete="current-password" />
            </AuthField>

            <div className="auth-form-links">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button className="auth-submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Checking access...' : 'Sign in to administration'}
            </button>
          </form>

          <p className="auth-switch-link">Need staff access? <Link to="/admin/register">Submit an admin request</Link></p>
          <div className="auth-admin-route">Shopping account? <Link to="/login">Customer sign in</Link></div>
        </div>
      </section>
    </main>
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
