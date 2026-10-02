import axios from "axios";

const defaultApiUrl =
  process.env.REACT_APP_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "/api");

const API = axios.create({
  baseURL: defaultApiUrl,

  headers: {
    "Content-Type": "application/json",
  },
});

// ========================================
// GẮN JWT TOKEN
// ========================================

API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token");

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);

// ========================================
// XỬ LÝ AUTH ERROR
// ========================================

API.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    if (error.response?.status === 401) {
      console.warn(
        "AUTH ERROR:",
        error.response?.data
      );
    }

    return Promise.reject(error);
  }
);

export default API;