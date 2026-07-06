const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value);

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return defaultValue;
};

exports.validateEmail = (email) => {
  const normalized = normalizeString(email);
  return typeof normalized === 'string' && EMAIL_REGEX.test(normalized.toLowerCase());
};

exports.validatePassword = (password, minLength = 8) => {
  if (typeof password !== 'string') return false;
  return password.trim().length >= minLength;
};

exports.validateUuid = (value) => {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
};

exports.validatePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
};

exports.sanitizeAccountPayload = (payload = {}) => {
  const login = Number(payload.login);

  return {
    login,
    password: normalizeString(payload.password),
    server: normalizeString(payload.server),
    broker_name: normalizeString(payload.broker_name) || null,
    investor_mode: parseBoolean(payload.investor_mode, true),
    nickname: normalizeString(payload.nickname) || null,
  };
};

exports.parsePagination = (limit, offset, maxLimit = 200, defaultLimit = 50) => {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  const safeLimit = Number.isInteger(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, maxLimit))
    : defaultLimit;

  const safeOffset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  return { limit: safeLimit, offset: safeOffset };
};
