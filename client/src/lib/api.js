import axios from 'axios';

/**
 * Pre-configured Axios instance. The JWT is attached from localStorage
 * on every request; 401s clear the session and bounce to /login.
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/** Extract a human-readable message from an Axios error. */
export function errorMessage(err) {
  return err.response?.data?.message || err.message || 'Something went wrong';
}

export default api;
