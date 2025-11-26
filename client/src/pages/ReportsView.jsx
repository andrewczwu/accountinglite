import React, { useEffect, useState } from 'react';
import api from '../api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const ReportsView = () => {
    const [balanceSheet, setBalanceSheet] = useState(null);
    const [profitLoss, setProfitLoss] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const [bsRes, plRes] = await Promise.all([
                    api.get('/reports/balance-sheet'),
                    api.get('/reports/profit-loss')
                ]);
                setBalanceSheet(bsRes.data);
                setProfitLoss(plRes.data);
            } catch (error) {
                console.error('Error fetching reports:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    if (loading) return <div>Loading...</div>;

    const plData = [
        { name: 'Income', value: profitLoss?.income || 0, color: '#10B981' },
        { name: 'Expenses', value: profitLoss?.expenses || 0, color: '#EF4444' }
    ];

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Balance Sheet Card */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Balance Sheet</h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                            <span className="text-gray-600">Total Assets</span>
                            <span className="font-bold text-gray-900">${balanceSheet?.assets.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                            <span className="text-gray-600">Total Liabilities</span>
                            <span className="font-bold text-gray-900">${balanceSheet?.liabilities.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-md border border-green-100">
                            <span className="text-green-700 font-medium">Total Equity</span>
                            <span className="font-bold text-green-700">${balanceSheet?.equity.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Profit & Loss Card */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={plData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {plData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-500">Net Income</p>
                        <p className={`text-2xl font-bold ${profitLoss?.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${profitLoss?.netIncome.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
