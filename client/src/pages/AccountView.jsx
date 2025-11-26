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
        categoryId: '',
        customerId: null,
        splits: [] // { chartOfAccountId, amount }
    });
    const [categoryInput, setCategoryInput] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState('Expense');
    const [chartOfAccounts, setChartOfAccounts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [payeeInput, setPayeeInput] = useState('');
    const [showPayeeDropdown, setShowPayeeDropdown] = useState(false);
    const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({ name: '', isBusiness: false, firstName: '', lastName: '' });

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

                // Set default category if available
                if (coaRes.data.length > 0) {
                    setFormData(prev => ({ ...prev, categoryId: coaRes.data[0].id }));
                    setCategoryInput(coaRes.data[0].name);
                }
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

    // --- Category Logic ---
    const handleCategoryInputChange = (e) => {
        const value = e.target.value;
        setCategoryInput(value);
        setShowCategoryDropdown(true);

        // Check if matches existing exactly
        const match = chartOfAccounts.find(c => c.name.toLowerCase() === value.toLowerCase());
        if (match) {
            setFormData(prev => ({ ...prev, categoryId: match.id }));
        } else {
            setFormData(prev => ({ ...prev, categoryId: '' }));
        }
    };

    const selectCategory = (cat) => {
        setCategoryInput(cat.name);
        setFormData(prev => ({ ...prev, categoryId: cat.id }));
        setShowCategoryDropdown(false);
    };

    const initiateCreateCategory = () => {
        setNewCategoryName(categoryInput);
        // Default type based on transaction type
        setNewCategoryType(formData.type === 'Deposit' ? 'Income' : 'Expense');
        setShowCreateCategoryModal(true);
        setShowCategoryDropdown(false);
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/chart-of-accounts', { name: newCategoryName, type: newCategoryType });
            const newCat = res.data;
            setChartOfAccounts([...chartOfAccounts, newCat]);
            selectCategory(newCat);
            setShowCreateCategoryModal(false);
        } catch (error) {
            console.error("Error creating category:", error);
            alert("Failed to create category");
        }
    };

    // --- Payee/Customer Logic ---
    const handlePayeeInputChange = (e) => {
        const value = e.target.value;
        setPayeeInput(value);
        setFormData(prev => ({ ...prev, payee: value })); // Also update payee text
        setShowPayeeDropdown(true);

        const match = customers.find(c => c.name.toLowerCase() === value.toLowerCase());
        if (match) {
            setFormData(prev => ({ ...prev, customerId: match.id }));
        } else {
            setFormData(prev => ({ ...prev, customerId: null }));
        }
    };

    const selectCustomer = (cust) => {
        setPayeeInput(cust.name);
        setFormData(prev => ({ ...prev, payee: cust.name, customerId: cust.id }));
        setShowPayeeDropdown(false);
    };

    const initiateCreateCustomer = () => {
        // Guess if it's a business or person based on spaces? Or just default to Business for quick add.
        // Let's default to Business for simplicity in quick add, or show modal.
        // User asked: "If you specify a customer that doesn't exist, you can create the customer there."
        setNewCustomerData({ name: payeeInput, isBusiness: true, firstName: '', lastName: '' });
        setShowCreateCustomerModal(true);
        setShowPayeeDropdown(false);
    };

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...newCustomerData };
            if (payload.isBusiness) {
                payload.firstName = '';
                payload.lastName = '';
            } else {
                payload.name = '';
            }
            const res = await api.post('/customers', payload);
            const newCust = res.data;
            setCustomers([...customers, newCust]);
            selectCustomer(newCust);
            setShowCreateCustomerModal(false);
        } catch (error) {
            console.error("Error creating customer:", error);
            alert("Failed to create customer");
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.categoryId) {
            alert("Please select or create a valid category.");
            return;
        }

        try {
            // Simple single category for now, splits logic to be added in modal
            const payload = {
                ...formData,
                accountId: id,
                splits: [{ chartOfAccountId: formData.categoryId, amount: formData.amount }]
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

            // Reset form
            const defaultCat = chartOfAccounts.length > 0 ? chartOfAccounts[0] : null;
            setFormData({
                date: format(new Date(), 'yyyy-MM-dd'),
                payee: '',
                description: '',
                amount: '',
                type: 'Payment',
                categoryId: defaultCat ? defaultCat.id : '',
                customerId: null,
                splits: []
            });
            setCategoryInput(defaultCat ? defaultCat.name : '');
            setPayeeInput('');

        } catch (error) {
            console.error('Error saving transaction:', error);
        }
    };

    const handleEditClick = (tx) => {
        setEditingTransaction(tx);
        const catId = tx.splits[0]?.chartOfAccountId;
        const cat = chartOfAccounts.find(c => c.id === catId);

        setFormData({
            date: format(new Date(tx.date), 'yyyy-MM-dd'),
            payee: tx.payee,
            description: tx.description || '',
            amount: tx.amount,
            type: tx.type,
            categoryId: catId || '',
            customerId: tx.customerId || null,
            splits: tx.splits
        });
        setCategoryInput(cat ? cat.name : '');
        setPayeeInput(tx.payee);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingTransaction(null);
        const defaultCat = chartOfAccounts.length > 0 ? chartOfAccounts[0] : null;
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            payee: '',
            description: '',
            amount: '',
            type: 'Payment',
            categoryId: defaultCat ? defaultCat.id : '',
            customerId: null,
            splits: []
        });
        setCategoryInput(defaultCat ? defaultCat.name : '');
        setPayeeInput('');
    };

    // Filter categories for dropdown
    const filteredCategories = chartOfAccounts.filter(c =>
        c.name.toLowerCase().includes(categoryInput.toLowerCase())
    );

    // Filter customers
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(payeeInput.toLowerCase())
    );

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
                        const defaultCat = chartOfAccounts.length > 0 ? chartOfAccounts[0] : null;
                        setFormData({
                            date: format(new Date(), 'yyyy-MM-dd'),
                            payee: '',
                            description: '',
                            amount: '',
                            type: 'Payment',
                            categoryId: defaultCat ? defaultCat.id : '',
                            customerId: null,
                            splits: []
                        });
                        setCategoryInput(defaultCat ? defaultCat.name : '');
                        setPayeeInput('');
                        setShowForm(!showForm);
                    }}>
                        <Plus className="w-4 h-4 mr-2" /> Add Transaction
                    </button>
                </div>
            </div>

            {/* Quick Add Form */}
            {showForm && (
                <div className="card mb-6 bg-gray-50 border-green-200 relative">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="input-field" required />
                        </div>
                        <div className="md:col-span-2 relative">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Payee / Customer</label>
                            <input
                                type="text"
                                value={payeeInput}
                                onChange={handlePayeeInputChange}
                                onFocus={() => setShowPayeeDropdown(true)}
                                onBlur={() => setTimeout(() => setShowPayeeDropdown(false), 200)}
                                className="input-field w-full"
                                placeholder="Select or type..."
                                required
                            />
                            {showPayeeDropdown && (
                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto mt-1">
                                    {filteredCustomers.map(cust => (
                                        <div
                                            key={cust.id}
                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                            onClick={() => selectCustomer(cust)}
                                        >
                                            {cust.name}
                                        </div>
                                    ))}
                                    {filteredCustomers.length === 0 && payeeInput && (
                                        <div
                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-medium"
                                            onClick={initiateCreateCustomer}
                                        >
                                            + Create "{payeeInput}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="input-field">
                                <option value="Payment">Payment</option>
                                <option value="Deposit">Deposit</option>
                            </select>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                            <input
                                type="text"
                                value={categoryInput}
                                onChange={handleCategoryInputChange}
                                onFocus={() => setShowCategoryDropdown(true)}
                                onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)} // Delay to allow click
                                className="input-field w-full"
                                placeholder="Select or type..."
                                required
                            />
                            {showCategoryDropdown && (
                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto mt-1">
                                    {filteredCategories.map(cat => (
                                        <div
                                            key={cat.id}
                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                            onClick={() => selectCategory(cat)}
                                        >
                                            {cat.name}
                                        </div>
                                    ))}
                                    {filteredCategories.length === 0 && categoryInput && (
                                        <div
                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-medium"
                                            onClick={initiateCreateCategory}
                                        >
                                            + Create "{categoryInput}"
                                        </div>
                                    )}
                                </div>
                            )}
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

            {/* Create Category Modal */}
            {showCreateCategoryModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                        <h2 className="text-lg font-bold mb-4">Create New Category</h2>
                        <form onSubmit={handleCreateCategory} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="input-field w-full"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                    value={newCategoryType}
                                    onChange={(e) => setNewCategoryType(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="Income">Income</option>
                                    <option value="Expense">Expense</option>
                                    <option value="Equity">Equity</option>
                                    <option value="Liability">Liability</option>
                                    <option value="Asset">Asset</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => setShowCreateCategoryModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Customer Modal */}
            {showCreateCustomerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                        <h2 className="text-lg font-bold mb-4">Create New Customer</h2>
                        <form onSubmit={handleCreateCustomer} className="space-y-4">
                            <div className="flex space-x-4 mb-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={!newCustomerData.isBusiness}
                                        onChange={() => setNewCustomerData({ ...newCustomerData, isBusiness: false })}
                                        className="text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Individual</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={newCustomerData.isBusiness}
                                        onChange={() => setNewCustomerData({ ...newCustomerData, isBusiness: true })}
                                        className="text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Business</span>
                                </label>
                            </div>

                            {newCustomerData.isBusiness ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                                    <input
                                        type="text"
                                        value={newCustomerData.name}
                                        onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                        className="input-field w-full"
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                        <input
                                            type="text"
                                            value={newCustomerData.firstName}
                                            onChange={(e) => setNewCustomerData({ ...newCustomerData, firstName: e.target.value })}
                                            className="input-field w-full"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={newCustomerData.lastName}
                                            onChange={(e) => setNewCustomerData({ ...newCustomerData, lastName: e.target.value })}
                                            className="input-field w-full"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => setShowCreateCustomerModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
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
