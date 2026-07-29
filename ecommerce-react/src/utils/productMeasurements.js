const STANDARD_MEASUREMENT_NAMES = new Set(['length', 'width', 'height', 'weight']);

export function normalizeMeasurementName(name) {
  return String(name || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');
}

export function isStandardMeasurementName(name) {
  return STANDARD_MEASUREMENT_NAMES.has(normalizeMeasurementName(name));
}

function formatValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

  const text = String(value ?? '').trim();
  if (!text) return '';

  const number = Number(text);
  return Number.isFinite(number) ? String(number) : text;
}

export function buildProductMeasurements(product) {
  if (!product) return [];

  const rows = [];
  const seen = new Set();
  const add = (label, value, unit = '') => {
    const formattedValue = formatValue(value);
    const key = normalizeMeasurementName(label);

    if (!key || !formattedValue || seen.has(key)) return;

    seen.add(key);
    rows.push({
      label,
      value: `${formattedValue}${unit ? ` ${unit}` : ''}`,
    });
  };

  if (product.product_type === 'flooring') {
    const detail = product.flooring_detail || {};
    add('Piece length', detail.piece_length ?? product.physical_length, product.dimension_unit);
    add('Piece width', detail.piece_width ?? product.physical_width, product.dimension_unit);
    add('Thickness', detail.thickness ?? product.physical_height, product.dimension_unit);
    add('Coverage per box', detail.coverage_per_box, 'm²');
    add('Pieces per box', detail.pieces_per_box);
    add('Minimum order', detail.minimum_order, 'm²');
  } else if (product.product_type === 'wallpaper') {
    const detail = product.wallpaper_detail || {};
    add('Roll width', detail.roll_width ?? product.physical_width, product.dimension_unit);
    add('Roll length', detail.roll_length ?? product.physical_length, product.dimension_unit);
    add('Coverage per roll', detail.coverage_per_roll, 'm²');
    add('Pattern repeat', detail.pattern_repeat, product.dimension_unit);
    add('Pattern match', detail.match_type);
  } else {
    add('Length', product.physical_length, product.dimension_unit);
    add('Width', product.physical_width, product.dimension_unit);
    add('Height', product.physical_height, product.dimension_unit);
  }

  add('Weight', product.physical_weight, product.weight_unit);

  (product.measurements || []).forEach((measurement) => {
    if (isStandardMeasurementName(measurement.name)) return;

    add(
      measurement.name,
      measurement.pivot?.value ?? measurement.value,
      measurement.pivot?.unit ?? measurement.unit,
    );
  });

  return rows;
}
