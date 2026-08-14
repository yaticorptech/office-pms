const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'office-pms.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Error carrying the HTTP status and any field-level details from the API. */
export class ApiRequestError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }

  /** `{ fieldName: 'message' }` for wiring server validation into form state. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, detail) => {
      if (detail?.field) acc[detail.field] = detail.message;
      return acc;
    }, {});
  }
}

/** Subscribers are notified on 401 so the app can sign the user out once, centrally. */
const unauthorizedHandlers = new Set();
export const onUnauthorized = (handler) => {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
};

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    search.append(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const request = async (method, path, { body, params, signal } = {}) => {
  const token = tokenStore.get();

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(params)}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiRequestError('Cannot reach the server. Check your connection and try again.', {
      status: 0,
    });
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // A 401 on the login call is a wrong password, not an expired session.
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      unauthorizedHandlers.forEach((handler) => handler());
    }
    throw new ApiRequestError(payload?.message || `Request failed (${response.status})`, {
      status: response.status,
      details: payload?.details,
    });
  }

  return payload;
};

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};
