import { useEffect, useState } from 'react';
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CFormCheck, CFormInput, CFormTextarea } from '@coreui/react';
import { fetchSeoSettings, updateRobotsTxt, updateSeoPage } from '../api/client';

export default function SeoPage() {
  const [pages, setPages] = useState([]);
  const [robots, setRobots] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSeoSettings().then((data) => {
      setPages(data.pages || []);
      setRobots(data.robots_txt || '');
    }).catch(() => setError('Unable to load SEO settings.'));
  }, []);

  function changePage(id, field, value) {
    setPages((items) => items.map((page) => page.id === id ? { ...page, [field]: value } : page));
  }

  async function savePage(page) {
    setError('');
    try {
      await updateSeoPage(page.id, { meta_title: page.meta_title || '', meta_description: page.meta_description || '', is_indexable: Boolean(page.is_indexable) });
      setMessage(`${page.name} SEO saved.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save page SEO.');
    }
  }

  async function saveRobots() {
    setError('');
    try {
      await updateRobotsTxt(robots);
      setMessage('robots.txt saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save robots.txt.');
    }
  }

  return <div>
    {message && <CAlert color="success">{message}</CAlert>}
    {error && <CAlert color="danger">{error}</CAlert>}
    <CCard className="mb-4">
      <CCardHeader>Page SEO</CCardHeader>
      <CCardBody>
        <p className="text-body-secondary">Product SEO is edited inside each product. These settings control the other website pages.</p>
        {pages.map((page) => <div key={page.id} className="border rounded p-3 mb-3">
          <h5>{page.name} <small className="text-body-secondary">({page.path})</small></h5>
          <CFormInput className="mb-2" label="Meta Title" maxLength={255} value={page.meta_title || ''} onChange={(event) => changePage(page.id, 'meta_title', event.target.value)} />
          <CFormTextarea className="mb-2" label="Meta Description" rows={3} maxLength={1000} value={page.meta_description || ''} onChange={(event) => changePage(page.id, 'meta_description', event.target.value)} />
          <CFormCheck className="mb-2" label="Allow search engines to index this page" checked={Boolean(page.is_indexable)} onChange={(event) => changePage(page.id, 'is_indexable', event.target.checked)} />
          <CButton size="sm" onClick={() => savePage(page)}>Save {page.name}</CButton>
        </div>)}
      </CCardBody>
    </CCard>
    <CCard>
      <CCardHeader>robots.txt</CCardHeader>
      <CCardBody>
        <CFormTextarea rows={10} value={robots} onChange={(event) => setRobots(event.target.value)} />
        <CButton className="mt-3" onClick={saveRobots}>Save robots.txt</CButton>
      </CCardBody>
    </CCard>
  </div>;
}
