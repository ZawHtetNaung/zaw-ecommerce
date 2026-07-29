import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import RichTextEditor from './RichTextEditor';
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
  CFormSwitch,
  CFormTextarea,
  CRow,
} from '@coreui/react';
import {
  createProduct,
  fetchCategories,
  fetchBrands,
  fetchColors,
  fetchMeasurements,
  fetchSizeOptions,
  fetchProduct,
  fetchSubCategories,
  fetchEvents,
  updateProduct,
} from '../api/client';
import { isStandardMeasurementName } from '../utils/productMeasurements';
import { isProductInStock } from '../utils/productStock';

const initialForm = {
  category_id: '',
  sub_category_id: '',
  brand_id: '',
  event_id: '',
  name: '',
  product_type: 'furniture',
  selling_method: 'per_item',
  physical_length: '', physical_width: '', physical_height: '', physical_weight: '', dimension_unit: 'cm', weight_unit: 'kg',
  flooring: { piece_length: '', piece_width: '', thickness: '', coverage_per_box: '', pieces_per_box: '', minimum_order: '', waste_percentage: '10' },
  wallpaper: { roll_width: '', roll_length: '', coverage_per_roll: '', pattern_repeat: '', match_type: 'free' },
  price: '',
  discount_price: '',
  is_in_stock: true,
  requires_paid_shipping: false,
  stock: '1',
  description: '',
  short_description: '',
  seo_title: '',
  seo_description: '',
  faqs: [],
  images: [],
  color_ids: [],
  color_image_mappings: {},
  measurement_ids: [],
  measurement_values: {},
  size_option_ids: [],
  is_active: true,
};

function formatPrice(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
}

function calculateEventDiscount(price, event) {
  if (!event) return null;
  const discount = Number(event.discount_value || 0);
  if (!discount) return null;
  if (event.discount_type === 'percent') {
    return Math.max(0, price - price * (discount / 100));
  }
  if (event.discount_type === 'fixed') {
    return Math.max(0, price - discount);
  }
  return null;
}

