import { useState } from 'react';
import { forgotPassword } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      const data = await forgotPassword({ email });
      setMessage(data.message || 'Password reset link sent.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send reset link.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <section className="auth-page">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <form onSubmit={handleSubmit} className="d-grid gap-3">
          <label>
            Account email
            <input
              className="form-control"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {message && <p className="success-text mb-0">{message}</p>}
          {error && <p className="error-text mb-0">{error}</p>}
          <button className="btn btn-dark" type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      </div>
      </section>
    </div>
  );
}
