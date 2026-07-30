import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateProfile } from '../api/client';
import StorefrontHeader from '../components/StorefrontHeader';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { cartCount, favoriteCount } = useStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', current_password: '', password: '', password_confirmation: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((current) => ({ ...current, name: user?.name || '', email: user?.email || '', phone: user?.phone || '' }));
  }, [user]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function signOut() {
    await logout();
    navigate('/', { replace: true });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setMessage(''); setError('');
    try {
      const data = await updateProfile(form);
      updateUser(data.user);
      setForm((current) => ({ ...current, current_password: '', password: '', password_confirmation: '' }));
      setMessage(data.message);
    } catch (requestError) {
      const validationErrors = requestError.response?.data?.errors;
      setError(validationErrors ? Object.values(validationErrors).flat()[0] : requestError.response?.data?.message || 'Unable to update profile.');
    } finally { setSaving(false); }
  }

  return (
    <div className="storefront-page">
      <StorefrontHeader />
      <main className="store-page-shell account-page">
        <section className="account-heading">
          <div className="account-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'M'}</div>
          <div>
            <span className="store-eyebrow">My account</span>
            <h1>Welcome back, {user?.name?.split(' ')[0]}.</h1>
            <p>Manage your details and move quickly between the products you saved and selected.</p>
          </div>
          <button type="button" className="account-logout-button" onClick={signOut}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9" />
            </svg>
            Sign out
          </button>
        </section>
        <section className="account-stat-grid">
          <Link to="/cart"><strong>{cartCount}</strong><span>Items in cart</span><small>Review cart →</small></Link>
          <Link to="/favourites"><strong>{favoriteCount}</strong><span>Saved favourites</span><small>View collection →</small></Link>
          {['admin', 'super_admin'].includes(user?.role) && user?.admin_status === 'approved' && (
            <Link to="/dashboard/overview"><strong>Admin</strong><span>Store dashboard</span><small>Open dashboard →</small></Link>
          )}
        </section>
        <form className="profile-form" onSubmit={submit}>
          <div className="profile-form-heading"><div><span>Account details</span><h2>Profile & security</h2></div><p>Leave the password fields blank if you only want to update your name or email.</p></div>
          {message && <div className="store-alert success">{message}</div>}
          {error && <div className="store-alert error">{error}</div>}
          <div className="profile-form-grid">
            <label>Full name<input name="name" value={form.name} onChange={updateField} minLength="2" maxLength="100" required /></label>
            <label>Email address<input type="email" name="email" value={form.email} onChange={updateField} maxLength="255" required /></label>
            <label>Telephone number<input type="tel" name="phone" value={form.phone} onChange={updateField} maxLength="30" /></label>
            <label>Current password<input type="password" name="current_password" value={form.current_password} onChange={updateField} autoComplete="current-password" /></label>
            <label>New password<input type="password" name="password" value={form.password} onChange={updateField} minLength="8" autoComplete="new-password" /></label>
            <label className="profile-confirm-field">Confirm new password<input type="password" name="password_confirmation" value={form.password_confirmation} onChange={updateField} minLength="8" autoComplete="new-password" /></label>
          </div>
          <button type="submit" className="store-primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </main>
    </div>
  );
}
