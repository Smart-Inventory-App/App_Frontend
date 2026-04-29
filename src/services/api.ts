import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  // Add auth token here if needed
  return config;
});

api.interceptors.response.use(
  response => response,
  error => Promise.reject(error),
);

export default api;
