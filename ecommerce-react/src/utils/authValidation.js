const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,99}$/u;
const PHONE_PATTERN = /^\+?[0-9\s\-()]{7,20}$/;

export function validateLogin(values) {
  const errors = {};
  const email = values.email?.trim() || '';
  const password = values.password || '';

  if (!email) errors.email = 'Email address is required.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8) errors.password = 'Password must contain at least 8 characters.';

  return errors;
}

export function validateCustomerRegistration(values) {
  const errors = validateIdentity(values);
  validateNewPassword(values, errors);

  if (!values.terms_accepted) {
    errors.terms_accepted = 'You must accept the terms and privacy policy.';
  }

  return errors;
}

export function validateAdminRegistration(values) {
  const errors = validateIdentity(values, true);
  const jobTitle = values.job_title?.trim() || '';
  const accessReason = values.access_reason?.trim() || '';

  if (!jobTitle) errors.job_title = 'Job title is required.';
  else if (jobTitle.length < 2 || jobTitle.length > 100) {
    errors.job_title = 'Job title must contain between 2 and 100 characters.';
  }

  if (!accessReason) errors.access_reason = 'Tell the super admin why access is required.';
  else if (accessReason.length < 10 || accessReason.length > 1000) {
    errors.access_reason = 'Access reason must contain between 10 and 1,000 characters.';
  }

  validateNewPassword(values, errors);

  if (!values.terms_accepted) {
    errors.terms_accepted = 'You must accept the terms and privacy policy.';
  }

  return errors;
}

export function apiValidationErrors(requestError) {
  const errors = requestError.response?.data?.errors;
  if (!errors || typeof errors !== 'object') return {};

  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ])
  );
}

function validateIdentity(values, phoneRequired = false) {
  const errors = {};
  const name = values.name?.trim() || '';
  const email = values.email?.trim() || '';
  const phone = values.phone?.trim() || '';

  if (!name) errors.name = 'Full name is required.';
  else if (!NAME_PATTERN.test(name)) {
    errors.name = 'Use 2–100 letters with spaces, apostrophes, periods, or hyphens.';
  }

  if (!email) errors.email = 'Email address is required.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';

  if (!phone && phoneRequired) errors.phone = 'Telephone number is required.';
  else if (phone && !PHONE_PATTERN.test(phone)) errors.phone = 'Enter a valid telephone number.';

  return errors;
}

function validateNewPassword(values, errors) {
  const password = values.password || '';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8) errors.password = 'Password must contain at least 8 characters.';
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Password must contain at least one letter and one number.';
  }

  if (!values.password_confirmation) {
    errors.password_confirmation = 'Please confirm your password.';
  } else if (password !== values.password_confirmation) {
    errors.password_confirmation = 'The passwords do not match.';
  }
}
