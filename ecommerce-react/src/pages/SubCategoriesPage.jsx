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
  CFormSelect,
  CFormTextarea,
  CRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPen, cilTrash } from '@coreui/icons';
import AppDataTable from '../components/AppDataTable';
import RichTextEditor from '../components/RichTextEditor';
import {
  createSubCategory,
  deleteSubCategory,
  fetchCategories,
  fetchSubCategories,
  updateSubCategory,
} from '../api/client';

const initialForm = {
  category_id: '',
  name: '',
  description: '',
  image: null,
  image_alt_text: '',
  is_active: true,
};

export default function SubCategoriesPage() {
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  async function loadData() {
    try {
      const [categoriesData, subCategoriesData] = await Promise.all([
        fetchCategories(),
        fetchSubCategories(),
      ]);
      const categoryList = Array.isArray(categoriesData) ? categoriesData : [];
      setCategories(categoryList);
      setSubCategories(Array.isArray(subCategoriesData) ? subCategoriesData : []);

      if (!editingId && categoryList.length > 0 && !form.category_id) {
        setForm((prev) => ({ ...prev, category_id: String(categoryList[0].id) }));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load sub categories data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function onInputChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function onDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    setForm((prev) => ({ ...prev, image: file }));
  }

  function onImageInputChange(event) {
    const file = event.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, image: file }));
    event.target.value = '';
  }

  function startEdit(subCategory) {
    setEditingId(subCategory.id);
    setForm({
      category_id: String(subCategory.category_id),
      name: subCategory.name,
      description: subCategory.description || '',
      image: null,
      image_alt_text: subCategory.image_alt_text || '',
      is_active: subCategory.is_active,
    });
    setCurrentImageUrl(subCategory.image_url || '');
    setMessage('');
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setCurrentImageUrl('');
    setForm({
      ...initialForm,
      category_id: categories[0] ? String(categories[0].id) : '',
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload = new FormData();
    payload.append('category_id', String(Number(form.category_id)));
    payload.append('name', form.name);
    payload.append('description', form.description || '');
    payload.append('is_active', form.is_active ? '1' : '0');
    payload.append('image_alt_text', form.image_alt_text || '');
    if (form.image) {
      payload.append('image', form.image);
    }

    try {
      if (editingId) {
        await updateSubCategory(editingId, payload);
        setMessage('Sub category updated successfully.');
      } else {
        await createSubCategory(payload);
        setMessage('Sub category created successfully.');
      }

      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save sub category.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(subCategoryId) {
    setError('');
    setMessage('');

    try {
      await deleteSubCategory(subCategoryId);
      if (editingId === subCategoryId) {
        resetForm();
      }
      setMessage('Sub category deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete sub category.');
    }
  }

  const columns = useMemo(
    () => [
      { name: 'ID', selector: (row) => row.id, sortable: true, width: '80px' },
      {
        name: 'Image',
        cell: (row) => (row.image_url ? <img src={row.image_url} alt={row.name} className="product-thumb" /> : '-'),
      },
      { name: 'Name', selector: (row) => row.name, sortable: true },
      { name: 'Category', selector: (row) => row.category?.name || '-', sortable: true },
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
          <CCardHeader>{editingId ? 'Edit Sub Category' : 'Create Sub Category'}</CCardHeader>
          <CCardBody>
            <CForm onSubmit={onSubmit}>
              <div className="mb-3">
                <CFormSelect
                  label="Category"
                  name="category_id"
                  value={form.category_id}
                  onChange={onInputChange}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </CFormSelect>
              </div>
              <div className="mb-3">
                <CFormInput label="Name" name="name" value={form.name} onChange={onInputChange} required />
              </div>
              <div className="mb-3">
                <RichTextEditor label="Description" value={form.description} onChange={(description) => setForm((prev) => ({ ...prev, description }))} />
              </div>

              <div className="mb-3">
                <label className="form-label">Image (Single)</label>
                <div
                  className={`drop-zone ${isDragOver ? 'drop-zone-active' : ''} ${(form.image || currentImageUrl) ? 'drop-zone-has-image' : ''}`}
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
                  {form.image ? (
                    <img className="drop-zone-image" src={URL.createObjectURL(form.image)} alt="Sub category" />
                  ) : currentImageUrl ? (
                    <img className="drop-zone-image" src={currentImageUrl} alt="Sub category" />
                  ) : (
                    <>
                      <p className="mb-1">Drag and drop one image here</p>
                      <small className="text-body-secondary">or click to choose</small>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="d-none"
                  onChange={onImageInputChange}
                />
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
          <CCardHeader>Sub Categories</CCardHeader>
          <CCardBody>
            {error && <CAlert color="danger">{error}</CAlert>}
            {message && <CAlert color="success">{message}</CAlert>}
            <AppDataTable columns={columns} data={subCategories} progressPending={loading} />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
}