export default function ProductForm({ productId = null }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [events, setEvents] = useState([]);
  const [colors, setColors] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [existingImages, setExistingImages] = useState([]);
  const [removeImageIds, setRemoveImageIds] = useState([]);
  const [newImageAltTexts, setNewImageAltTexts] = useState([]);

  const isEdit = Boolean(productId);
  const selectedEvent = events.find((eventItem) => String(eventItem.id) === String(form.event_id));
  const eventHasDiscount = selectedEvent && Number(selectedEvent.discount_value || 0) > 0;

  const newImagePreviews = useMemo(
    () => form.images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [form.images]
  );
  const availableColorImages = useMemo(() => [
    ...existingImages
      .filter((image) => !removeImageIds.includes(image.id))
      .map((image, index) => ({
        value: `existing:${image.id}`,
        label: `Gallery image ${index + 1}${image.alt_text ? ` — ${image.alt_text}` : ''}`,
        url: image.url,
      })),
    ...newImagePreviews.map((item, index) => ({
      value: `new:${index}`,
      label: `New upload ${index + 1} — ${item.file.name}`,
      url: item.url,
    })),
  ], [existingImages, newImagePreviews, removeImageIds]);

  useEffect(() => {
    return () => {
      newImagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [newImagePreviews]);

  useEffect(() => {
    async function loadFormData() {
      try {
        const [categoriesData, subCategoriesData, brandsData, colorsData, measurementsData, sizeOptionsData, eventsData] = await Promise.all([
          fetchCategories(),
          fetchSubCategories(),
          fetchBrands(),
          fetchColors(),
          fetchMeasurements(),
          fetchSizeOptions(),
          fetchEvents(),
        ]);

        const categoryList = Array.isArray(categoriesData) ? categoriesData : [];
        const subCategoryList = Array.isArray(subCategoriesData) ? subCategoriesData : [];
        setCategories(categoryList);
        setSubCategories(subCategoryList);
        setBrands(Array.isArray(brandsData) ? brandsData : []);
        setColors(Array.isArray(colorsData) ? colorsData : []);
        const additionalMeasurements = Array.isArray(measurementsData)
          ? measurementsData.filter((measurement) => !isStandardMeasurementName(measurement.name))
          : [];
        setMeasurements(additionalMeasurements);
        setSizeOptions(Array.isArray(sizeOptionsData) ? sizeOptionsData : []);
        setEvents(Array.isArray(eventsData) ? eventsData : []);

        if (isEdit) {
          const product = await fetchProduct(productId);
          const productIsInStock = isProductInStock(product);
          setForm({
            category_id: String(product.category_id),
            sub_category_id: String(product.sub_category_id || ''),
            brand_id: product.brand_id ? String(product.brand_id) : '',
            event_id: product.event_id ? String(product.event_id) : '',
            name: product.name,
            product_type: product.product_type || 'furniture', selling_method: product.selling_method || 'per_item',
            physical_length: product.physical_length || '', physical_width: product.physical_width || '', physical_height: product.physical_height || '', physical_weight: product.physical_weight || '',
            dimension_unit: product.dimension_unit || 'cm', weight_unit: product.weight_unit || 'kg',
            flooring: { ...initialForm.flooring, ...(product.flooring_detail || {}) },
            wallpaper: { ...initialForm.wallpaper, ...(product.wallpaper_detail || {}) },
            price: String(product.price),
            discount_price: product.discount_price ? String(product.discount_price) : '',
            is_in_stock: productIsInStock,
            requires_paid_shipping: Boolean(product.requires_paid_shipping),
            stock: productIsInStock ? String(Math.max(1, Number(product.stock) || 1)) : '0',
            description: product.description || '',
            short_description: product.short_description || '',
            seo_title: product.seo_title || '',
            seo_description: product.seo_description || '',
            faqs: Array.isArray(product.faqs) ? product.faqs.map((faq) => ({ question: faq.question || '', answer: faq.answer || '' })) : [],
            images: [],
            color_ids: Array.isArray(product.colors) ? product.colors.map((color) => String(color.id)) : [],
            color_image_mappings: Array.isArray(product.colors)
              ? Object.fromEntries(product.colors.map((color) => [
                  String(color.id),
                  color.pivot?.product_image_id ? `existing:${color.pivot.product_image_id}` : '',
                ]))
              : {},
            measurement_ids: Array.isArray(product.measurements)
              ? product.measurements
                .filter((measurement) => !isStandardMeasurementName(measurement.name))
                .map((measurement) => String(measurement.id))
              : [],
            measurement_values: Array.isArray(product.measurements) ? Object.fromEntries(
              product.measurements
                .filter((measurement) => !isStandardMeasurementName(measurement.name))
                .map((measurement) => [String(measurement.id), {
                  value: measurement.pivot?.value ?? measurement.value ?? '',
                  unit: measurement.pivot?.unit ?? measurement.unit ?? '',
                }])
            ) : {},
            size_option_ids: Array.isArray(product.size_options) ? product.size_options.map((option) => String(option.id)) : [],
            is_active: product.is_active,
          });
          setExistingImages(Array.isArray(product.images) ? product.images : []);
        } else if (categoryList.length > 0) {
          const defaultCategoryId = String(categoryList[0].id);
          const defaultSubCategory = subCategoryList.find(
            (subCategory) => String(subCategory.category_id) === defaultCategoryId
          );
          setForm((prev) => ({
            ...prev,
            category_id: defaultCategoryId,
            sub_category_id: defaultSubCategory ? String(defaultSubCategory.id) : '',
          }));
        }
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load product form data.');
      } finally {
        setLoading(false);
      }
    }

    loadFormData();
  }, [isEdit, productId]);

  function onInputChange(event) {
    const { name, value, type, checked, options } = event.target;

    setForm((prev) => {
      if (name === 'color_ids' || name === 'measurement_ids') {
        const selectedValues = Array.from(options)
          .filter((option) => option.selected)
          .map((option) => option.value);

        return {
          ...prev,
          [name]: selectedValues,
        };
      }

      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
      if (name === 'is_in_stock') {
        next.stock = checked ? String(Math.max(1, Number(prev.stock) || 1)) : '0';
      }

      if (name === 'stock') {
        next.stock = value === '' ? '' : String(Math.max(1, Math.floor(Number(value) || 1)));
      }
      if (name === 'product_type') {
        next.selling_method = value === 'flooring' ? 'unspecified' : value === 'wallpaper' ? 'per_roll' : 'per_item';
      }

      if (name === 'event_id') {
        next.discount_price = '';
      }

      if (name === 'category_id') {
        const firstSubCategory = subCategories.find((subCategory) => String(subCategory.category_id) === value);
        next.sub_category_id = firstSubCategory ? String(firstSubCategory.id) : '';
      }

      return next;
    });
  }

  function addImages(files) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      return;
    }

    setForm((prev) => ({ ...prev, images: [...prev.images, ...imageFiles].slice(0, 8) }));
    setNewImageAltTexts((prev) => [...prev, ...imageFiles.map(() => '')].slice(0, 8));
  }

  function onImageInputChange(event) {
    addImages(Array.from(event.target.files || []));
    event.target.value = '';
  }

  function onDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    addImages(Array.from(event.dataTransfer.files || []));
  }

  function removeNewImage(indexToRemove) {
    setForm((prev) => {
      const colorImageMappings = Object.fromEntries(
        Object.entries(prev.color_image_mappings).map(([colorId, mapping]) => {
          const match = String(mapping).match(/^new:(\d+)$/);
          if (!match) return [colorId, mapping];
          const imageIndex = Number(match[1]);
          if (imageIndex === indexToRemove) return [colorId, ''];
          return [colorId, imageIndex > indexToRemove ? `new:${imageIndex - 1}` : mapping];
        })
      );

      return {
        ...prev,
        images: prev.images.filter((_, index) => index !== indexToRemove),
        color_image_mappings: colorImageMappings,
      };
    });
    setNewImageAltTexts((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  function toggleExistingImage(imageId) {
    const isBeingRemoved = !removeImageIds.includes(imageId);
    setRemoveImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
    if (isBeingRemoved) {
      setForm((prev) => ({
        ...prev,
        color_image_mappings: Object.fromEntries(
          Object.entries(prev.color_image_mappings).map(([colorId, mapping]) => [
            colorId,
            mapping === `existing:${imageId}` ? '' : mapping,
          ])
        ),
      }));
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload = new FormData();
    payload.append('category_id', String(Number(form.category_id)));
    payload.append('sub_category_id', String(Number(form.sub_category_id)));
    payload.append('brand_id', form.brand_id ? String(Number(form.brand_id)) : '');
    payload.append('name', form.name);
    payload.append('product_type', form.product_type);
    payload.append('selling_method', form.selling_method);
    ['physical_length', 'physical_width', 'physical_height', 'physical_weight', 'dimension_unit', 'weight_unit'].forEach((field) => payload.append(field, form[field] || ''));
    if (form.product_type === 'flooring') Object.entries(form.flooring).forEach(([field, value]) => payload.append(`flooring[${field}]`, value ?? ''));
    if (form.product_type === 'wallpaper') Object.entries(form.wallpaper).forEach(([field, value]) => payload.append(`wallpaper[${field}]`, value ?? ''));
    payload.append('price', String(Number(form.price)));
    if (form.event_id) {
      payload.append('event_id', String(Number(form.event_id)));
    }
    if (form.discount_price && !form.event_id) {
      payload.append('discount_price', String(Number(form.discount_price)));
    }
    const normalizedStock = form.is_in_stock ? Math.max(1, Math.floor(Number(form.stock) || 1)) : 0;
    payload.append('is_in_stock', form.is_in_stock ? '1' : '0');
    payload.append('requires_paid_shipping', form.requires_paid_shipping ? '1' : '0');
    payload.append('stock', String(normalizedStock));
    payload.append('description', form.description || '');
    payload.append('short_description', form.short_description || '');
    payload.append('seo_title', form.seo_title || '');
    payload.append('seo_description', form.seo_description || '');
    payload.append('is_active', form.is_active ? '1' : '0');
    form.images.forEach((file) => payload.append('images[]', file));
    newImageAltTexts.forEach((altText) => payload.append('image_alt_texts[]', altText));
    existingImages.forEach((image) => payload.append(`existing_image_alt_texts[${image.id}]`, image.alt_text || ''));
    form.faqs.forEach((faq, index) => {
      if (faq.question.trim() && faq.answer.trim()) {
        payload.append(`faqs[${index}][question]`, faq.question.trim());
        payload.append(`faqs[${index}][answer]`, faq.answer.trim());
      }
    });
    form.color_ids.forEach((id) => payload.append('color_ids[]', id));
    form.color_ids.forEach((id) => {
      const mapping = form.color_image_mappings[id] || '';
      if (mapping.startsWith('existing:')) {
        payload.append(`color_image_ids[${id}]`, mapping.slice('existing:'.length));
      } else if (mapping.startsWith('new:')) {
        payload.append(`color_image_indexes[${id}]`, mapping.slice('new:'.length));
      } else {
        payload.append(`color_image_ids[${id}]`, '');
      }
    });
    form.measurement_ids.forEach((id) => payload.append('measurement_ids[]', id));
    form.measurement_ids.forEach((id) => {
      payload.append(`measurement_values[${id}][value]`, form.measurement_values[id]?.value ?? '');
      payload.append(`measurement_values[${id}][unit]`, form.measurement_values[id]?.unit ?? '');
    });
    form.size_option_ids.forEach((id) => payload.append('size_option_ids[]', id));
    removeImageIds.forEach((id) => payload.append('remove_image_ids[]', String(id)));

    try {
      if (isEdit) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }

      navigate('/dashboard/products/list', {
        state: {
          successMessage: isEdit
            ? `${form.name} updated successfully.`
            : `${form.name} created successfully.`,
        },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <CCard>
      <CCardHeader>{isEdit ? 'Edit Product' : 'Create Product'}</CCardHeader>
      <CCardBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        {message && <CAlert color="success">{message}</CAlert>}
        <CForm onSubmit={onSubmit}>
          <CRow>
            <CCol md={6} className="mb-3">
              <CFormSelect label="Category" name="category_id" value={form.category_id} onChange={onInputChange} required>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormSelect
                label="Sub Category"
                name="sub_category_id"
                value={form.sub_category_id}
                onChange={onInputChange}
                required
              >
                <option value="">Select sub category</option>
                {subCategories
                  .filter((subCategory) => String(subCategory.category_id) === String(form.category_id))
                  .map((subCategory) => (
                    <option key={subCategory.id} value={subCategory.id}>{subCategory.name}</option>
                  ))}
              </CFormSelect>
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormSelect
                label="Brand"
                name="brand_id"
                value={form.brand_id}
                onChange={onInputChange}
              >
                <option value="">Select brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormSelect
                label="Event (optional)"
                name="event_id"
                value={form.event_id}
                onChange={onInputChange}
              >
                <option value="">No event</option>
                {events.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {eventItem.name} {eventItem.is_active ? '(Active)' : '(Inactive)'}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormInput label="Name" name="name" value={form.name} onChange={onInputChange} required />
            </CCol>
            <CCol md={3} className="mb-3"><CFormSelect label="Product Type" name="product_type" value={form.product_type} onChange={onInputChange}><option value="furniture">Furniture</option><option value="flooring">Flooring</option><option value="wallpaper">Wallpaper</option></CFormSelect></CCol>
            <CCol md={3} className="mb-3"><CFormSelect label="Selling Method" name="selling_method" value={form.selling_method} onChange={onInputChange}><option value="unspecified">Needs review</option><option value="per_item">Per item</option><option value="per_square_meter">Per m²</option><option value="per_linear_meter">Per linear metre</option><option value="per_roll">Per roll</option><option value="per_box">Per box</option></CFormSelect></CCol>
            {['length', 'width', 'height'].map((field) => <CCol md={3} className="mb-3" key={field}><CFormInput label={`Shipping ${field}`} name={`physical_${field}`} type="number" min="0" step="0.001" value={form[`physical_${field}`]} onChange={onInputChange} /></CCol>)}
            <CCol md={3} className="mb-3"><CFormSelect label="Dimension Unit" name="dimension_unit" value={form.dimension_unit} onChange={onInputChange}><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></CFormSelect></CCol>
            <CCol md={3} className="mb-3"><CFormInput label="Physical Weight" name="physical_weight" type="number" min="0" step="0.001" value={form.physical_weight} onChange={onInputChange} /></CCol>
            <CCol md={3} className="mb-3"><CFormSelect label="Weight Unit" name="weight_unit" value={form.weight_unit} onChange={onInputChange}><option value="g">g</option><option value="kg">kg</option></CFormSelect></CCol>
            {form.product_type === 'flooring' && <CCol xs={12} className="mb-3"><CCard><CCardHeader>Flooring Settings</CCardHeader><CCardBody><CRow>{[['piece_length','Piece Length (cm)'],['piece_width','Piece Width (cm)'],['thickness','Thickness (cm)'],['coverage_per_box','Coverage per Box (m²)'],['pieces_per_box','Pieces per Box'],['minimum_order','Minimum Order'],['waste_percentage','Waste %']].map(([field,label]) => <CCol md={4} className="mb-3" key={field}><CFormInput label={label} type="number" min="0" step={field === 'pieces_per_box' ? '1' : '0.001'} value={form.flooring[field] ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, flooring: { ...prev.flooring, [field]: event.target.value } }))} /></CCol>)}</CRow></CCardBody></CCard></CCol>}
            {form.product_type === 'wallpaper' && <CCol xs={12} className="mb-3"><CCard><CCardHeader>Wallpaper Settings</CCardHeader><CCardBody><CRow>{[['roll_width','Roll Width (cm)'],['roll_length','Roll Length (cm)'],['coverage_per_roll','Coverage per Roll (m²)'],['pattern_repeat','Pattern Repeat (cm)']].map(([field,label]) => <CCol md={4} className="mb-3" key={field}><CFormInput label={label} type="number" min="0" step="0.001" value={form.wallpaper[field] ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, wallpaper: { ...prev.wallpaper, [field]: event.target.value } }))} /></CCol>)}<CCol md={4}><CFormSelect label="Match Type" value={form.wallpaper.match_type || 'free'} onChange={(event) => setForm((prev) => ({ ...prev, wallpaper: { ...prev.wallpaper, match_type: event.target.value } }))}><option value="free">Free match</option><option value="straight">Straight match</option><option value="drop">Drop match</option><option value="reverse">Reverse hang</option></CFormSelect></CCol></CRow></CCardBody></CCard></CCol>}
            <CCol md={6} className="mb-3">
              <CFormInput label="Price" name="price" type="number" min="0" step="0.01" value={form.price} onChange={onInputChange} required />
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormInput
                label="Discount Price (manual)"
                name="discount_price"
                type="number"
                min="0"
                step="0.01"
                value={form.discount_price}
                onChange={onInputChange}
                disabled={Boolean(form.event_id)}
                placeholder={form.event_id ? 'Disabled when event is selected' : ''}
              />
            </CCol>
            <CCol md={3} className="mb-3">
              <label className="form-label d-block">Stock Availability</label>
              <CFormSwitch
                label={form.is_in_stock ? 'In stock' : 'Out of stock'}
                name="is_in_stock"
                checked={form.is_in_stock}
                onChange={onInputChange}
              />
            </CCol>
            <CCol md={3} className="mb-3">
              <CFormInput
                label="Stock Quantity"
                name="stock"
                type="number"
                min="1"
                step="1"
                value={form.stock}
                onChange={onInputChange}
                disabled={!form.is_in_stock}
                required={form.is_in_stock}
                text={form.is_in_stock ? 'At least one item is required.' : 'Quantity is set to zero while stock is off.'}
              />
            </CCol>
            <CCol md={6} className="mb-3">
              <label className="form-label d-block">Delivery Policy</label>
              <CFormSwitch
                label="Always charge zone delivery fee"
                name="requires_paid_shipping"
                checked={form.requires_paid_shipping}
                onChange={onInputChange}
              />
              <div className="form-text">
                Keeps the zone fee above free-delivery thresholds. Special Collection products use this automatically, including products whose main category is different.
              </div>
            </CCol>
            <CCol md={6} className="mb-3">
              <label className="form-label">Colors (multiple)</label>
              <Select
                isMulti
                options={colors.map((color) => ({ value: String(color.id), label: color.name }))}
                value={form.color_ids.map((id) => {
                  const color = colors.find((item) => String(item.id) === String(id));
                  return color ? { value: String(color.id), label: color.name } : null;
                }).filter(Boolean)}
                onChange={(selected) => {
                  const selectedIds = selected ? selected.map((item) => item.value) : [];
                  setForm((prev) => ({
                    ...prev,
                    color_ids: selectedIds,
                    color_image_mappings: Object.fromEntries(
                      selectedIds.map((id) => [id, prev.color_image_mappings[id] || ''])
                    ),
                  }));
                }}
                classNamePrefix="select"
              />
            </CCol>
            <CCol md={6} className="mb-3">
              <label className="form-label">Additional measurements (multiple)</label>
              <Select
                isMulti
                options={measurements.map((measurement) => ({
                  value: String(measurement.id),
                  label: `${measurement.name} ${measurement.value ? `(${measurement.value}${measurement.unit})` : `(${measurement.unit})`}`,
                }))}
                value={form.measurement_ids.map((id) => {
                  const measurement = measurements.find((item) => String(item.id) === String(id));
                  return measurement
                    ? {
                        value: String(measurement.id),
                        label: `${measurement.name} ${measurement.value ? `(${measurement.value}${measurement.unit})` : `(${measurement.unit})`}`,
                      }
                    : null;
                }).filter(Boolean)}
                onChange={(selected) => {
                  const selectedIds = selected ? selected.map((item) => item.value) : [];
                  setForm((prev) => ({
                    ...prev,
                    measurement_ids: selectedIds,
                    measurement_values: Object.fromEntries(selectedIds.map((id) => {
                      const measurement = measurements.find((item) => String(item.id) === id);
                      return [id, prev.measurement_values[id] || { value: measurement?.value || '', unit: measurement?.unit || '' }];
                    })),
                  }));
                }}
                classNamePrefix="select"
              />
              {form.measurement_ids.map((id) => {
                const measurement = measurements.find((item) => String(item.id) === String(id));
                return <div className="d-flex gap-2 align-items-end mt-2" key={`measurement-value-${id}`}>
                  <CFormInput label={`${measurement?.name || 'Measurement'} value`} type="number" min="0" step="0.001" value={form.measurement_values[id]?.value ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, measurement_values: { ...prev.measurement_values, [id]: { ...prev.measurement_values[id], value: event.target.value } } }))} />
                  <CFormInput label="Unit" value={form.measurement_values[id]?.unit ?? measurement?.unit ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, measurement_values: { ...prev.measurement_values, [id]: { ...prev.measurement_values[id], unit: event.target.value } } }))} />
                </div>;
              })}
            </CCol>
            <CCol md={6} className="mb-3">
              <label className="form-label">Size Options (multiple)</label>
              <Select
                isMulti
                options={sizeOptions.map((option) => ({ value: String(option.id), label: option.name }))}
                value={form.size_option_ids.map((id) => {
                  const option = sizeOptions.find((item) => String(item.id) === String(id));
                  return option ? { value: String(option.id), label: option.name } : null;
                }).filter(Boolean)}
                onChange={(selected) => setForm((prev) => ({ ...prev, size_option_ids: selected ? selected.map((item) => item.value) : [] }))}
                classNamePrefix="select"
              />
              <div className="form-text">
                Use the physical or product-type fields above for length, width, height, and weight.
              </div>
            </CCol>
            <CCol md={6} className="mb-3">
              <label className="form-label">Product Images (Multiple)</label>
              <div
                className={`drop-zone ${isDragOver ? 'drop-zone-active' : ''}`}
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
                <p className="mb-1">Drag and drop images here</p>
                <small className="text-body-secondary">or click to choose files (max 8)</small>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="d-none" onChange={onImageInputChange} />
            </CCol>
            <CCol md={6} className="mb-3 d-flex align-items-end">
              <CFormCheck label="Active" name="is_active" checked={form.is_active} onChange={onInputChange} />
            </CCol>
            <CCol xs={12} className="mb-3">
              <RichTextEditor label="Short Description" value={form.short_description} minHeight={120} onChange={(short_description) => setForm((prev) => ({ ...prev, short_description }))} />
            </CCol>
            <CCol xs={12} className="mb-3">
              <RichTextEditor label="Full Description" value={form.description} onChange={(description) => setForm((prev) => ({ ...prev, description }))} />
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormInput label="Meta Title" name="seo_title" maxLength={255} value={form.seo_title} onChange={onInputChange} />
            </CCol>
            <CCol md={6} className="mb-3">
              <CFormTextarea label="Meta Description" name="seo_description" rows={3} maxLength={1000} value={form.seo_description} onChange={onInputChange} />
            </CCol>
            <CCol xs={12} className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label mb-0">Product Questions &amp; Answers</label>
                <CButton type="button" size="sm" variant="outline" onClick={() => setForm((prev) => ({ ...prev, faqs: [...prev.faqs, { question: '', answer: '' }] }))}>Add Q&amp;A</CButton>
              </div>
              {form.faqs.length === 0 && <p className="text-body-secondary small">No questions added.</p>}
              {form.faqs.map((faq, index) => (
                <div className="border rounded p-3 mb-2" key={`faq-${index}`}>
                  <CFormInput
                    className="mb-2"
                    label={`Q${index + 1}`}
                    value={faq.question}
                    onChange={(event) => setForm((prev) => ({ ...prev, faqs: prev.faqs.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item) }))}
                  />
                  <CFormTextarea
                    label={`A${index + 1}`}
                    rows={2}
                    value={faq.answer}
                    onChange={(event) => setForm((prev) => ({ ...prev, faqs: prev.faqs.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item) }))}
                  />
                  <CButton type="button" color="danger" variant="outline" size="sm" className="mt-2" onClick={() => setForm((prev) => ({ ...prev, faqs: prev.faqs.filter((_, itemIndex) => itemIndex !== index) }))}>Remove Q&amp;A</CButton>
                </div>
              ))}
            </CCol>
          </CRow>

          {selectedEvent && (
            <div className="mb-3">
              <CAlert color={selectedEvent.is_active ? 'info' : 'warning'}>
                Event: <strong>{selectedEvent.name}</strong>{' '}
                {eventHasDiscount && (
                  <>
                    — Discount {selectedEvent.discount_type === 'percent' ? `${selectedEvent.discount_value}%` : `AED ${formatPrice(selectedEvent.discount_value)}`}
                  </>
                )}
                {form.price && eventHasDiscount && (
                  <>
                    {' '}| Price: <span className="price-old">AED {formatPrice(form.price)}</span>{' '}
                    <span className="price-discount">
                      AED {formatPrice(calculateEventDiscount(Number(form.price), selectedEvent))}
                    </span>
                  </>
                )}
              </CAlert>
            </div>
          )}

          {isEdit && existingImages.length > 0 && (
            <div className="mb-3">
              <p className="mb-2">Existing Images</p>
              <div className="thumb-grid">
                {existingImages.map((image) => (
                  <div key={image.id} className="thumb-item">
                    <img src={image.url} alt={image.alt_text || form.name} className="product-thumb" />
                    <CFormInput
                      className="mt-2"
                      aria-label="Image alt text"
                      placeholder="Image alt text"
                      value={image.alt_text || ''}
                      onChange={(event) => setExistingImages((items) => items.map((item) => item.id === image.id ? { ...item, alt_text: event.target.value } : item))}
                    />
                    <button
                      type="button"
                      className={`thumb-remove ${removeImageIds.includes(image.id) ? 'thumb-remove-active' : ''}`}
                      onClick={() => toggleExistingImage(image.id)}
                    >
                      {removeImageIds.includes(image.id) ? 'Undo remove' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newImagePreviews.length > 0 && (
            <div className="mb-3">
              <p className="mb-2">New Images</p>
              <div className="thumb-grid">
                {newImagePreviews.map((item, index) => (
                  <div key={`${item.file.name}-${index}`} className="thumb-item">
                    <img src={item.url} alt={item.file.name} className="product-thumb" />
                    <CFormInput
                      className="mt-2"
                      aria-label="Image alt text"
                      placeholder="Image alt text"
                      value={newImageAltTexts[index] || ''}
                      onChange={(event) => setNewImageAltTexts((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    />
                    <button type="button" className="thumb-remove" onClick={() => removeNewImage(index)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.color_ids.length > 0 && (
            <section className="product-color-image-mapping mb-3" aria-labelledby="color-image-mapping-title">
              <div className="product-color-image-mapping-heading">
                <div>
                  <h2 id="color-image-mapping-title">Color button slider images</h2>
                  <p>Connect each storefront color button to one image from this product’s gallery. Images are reused; this does not create duplicate files.</p>
                </div>
                <span>{form.color_ids.filter((id) => form.color_image_mappings[id]).length}/{form.color_ids.length} connected</span>
              </div>

              {availableColorImages.length === 0 && (
                <CAlert color="warning">
                  Upload at least one product image before connecting color buttons.
                </CAlert>
              )}

              <div className="product-color-image-mapping-list">
                {form.color_ids.map((id) => {
                  const color = colors.find((item) => String(item.id) === String(id));
                  const mapping = form.color_image_mappings[id] || '';
                  const mappedImage = availableColorImages.find((image) => image.value === mapping);

                  return (
                    <article className="product-color-image-mapping-row" key={`color-image-${id}`}>
                      <div className="product-color-image-identity">
                        {color?.image_url ? (
                          <img src={color.image_url} alt={color.image_alt_text || color.name} />
                        ) : (
                          <span
                            className="product-color-image-swatch"
                            style={color?.hex_code ? { backgroundColor: color.hex_code } : undefined}
                            aria-hidden="true"
                          />
                        )}
                        <div>
                          <strong>{color?.name || `Color #${id}`}</strong>
                          <small className={mapping ? 'is-connected' : 'is-missing'}>
                            {mapping ? 'Connected to slider' : 'Not connected'}
                          </small>
                        </div>
                      </div>

                      <CFormSelect
                        aria-label={`Slider image for ${color?.name || `color ${id}`}`}
                        value={mapping}
                        onChange={(event) => setForm((prev) => ({
                          ...prev,
                          color_image_mappings: {
                            ...prev.color_image_mappings,
                            [id]: event.target.value,
                          },
                        }))}
                      >
                        <option value="">No slider image</option>
                        {availableColorImages.map((image) => (
                          <option key={image.value} value={image.value}>{image.label}</option>
                        ))}
                      </CFormSelect>

                      <div className="product-color-image-preview">
                        {mappedImage ? (
                          <img src={mappedImage.url} alt="" />
                        ) : (
                          <span>No image selected</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mb-3">
            <CFormCheck label="Active" name="is_active" checked={form.is_active} onChange={onInputChange} />
          </div>

          <div className="d-flex gap-2">
            <CButton type="submit" color="primary" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}</CButton>
            <CButton type="button" color="secondary" variant="outline" onClick={() => navigate('/dashboard/products/list')}>
              Cancel
            </CButton>
          </div>
        </CForm>
      </CCardBody>
    </CCard>
  );
}
