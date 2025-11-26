import React, { useState } from 'react';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';

const TenantSelection = () => {
    const { tenants, switchTenant, createTenant } = useTenant();
    const { logout } = useAuth();
    const [newTenantName, setNewTenantName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newTenantName.trim()) return;
        try {
            await createTenant(newTenantName);
            setNewTenantName('');
            setIsCreating(false);
        } catch (error) {
            alert('Failed to create tenant');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h2 className="text-2xl font-bold mb-6 text-center">Select Organization</h2>

                {tenants.length > 0 ? (
                    <div className="space-y-4 mb-6">
                        {tenants.map(tenant => (
                            <button
                                key={tenant.id}
                                onClick={() => switchTenant(tenant.id)}
                                className="w-full p-4 text-left border rounded hover:bg-gray-50 transition flex justify-between items-center"
                            >
                                <span className="font-medium">{tenant.name}</span>
                                <span className="text-sm text-gray-500">{tenant.role}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center mb-6">You don't belong to any organizations yet.</p>
                )}

                {isCreating ? (
                    <form onSubmit={handleCreate} className="mb-4">
                        <input
                            type="text"
                            placeholder="Organization Name"
                            className="w-full p-2 border rounded mb-2"
                            value={newTenantName}
                            onChange={(e) => setNewTenantName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="flex-1 bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full py-2 text-blue-600 hover:text-blue-800 font-medium mb-4"
                    >
                        + Create New Organization
                    </button>
                )}

                <button
                    onClick={logout}
                    className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                    Logout
                </button>
            </div>
        </div>
    );
};

export default TenantSelection;
