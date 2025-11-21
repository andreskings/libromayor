const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const defaultHeaders = {
  'Content-Type': 'application/json'
};

export const setToken = (token) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getToken = () => localStorage.getItem('auth_token');

const request = async (path, options = {}) => {
  const token = getToken();
  const headers = { ...defaultHeaders, ...(options.headers || {}) };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.message || 'Error en la solicitud');
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
};

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' })
};

export default api;
