import React, { useEffect, useState } from 'react';
import api from '../api';
import { useParams } from 'react-router-dom';
import { Plus, Filter, Download, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

const AccountView = () => {
    const { id } = useParams();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        payee: '',
        description: '',
        amount: '',
        type: 'Payment', // Payment or Deposit
        splits: [] // { chartOfAccountId, amount }
    });
    const [chartOfAccounts, setChartOfAccounts] = useState([]);
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [txRes, coaRes, custRes] = await Promise.all([
                    api.get(`/accounts/${id}/transactions`),
                    api.get('/chart-of-accounts'),
                    api.get('/customers')
                ]);
                setTransactions(txRes.data);
                setChartOfAccounts(coaRes.data);
                setCustomers(custRes.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Simple single category for now, splits logic to be added in modal
            const payload = {
                ...formData,
                accountId: id,
                splits: [{ chartOfAccountId: chartOfAccounts[0].id, amount: formData.amount }] // Default to first category for quick add
            };

            if (editingTransaction) {
                await api.put(`/transactions/${editingTransaction.id}`, payload);
            } else {
                await api.post('/transactions', payload);
            }

            // Refresh
            const res = await api.get(`/accounts/${id}/transactions`);
            setTransactions(res.data);
            setShowForm(false);
            setEditingTransaction(null);
            setFormData({
                date: format(new Date(), 'yyyy-MM-dd'),
                payee: '',
                description: '',
                amount: '',
                type: 'Payment',
                splits: []
            });
        } catch (error) {
            console.error('Error saving transaction:', error);
        }
    };

    const handleEditClick = (tx) => {
        setEditingTransaction(tx);
        setFormData({
            date: format(new Date(tx.date), 'yyyy-MM-dd'),
            payee: tx.payee,
            description: tx.description || '',
            amount: tx.amount,
            type: tx.type,
            splits: tx.splits
        });
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingTransaction(null);
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            payee: '',
            description: '',
            amount: '',
            type: 'Payment',
            splits: []
        });
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Checking Account</h1>
                <div className="flex space-x-3">
                    <button className="btn-secondary flex items-center">
                        <Filter className="w-4 h-4 mr-2" /> Filter
                    </button>
                    <button className="btn-primary flex items-center" onClick={() => {
                        setEditingTransaction(null);
                        setFormData({
                            date: format(new Date(), 'yyyy-MM-dd'),
                            payee: '',
                            description: '',
                            amount: '',
                            type: 'Payment',
                            splits: []
                        });
                        setShowForm(!showForm);
                    }}>
                        <Plus className="w-4 h-4 mr-2" /> Add Transaction
                    </button>
                </div>
            </div>

            {/* Quick Add Form */}
            {showForm && (
                <div className="card mb-6 bg-gray-50 border-green-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="input-field" required />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Payee</label>
                            <input type="text" name="payee" value={formData.payee} onChange={handleInputChange} className="input-field" placeholder="e.g. Walmart" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="input-field">
                                <option value="Payment">Payment</option>
                                <option value="Deposit">Deposit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                            <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="input-field" placeholder="0.00" step="0.01" required />
                        </div>
                        <div>
                            <button type="submit" className="btn-primary w-full">{editingTransaction ? 'Update' : 'Save'}</button>
                            <button type="button" onClick={handleCancel} className="btn-secondary w-full mt-2">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Register Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee / Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deposit</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((tx, index) => {
                            // Calculate running balance (simplified, ideally backend handles this or we reverse calc)
                            // For now just showing raw amounts
                            return (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {format(new Date(tx.date), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{tx.payee}</div>
                                        <div className="text-xs text-gray-500">{tx.description}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {tx.splits.length > 1 ? 'Split' : tx.splits[0]?.chartOfAccount?.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                        {tx.type === 'Payment' ? `$${tx.amount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                                        {tx.type === 'Deposit' ? `$${tx.amount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        - {/* Running balance needs more complex logic */}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEditClick(tx)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AccountView;
