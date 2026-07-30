import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { resetPassword } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function ResetPasswordPage() {
  const query = useQuery();
  const [form, setForm] = useState({
    token: query.get('token') || '',
    email: query.get('email') || '',
    password: '',
    password_confirmation: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      const data = await resetPassword(form);
      setMessage(data.message || 'Password reset successful. You can now login.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <section className="auth-page">
      <div className="auth-card">
        <h1>Reset Password</h1>
        <form onSubmit={handleSubmit} className="d-grid gap-3">
          <label>
            Token
            <input className="form-control" name="token" type="text" value={form.token} onChange={updateField} required />
          </label>
          <label>
            Email
            <input className="form-control" name="email" type="email" value={form.email} onChange={updateField} maxLength="255" autoComplete="email" required />
          </label>
          <label>
            New password
            <input className="form-control" name="password" type="password" value={form.password} onChange={updateField} minLength="8" maxLength="255" autoComplete="new-password" required />
          </label>
          <label>
            Confirm new password
            <input
              className="form-control"
              name="password_confirmation"
              type="password"
              value={form.password_confirmation}
              onChange={updateField}
              minLength="8"
              maxLength="255"
              autoComplete="new-password"
              required
            />
          </label>
          {message && <p className="success-text mb-0">{message}</p>}
          {error && <p className="error-text mb-0">{error}</p>}
          <button className="btn btn-dark" type="submit" disabled={submitting}>
            {submitting ? 'Updating...' : 'Reset password'}
          </button>
        </form>
      </div>
      </section>
    </div>
  );
}
