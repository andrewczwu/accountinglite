import React, { useEffect, useState } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react';

const Dashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                // In a real app, use env var for API URL
                const response = await api.get('/accounts');
                setAccounts(response.data);
            } catch (error) {
                console.error('Error fetching accounts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAccounts();
    }, []);

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
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Bank Accounts</h2>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link to={`/accounts/${account.id}`} className="text-green-600 hover:text-green-900">View Register</Link>
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
