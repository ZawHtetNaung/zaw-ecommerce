import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormTextarea,
  CRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPen, cilTrash } from '@coreui/icons';
import AppDataTable from '../components/AppDataTable';
import RichTextEditor from '../components/RichTextEditor';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '../api/client';

const initialForm = {
  name: '',
  description: '',
  image_alt_text: '',
  is_active: true,
};

export default function CategoriesPage() {
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function loadCategories() {
    try {
      const data = await fetchCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function onInputChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function onImageChange(event) {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
    event.target.value = '';
  }

  function onDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function startEdit(category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      description: category.description || '',
      image_alt_text: category.image_alt_text || '',
      is_active: category.is_active,
    });
    setImageFile(null);
    setImagePreview('');
    setCurrentImageUrl(category.image_url || '');
    setMessage('');
    setError('');
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setImageFile(null);
    setImagePreview('');
    setCurrentImageUrl('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      let payload = form;
      if (imageFile) {
        const formData = new FormData();
        formData.append('name', form.name);
        formData.append('description', form.description || '');
        formData.append('image_alt_text', form.image_alt_text || '');
        formData.append('is_active', form.is_active ? '1' : '0');
        formData.append('image', imageFile);
        payload = formData;
      }

      if (editingId) {
        await updateCategory(editingId, payload);
        setMessage('Category updated successfully.');
      } else {
        await createCategory(payload);
        setMessage('Category created successfully.');
      }

      resetForm();
      await loadCategories();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save category.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(categoryId) {
    setError('');
    setMessage('');

    try {
      await deleteCategory(categoryId);
      if (editingId === categoryId) {
        resetForm();
      }
      setMessage('Category deleted successfully.');
      await loadCategories();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete category.');
    }
  }

  const columns = useMemo(
    () => [
      { name: 'ID', selector: (row) => row.id, sortable: true, width: '80px' },
      {
        name: 'Image',
        cell: (row) =>
          row.image_url ? <img className="category-thumb" src={row.image_url} alt={row.name} /> : <span>—</span>,
        width: '90px',
      },
      { name: 'Name', selector: (row) => row.name, sortable: true },
      { name: 'Slug', selector: (row) => row.slug, sortable: true },
      { name: 'Status', selector: (row) => (row.is_active ? 'Active' : 'Inactive'), sortable: true },
      {
        name: 'Actions',
        cell: (row) => (
          <div className="d-flex gap-2">
            <CButton color="info" variant="outline" size="sm" title="Edit" onClick={() => startEdit(row)}>
              <CIcon icon={cilPen} />
            </CButton>
            <CButton color="danger" variant="outline" size="sm" title="Delete" onClick={() => onDelete(row.id)}>
              <CIcon icon={cilTrash} />
            </CButton>
          </div>
        ),
      },
    ],
    [editingId]
  );

  return (
    <CRow>
      <CCol lg={4}>
        <CCard className="mb-4">
          <CCardHeader>{editingId ? 'Edit Category' : 'Create Category'}</CCardHeader>
          <CCardBody>
            <CForm onSubmit={onSubmit}>
              <div className="mb-3">
                <CFormInput
                  label="Name"
                  name="name"
                  value={form.name}
                  onChange={onInputChange}
                  required
                />
              </div>
              <div className="mb-3">
                <RichTextEditor label="Description" value={form.description} onChange={(description) => setForm((prev) => ({ ...prev, description }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Image (Single)</label>
                <div
                  className={`drop-zone ${isDragOver ? 'drop-zone-active' : ''} ${(imagePreview || currentImageUrl) ? 'drop-zone-has-image' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  {imagePreview || currentImageUrl ? (
                    <img className="drop-zone-image" src={imagePreview || currentImageUrl} alt="Category" />
                  ) : (
                    <>
                      <p className="mb-1">Drag and drop one image here</p>
                      <small className="text-body-secondary">or click to choose</small>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={onImageChange} />
                <CFormInput className="mt-2" label="Image Alt Text" name="image_alt_text" value={form.image_alt_text} onChange={onInputChange} />
              </div>
              <div className="mb-3">
                <CFormCheck
                  label="Active"
                  name="is_active"
                  checked={form.is_active}
                  onChange={onInputChange}
                />
              </div>
              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </CButton>
                {editingId && (
                  <CButton type="button" color="secondary" variant="outline" onClick={resetForm}>
                    Cancel
                  </CButton>
                )}
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={8}>
        <CCard className="mb-4">
          <CCardHeader>Categories</CCardHeader>
          <CCardBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {message && <CAlert color="success">{message}</CAlert>}
            <AppDataTable columns={columns} data={categories} progressPending={loading} />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
}
