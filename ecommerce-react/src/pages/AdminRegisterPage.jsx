import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiValidationErrors, validateAdminRegistration } from '../utils/authValidation';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  job_title: '',
  access_reason: '',
  password: '',
  password_confirmation: '',
  terms_accepted: false,
};

export default function AdminRegisterPage() {
  const { registerAdmin } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateAdminRegistration(form);
    setFieldErrors(errors);
    setError('');
    setSuccess('');
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const data = await registerAdmin(form);
      setSuccess(data.message);
      setForm(initialForm);
    } catch (requestError) {
      setFieldErrors(apiValidationErrors(requestError));
      setError(requestError.response?.data?.message || 'Unable to submit the administrator request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-page admin-auth-register-page">
      <section className="admin-auth-brand">
        <Link to="/" aria-label="Messara Living website">
          <img src="/messaraliving-logo.png" alt="Messara Living" />
        </Link>
        <span>Controlled staff registration</span>
        <h1>Request administrator access.</h1>
        <p>Submitting this form does not grant dashboard access. The super administrator must review and approve your request first.</p>
        <div className="admin-auth-security">
          <span>Business details required</span>
          <span>No token before approval</span>
          <span>Approval can be revoked</span>
        </div>
      </section>

      <section className="admin-auth-form-wrap">
        <div className="admin-auth-form">
          <div className="auth-form-heading">
            <span>Administrator request</span>
            <h2>Staff account details</h2>
            <p>Use accurate work information so the super administrator can verify your request.</p>
          </div>

          {error && <div className="auth-form-alert">{error}</div>}
          {success && (
            <div className="auth-form-success">
              <strong>Request received</strong>
              <span>{success}</span>
              <Link to="/admin/login">Return to administrator sign in</Link>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} noValidate>
              <div className="admin-auth-form-grid">
                <AuthField label="Full name" error={fieldErrors.name}>
                  <input name="name" value={form.name} onChange={updateField} minLength="2" maxLength="100" autoComplete="name" />
                </AuthField>
                <AuthField label="Work email address" error={fieldErrors.email}>
                  <input name="email" type="email" value={form.email} onChange={updateField} maxLength="255" autoComplete="email" />
                </AuthField>
                <AuthField label="Telephone number" error={fieldErrors.phone}>
                  <input name="phone" type="tel" value={form.phone} onChange={updateField} maxLength="30" autoComplete="tel" placeholder="+971 50 123 4567" />
                </AuthField>
                <AuthField label="Job title" error={fieldErrors.job_title}>
                  <input name="job_title" value={form.job_title} onChange={updateField} minLength="2" maxLength="100" autoComplete="organization-title" />
                </AuthField>
              </div>

              <AuthField label="Why do you require dashboard access?" error={fieldErrors.access_reason}>
                <textarea name="access_reason" value={form.access_reason} onChange={updateField} minLength="10" maxLength="1000" rows="4" />
              </AuthField>

              <div className="admin-auth-form-grid">
                <AuthField label="Password" error={fieldErrors.password}>
                  <input name="password" type="password" value={form.password} onChange={updateField} minLength="8" maxLength="255" autoComplete="new-password" />
                </AuthField>
                <AuthField label="Confirm password" error={fieldErrors.password_confirmation}>
                  <input name="password_confirmation" type="password" value={form.password_confirmation} onChange={updateField} minLength="8" maxLength="255" autoComplete="new-password" />
                </AuthField>
              </div>
              <div className="auth-password-hint">Use at least 8 characters with at least one letter and one number.</div>

              <label className={`auth-consent ${fieldErrors.terms_accepted ? 'has-error' : ''}`}>
                <input type="checkbox" name="terms_accepted" checked={form.terms_accepted} onChange={updateField} />
                <span>I confirm this information is accurate and accept the <a href="https://www.messaraliving.com/privacy-policy-2/" target="_blank" rel="noreferrer">privacy policy</a>.</span>
              </label>
              {fieldErrors.terms_accepted && <small className="auth-consent-error">{fieldErrors.terms_accepted}</small>}

              <button className="auth-submit-button" type="submit" disabled={submitting}>
                {submitting ? 'Submitting request...' : 'Request administrator access'}
              </button>
            </form>
          )}

          <p className="auth-switch-link">Already approved? <Link to="/admin/login">Administrator sign in</Link></p>
          <div className="auth-admin-route">Customer account? <Link to="/register">Customer registration</Link></div>
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
