import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StorefrontHeader from '../components/StorefrontHeader';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate(location.state?.from || '/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <section className="auth-page">
      <div className="auth-card">
        <h1>Login</h1>
        <form onSubmit={handleSubmit} className="d-grid gap-3">
          <label>
            Email
            <input className="form-control" name="email" type="email" value={form.email} onChange={updateField} required />
          </label>
          <label>
            Password
            <input className="form-control" name="password" type="password" value={form.password} onChange={updateField} required />
          </label>
          {error && <p className="error-text mb-0">{error}</p>}
          <button className="btn btn-dark" type="submit" disabled={submitting}>
            {submitting ? 'Checking...' : 'Login'}
          </button>
        </form>
        <p className="mt-3 mb-0">
          New user? <Link to="/register" state={location.state}>Register</Link>
        </p>
        <p className="mb-0">
          Forgot password? <Link to="/forgot-password">Reset here</Link>
        </p>
      </div>
      </section>
    </div>
  );
}
