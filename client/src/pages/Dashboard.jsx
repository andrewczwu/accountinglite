import React, { useEffect, useState } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react';

const Dashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newAccount, setNewAccount] = useState({ name: '', type: 'Bank', balance: '' });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounts');
            setAccounts(response.data);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAccount = async (e) => {
        e.preventDefault();
        try {
            await api.post('/accounts', newAccount);
            setNewAccount({ name: '', type: 'Bank', balance: '' });
            setIsAdding(false);
            fetchAccounts();
        } catch (error) {
            console.error('Error adding account:', error);
            alert('Failed to add account');
        }
    };

    const handleDeleteAccount = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete account "${name}"? This action cannot be undone.`)) {
            try {
                await api.delete(`/accounts/${id}`);
                fetchAccounts();
            } catch (error) {
                console.error('Error deleting account:', error);
                alert('Failed to delete account');
            }
        }
    };

    if (loading) return <div>Loading...</div>;

    const totalCash = accounts
        .filter(a => a.type === 'Bank')
        .reduce((sum, a) => sum + a.balance, 0);

    const totalCredit = accounts
        .filter(a => a.type === 'Credit Card')
        .reduce((sum, a) => sum + a.balance, 0);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Summary Cards */}
                <div className="card bg-gradient-to-br from-green-50 to-white border-green-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-green-600">Total Cash</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">${totalCash.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Wallet className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="card bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-blue-600">Credit Card Balance</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">${Math.abs(totalCredit).toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <CreditCard className="w-5 h-5 text-blue-600" /> {/* Imported icon usage */}
                        </div>
                    </div>
                </div>

                <div className="card bg-gradient-to-br from-purple-50 to-white border-purple-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-purple-600">Net Profit (YTD)</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">$12,450.00</h3> {/* Placeholder */}
                        </div>
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Accounts List */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Bank Accounts</h2>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center"
                    >
                        <ArrowUpRight className="w-4 h-4 mr-2" /> Add Account
                    </button>
                </div>

                {isAdding && (
                    <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                        <h3 className="text-md font-semibold mb-4">New Account Details</h3>
                        <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                <input
                                    type="text"
                                    value={newAccount.name}
                                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                    value={newAccount.type}
                                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="Bank">Bank</option>
                                    <option value="Credit Card">Credit Card</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newAccount.balance}
                                    onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {accounts.map((account) => (
                                <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{account.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${account.type === 'Bank' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {account.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                        ${account.balance.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                        <Link to={`/accounts/${account.id}`} className="text-green-600 hover:text-green-900">View Register</Link>
                                        <button
                                            onClick={() => handleDeleteAccount(account.id, account.name)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

function CreditCard({ className }) { // Simple icon component if not imported correctly above, but lucide-react should handle it.
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
    )
}

export default Dashboard;
