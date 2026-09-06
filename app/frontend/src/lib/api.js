import axios from "axios";

const BACKEND_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_BACKEND_URL) ||
  "http://localhost:8000";

export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

// Read a File as a base64 data URL
export const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Authentication endpoints
export const registerUser = async (email, password) => {
  const { data } = await api.post("/auth/register", {
    email: email.trim(),
    password: password.trim(),
  });
  return data;
};

export const loginUser = async (email, password) => {
  const { data } = await api.post("/auth/login", {
    email: email.trim(),
    password: password.trim(),
  });
  return data;
};

export const getDevStorageInfo = async () => {
  const { data } = await api.get("/dev/storage");
  return data;
};

export const uploadImage = async (userEmail, dataUrl, title = "") => {
  const { data } = await api.post("/images", {
    user_email: userEmail,
    title,
    data_url: dataUrl,
  });
  return data;
};

export const listImages = async (userEmail) => {
  const { data } = await api.get(`/images`, { params: { user_email: userEmail } });
  return data;
};

export const deleteImage = async (userEmail, id) => {
  const { data } = await api.delete(`/images/${id}`, {
    params: { user_email: userEmail },
  });
  return data;
};

export const updateImageTitle = async (userEmail, id, title) => {
  const { data } = await api.patch(`/images/${id}`, null, {
    params: { user_email: userEmail, title },
  });
  return data;
};
