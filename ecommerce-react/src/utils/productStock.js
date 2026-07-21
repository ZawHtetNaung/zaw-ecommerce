const STOCK_ON_VALUES = new Set(['1', 'true', 'yes', 'on', 'in_stock', 'instock']);
const STOCK_OFF_VALUES = new Set(['0', 'false', 'no', 'off', 'out_of_stock', 'outofstock']);

export function getProductStockQuantity(product) {
  const quantity = Number(product?.stock);
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

export function isProductInStock(product) {
  const explicitStatus = product?.is_in_stock;

  if (explicitStatus !== undefined && explicitStatus !== null && explicitStatus !== '') {
    if (typeof explicitStatus === 'string') {
      const normalizedStatus = explicitStatus.trim().toLowerCase();
      if (STOCK_ON_VALUES.has(normalizedStatus)) return true;
      if (STOCK_OFF_VALUES.has(normalizedStatus)) return false;
    }

    return Boolean(Number(explicitStatus) || explicitStatus === true);
  }

  return getProductStockQuantity(product) > 0;
}

export function getProductPurchaseLimit(product) {
  if (!isProductInStock(product)) return 0;
  return Math.max(1, getProductStockQuantity(product));
}

export function isCartItemAvailable(item) {
  const explicitAvailability = item?.is_available;

  if (explicitAvailability !== undefined && explicitAvailability !== null && explicitAvailability !== '') {
    return isProductInStock({ is_in_stock: explicitAvailability });
  }

  const purchaseLimit = getProductPurchaseLimit(item?.product);
  const quantity = Number(item?.quantity);
  return purchaseLimit > 0 && Number.isFinite(quantity) && quantity > 0 && quantity <= purchaseLimit;
}
