import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;

        const tenantId = localStorage.getItem('currentTenantId');
        if (tenantId) {
            config.headers['X-Tenant-ID'] = tenantId;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export const restoreTransaction = async (id) => {
    const response = await api.post(`/transactions/${id}/restore`);
    return response.data;
};

export default api;
