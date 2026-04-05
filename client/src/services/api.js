import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export const createFingerprint = (data) => api.post("/fingerprint", data);
export const getFingerprint = (id) => api.get(`/fingerprint/${id}`);
export const searchResources = (fingerprint) => api.post("/resources/search", { fingerprint });
export const localiseResource = (fingerprint, resource) => api.post("/resources/localise", { fingerprint, resource });
export const saveResource = (resource_id, fingerprint_id) => api.post("/resources/save", { resource_id, fingerprint_id });
export const submitPulse = (resource_id, fingerprint_id, rating) => api.post("/pulse", { resource_id, fingerprint_id, rating });
export const importResource = (url, fingerprint, base_coords) => api.post("/import", { url, fingerprint, base_coords });

export default api;
