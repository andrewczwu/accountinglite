import React, { useEffect, useState } from 'react';
import api, { restoreTransaction } from '../api';
import { useParams } from 'react-router-dom';
import { Plus, Filter, Download, ChevronDown, ChevronUp, Trash2, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableRow = ({ transaction, runningBalance, onEdit, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: transaction.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        position: 'relative',
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-gray-50 transition-colors ${isDragging ? 'bg-gray-100 shadow-md' : ''}`}
        >
            <td className="px-2 py-4 whitespace-nowrap text-gray-400 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                <GripVertical className="w-4 h-4" />
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {format(new Date(transaction.date.replace('Z', '')), 'MMM d, yyyy')}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{transaction.payee}</div>
                <div className="text-xs text-gray-500">{transaction.description}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {transaction.splits.length > 1 ? 'Split' : transaction.splits[0]?.chartOfAccount?.name}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                {transaction.type === 'Payment' ? `$${transaction.amount.toFixed(2)}` : '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                {transaction.type === 'Deposit' ? `$${transaction.amount.toFixed(2)}` : '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                ${runningBalance.toFixed(2)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button onClick={() => onEdit(transaction)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                <button onClick={() => onDelete(transaction.id)} className="text-red-600 hover:text-red-900">
                    <Trash2 className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
};

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
    const [account, setAccount] = useState(null);
    const [payeeInput, setPayeeInput] = useState('');

    const [showPayeeDropdown, setShowPayeeDropdown] = useState(false);
    const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({ name: '', isBusiness: false, firstName: '', lastName: '' });
    const [sortOrder, setSortOrder] = useState('asc'); // Default to 'asc' (Oldest First)

    // Undo State
    const [deletedTransactionId, setDeletedTransactionId] = useState(null);
    const [showUndoToast, setShowUndoToast] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchData = async () => {
        try {
            const [txRes, coaRes, custRes, accRes] = await Promise.all([
                api.get(`/accounts/${id}/transactions`),
                api.get('/chart-of-accounts'),
                api.get('/customers'),
                api.get(`/accounts/${id}`)
            ]);
            setTransactions(txRes.data);
            setChartOfAccounts(coaRes.data);
            setCustomers(custRes.data);
            setAccount(accRes.data);

            // Set default category if available (exclude current account)
            const availableCats = coaRes.data.filter(c => c.id !== parseInt(id));
            if (availableCats.length > 0) {
                setFormData(prev => ({ ...prev, categoryId: availableCats[0].id }));
                setCategoryInput(availableCats[0].name);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
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

        // Check if matches existing exactly (exclude current account)
        const match = chartOfAccounts.find(c => c.name.toLowerCase() === value.toLowerCase() && c.id !== parseInt(id));
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
            fetchData();
            setShowForm(false);
            setEditingTransaction(null);

            // Reset form
            const availableCats = chartOfAccounts.filter(c => c.id !== parseInt(id));
            const defaultCat = availableCats.length > 0 ? availableCats[0] : null;
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
            date: tx.date.split('T')[0], // Use the date part directly, ignoring timezone
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

    const handleDeleteClick = async (txId) => {
        if (!window.confirm("Are you sure you want to delete this transaction?")) return;
        try {
            await api.delete(`/transactions/${txId}`);
            setTransactions(transactions.filter(t => t.id !== txId));
            setDeletedTransactionId(txId);
            setShowUndoToast(true);
            setTimeout(() => setShowUndoToast(false), 5000); // Hide after 5s
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert("Failed to delete transaction");
        }
    };

    const handleUndoDelete = async () => {
        if (!deletedTransactionId) return;
        try {
            await restoreTransaction(deletedTransactionId);
            fetchData();
            setShowUndoToast(false);
            setDeletedTransactionId(null);
        } catch (error) {
            console.error("Error restoring transaction:", error);
            alert("Failed to restore transaction");
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingTransaction(null);
        const availableCats = chartOfAccounts.filter(c => c.id !== parseInt(id));
        const defaultCat = availableCats.length > 0 ? availableCats[0] : null;
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

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    // Sort transactions locally based on current state
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (sortOrder === 'asc') {
            // Oldest First: Date ASC, Sequence ASC
            return dateA - dateB || a.sequence - b.sequence || a.id - b.id;
        } else {
            // Newest First: Date DESC, Sequence DESC
            return dateB - dateA || b.sequence - a.sequence || b.id - a.id;
        }
    });

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = sortedTransactions.findIndex(t => t.id === active.id);
        const newIndex = sortedTransactions.findIndex(t => t.id === over.id);

        const movedTx = sortedTransactions[oldIndex];
        const targetTx = sortedTransactions[newIndex];

        // Determine target date
        // We take the date of the transaction we dropped onto
        const targetDate = targetTx.date;
        const movedDate = movedTx.date;

        const isSameDate = format(new Date(targetDate), 'yyyy-MM-dd') === format(new Date(movedDate), 'yyyy-MM-dd');

        if (!isSameDate) {
            const confirmed = window.confirm(`Move transaction to ${format(new Date(targetDate), 'MMM d, yyyy')}?`);
            if (!confirmed) return;
        }

        // Calculate Logical Index
        // 1. Simulate the move in the current list
        const newSortedList = arrayMove(sortedTransactions, oldIndex, newIndex);

        // 2. Filter for the target date group
        // Note: movedTx in newSortedList still has OLD date, but for calculation we treat it as having TARGET date
        const targetDateStr = format(new Date(targetDate), 'yyyy-MM-dd');

        const group = newSortedList.filter(t => {
            const tDate = t.id === movedTx.id ? targetDate : t.date;
            return format(new Date(tDate), 'yyyy-MM-dd') === targetDateStr;
        });

        // 3. Find index of movedTx in the group
        const visualIndexInGroup = group.findIndex(t => t.id === movedTx.id);

        // 4. Convert to Logical Index
        // If ASC: Logical = Visual
        // If DESC: Logical = (Length - 1) - Visual
        let logicalIndex = visualIndexInGroup;
        if (sortOrder === 'desc') {
            logicalIndex = (group.length - 1) - visualIndexInGroup;
        }

        // Optimistic Update (Visual only, to prevent flicker)
        setTransactions(prev => {
            // We can't easily optimistically update the sequences without complex logic.
            // So we'll just wait for the fetch.
            // But we can update the date locally to make it look right immediately if we wanted.
            return prev;
        });

        try {
            await api.put(`/transactions/${movedTx.id}/reorder`, {
                newDate: targetDate,
                newIndex: logicalIndex
            });
            fetchData(); // Refresh to get new sequences
        } catch (error) {
            console.error("Error reordering:", error);
            alert("Failed to reorder transaction");
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6 relative">
            {/* Undo Toast */}
            {showUndoToast && (
                <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded shadow-lg flex items-center space-x-4 z-50 animate-fade-in-up">
                    <span>Transaction deleted.</span>
                    <button onClick={handleUndoDelete} className="text-blue-400 font-bold hover:text-blue-300">UNDO</button>
                    <button onClick={() => setShowUndoToast(false)} className="text-gray-400 hover:text-gray-200 ml-2">x</button>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">{account ? account.name : 'Account'}</h1>
                <div className="flex space-x-3">

                    <button className="btn-secondary flex items-center">
                        <Filter className="w-4 h-4 mr-2" /> Filter
                    </button>
                    <button className="btn-primary flex items-center" onClick={() => {
                        setEditingTransaction(null);
                        const availableCats = chartOfAccounts.filter(c => c.id !== parseInt(id));
                        const defaultCat = availableCats.length > 0 ? availableCats[0] : null;
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
                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                                    {(() => {
                                        // 1. Filter out current account
                                        const available = filteredCategories.filter(c => c.id !== parseInt(id));

                                        // 2. Group by Type
                                        const grouped = available.reduce((acc, cat) => {
                                            const type = cat.type || 'Other';
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(cat);
                                            return acc;
                                        }, {});

                                        // Order of types to display
                                        const typeOrder = ['Expense', 'Income', 'Liability', 'Asset', 'Equity'];
                                        const sortedTypes = Object.keys(grouped).sort((a, b) => {
                                            const idxA = typeOrder.indexOf(a);
                                            const idxB = typeOrder.indexOf(b);
                                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                            if (idxA !== -1) return -1;
                                            if (idxB !== -1) return 1;
                                            return a.localeCompare(b);
                                        });

                                        if (available.length === 0 && !categoryInput) {
                                            return <div className="px-4 py-2 text-sm text-gray-500">No categories found</div>;
                                        }

                                        return (
                                            <>
                                                {sortedTypes.map(type => (
                                                    <div key={type}>
                                                        <div className="px-4 py-1 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                                                            {type}
                                                        </div>
                                                        {grouped[type].map(cat => (
                                                            <div
                                                                key={cat.id}
                                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm pl-6"
                                                                onClick={() => selectCategory(cat)}
                                                            >
                                                                {cat.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                                {available.length === 0 && categoryInput && (
                                                    <div
                                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-medium border-t border-gray-100"
                                                        onClick={initiateCreateCategory}
                                                    >
                                                        + Create "{categoryInput}"
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-3 w-8"></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" onClick={toggleSortOrder}>
                                    <div className="flex items-center">
                                        Date
                                        {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee / Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deposit</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            <SortableContext
                                items={sortedTransactions.map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {(() => {
                                    let currentBalance = account ? parseFloat(account.cachedBalance) : 0;
                                    let startingBalance = 0;

                                    if (sortOrder === 'asc') {
                                        // Calculate starting balance for the list
                                        // Starting Balance = Current Balance - (Sum of all transactions)
                                        // Wait, "Current Balance" is the balance AFTER all transactions.
                                        // So Starting Balance = End Balance - Net Change
                                        const totalDeposits = sortedTransactions.reduce((sum, tx) => sum + (tx.type === 'Deposit' ? tx.amount : 0), 0);
                                        const totalPayments = sortedTransactions.reduce((sum, tx) => sum + (tx.type === 'Payment' ? tx.amount : 0), 0);
                                        const netChange = totalDeposits - totalPayments;
                                        startingBalance = currentBalance - netChange;
                                        currentBalance = startingBalance;
                                    }

                                    return sortedTransactions.map((tx) => {
                                        let runningBalance;

                                        if (sortOrder === 'asc') {
                                            // Calculate balance for THIS transaction
                                            if (tx.type === 'Deposit') {
                                                currentBalance += tx.amount;
                                            } else {
                                                currentBalance -= tx.amount;
                                            }
                                            runningBalance = currentBalance;
                                        } else {
                                            // Descending (Newest First)
                                            // Current balance is the balance AFTER this transaction
                                            runningBalance = currentBalance;

                                            // Prepare balance for next iteration (previous transaction in time)
                                            if (tx.type === 'Deposit') {
                                                currentBalance -= tx.amount;
                                            } else {
                                                currentBalance += tx.amount;
                                            }
                                        }

                                        return (
                                            <SortableRow
                                                key={tx.id}
                                                transaction={tx}
                                                runningBalance={runningBalance}
                                                onEdit={handleEditClick}
                                                onDelete={handleDeleteClick}
                                            />
                                        );
                                    });
                                })()}
                            </SortableContext>
                        </tbody>
                    </table>
                </DndContext>
            </div>
        </div>
    );
};

export default AccountView;
