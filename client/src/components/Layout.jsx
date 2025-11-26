import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Users, PieChart, FileText, Plus, LogOut, Building, Settings } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const { currentTenant, switchTenant } = useTenant();
    const { logout } = useAuth();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: CreditCard, label: 'Banking', path: '/banking' },
        { icon: Users, label: 'Customers', path: '/customers' },
        { icon: PieChart, label: 'Expenses', path: '/expenses' },
        { icon: FileText, label: 'Reports', path: '/reports' },
        { icon: PieChart, label: 'Categories', path: '/categories' },
        { icon: Settings, label: 'Team', path: '/users' },
    ];

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-green-700">QuickBooks<span className="text-gray-500 text-sm ml-1">Clone</span></h1>
                    {currentTenant && (
                        <div className="mt-2 text-sm text-gray-600 flex items-center">
                            <Building className="w-4 h-4 mr-1" />
                            {currentTenant.name}
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center px-4 py-3 rounded-md transition-colors ${isActive
                                    ? 'bg-green-50 text-green-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200 space-y-2">
                    <button
                        onClick={() => {
                            switchTenant(null); // Or just clear storage and reload
                            localStorage.removeItem('currentTenantId');
                            window.location.reload();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        <Building className="w-4 h-4 mr-2" />
                        Switch Org
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
                    <div className="flex items-center w-96">
                        <input
                            type="text"
                            placeholder="Search transactions, customers..."
                            className="w-full px-4 py-2 bg-gray-100 border-transparent rounded-full focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="flex items-center space-x-4">
                        <button className="btn-primary flex items-center">
                            <Plus className="w-4 h-4 mr-2" />
                            New
                        </button>
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                            JD
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
