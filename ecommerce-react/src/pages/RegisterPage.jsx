import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StorefrontHeader from '../components/StorefrontHeader';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
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
      await register(form);
      navigate(location.state?.from || '/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to register.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <section className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <form onSubmit={handleSubmit} className="d-grid gap-3">
          <label>
            Name
            <input className="form-control" name="name" type="text" value={form.name} onChange={updateField} required />
          </label>
          <label>
            Email
            <input className="form-control" name="email" type="email" value={form.email} onChange={updateField} required />
          </label>
          <label>
            Password
            <input className="form-control" name="password" type="password" value={form.password} onChange={updateField} required />
          </label>
          <label>
            Confirm password
            <input
              className="form-control"
              name="password_confirmation"
              type="password"
              value={form.password_confirmation}
              onChange={updateField}
              required
            />
          </label>
          {error && <p className="error-text mb-0">{error}</p>}
          <button className="btn btn-dark" type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p className="mt-3 mb-0">
          Already have an account? <Link to="/login" state={location.state}>Login</Link>
        </p>
      </div>
      </section>
    </div>
  );
}
