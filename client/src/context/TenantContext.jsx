import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const TenantContext = createContext();

export const useTenant = () => useContext(TenantContext);

export const TenantProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [tenants, setTenants] = useState([]);
    const [currentTenant, setCurrentTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            fetchTenants();
        } else {
            setTenants([]);
            setCurrentTenant(null);
            setLoading(false);
        }
    }, [currentUser]);

    const fetchTenants = async () => {
        try {
            const response = await api.get('/tenants');
            setTenants(response.data);

            // Try to restore selection from localStorage
            const savedTenantId = localStorage.getItem('currentTenantId');
            if (savedTenantId) {
                const savedTenant = response.data.find(t => t.id === parseInt(savedTenantId));
                if (savedTenant) {
                    setCurrentTenant(savedTenant);
                } else if (response.data.length > 0) {
                    // Default to first if saved invalid
                    setCurrentTenant(response.data[0]);
                    localStorage.setItem('currentTenantId', response.data[0].id);
                }
            } else if (response.data.length > 0) {
                setCurrentTenant(response.data[0]);
                localStorage.setItem('currentTenantId', response.data[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch tenants", error);
        } finally {
            setLoading(false);
        }
    };

    const switchTenant = (tenantId) => {
        const tenant = tenants.find(t => t.id === parseInt(tenantId));
        if (tenant) {
            setCurrentTenant(tenant);
            localStorage.setItem('currentTenantId', tenant.id);
            // Ideally reload page or trigger re-fetch of all data
            window.location.reload();
        }
    };

    const createTenant = async (name) => {
        try {
            const response = await api.post('/tenants', { name });
            await fetchTenants(); // Refresh list
            // Switch to new tenant
            switchTenant(response.data.id);
        } catch (error) {
            console.error("Failed to create tenant", error);
            throw error;
        }
    }

    const value = {
        tenants,
        currentTenant,
        switchTenant,
        createTenant,
        loading
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
};
