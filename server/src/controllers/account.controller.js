const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { recalculateAccountBalance } = require('../services/ledger.service');

const getAccounts = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const accounts = await prisma.account.findMany({
        where: {
            tenantId: req.tenantId,
            subtype: { in: ['Bank', 'Credit Card'] }
        }
    });
    res.json(accounts.map(a => ({ ...a, balance: a.cachedBalance })));
};

const getAccount = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    try {
        const account = await prisma.account.findUnique({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            }
        });
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json({ ...account, balance: account.cachedBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
};

const createAccount = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { name, type, balance } = req.body;

    let schemaType = 'Asset';
    if (type === 'Credit Card') schemaType = 'Liability';

    try {
        const result = await prisma.$transaction(async (prisma) => {
            // 1. Create the new account
            const account = await prisma.account.create({
                data: {
                    name,
                    type: schemaType,
                    subtype: type,
                    cachedBalance: new Prisma.Decimal(0), // Start with 0, let transaction set it
                    tenantId: req.tenantId
                },
            });

            // 2. If there is an initial balance, create an Opening Balance transaction
            const initialBalance = new Prisma.Decimal(balance || 0);
            if (!initialBalance.equals(0)) {
                // Find or create "Opening Balance Equity" account
                let equityAccount = await prisma.account.findFirst({
                    where: {
                        tenantId: req.tenantId,
                        name: 'Opening Balance Equity',
                        type: 'Equity'
                    }
                });

                if (!equityAccount) {
                    equityAccount = await prisma.account.create({
                        data: {
                            name: 'Opening Balance Equity',
                            type: 'Equity',
                            tenantId: req.tenantId
                        }
                    });
                }

                // Determine amount and sign
                // For Assets: Positive balance = Debit (Increase)
                // For Liabilities: Positive balance = Credit (Increase)
                // We need to create a transaction that results in the correct positive balance for the user.
                // In our system, 'amount' in TransactionLine is signed.
                // Asset: +amount increases balance.
                // Liability: -amount increases balance (usually).
                // Wait, let's check transaction.controller.js logic.
                // It says: if (account.type === 'Asset') ...
                // Actually, let's look at ledger.service.js. It just sums amount.
                // So if I want an Asset to have +1000, I need a line with +1000.
                // If I want a Liability (Credit Card) to have a balance of 1000 (owed), 
                // typically that means a credit balance. In many systems liabilities are negative.
                // Let's check how the user sees it.
                // In `transaction.controller.js`:
                // if (account.type === 'Liability') { if (mainAmountVal > 0) type = 'Deposit'; else type = 'Payment'; }
                // And `amount: Math.abs(mainAmountVal)`.
                // Usually for CC, a positive number means you owe money.
                // If I have a CC balance of $1000, that means I spent $1000.
                // In a signed system, that's usually -1000 (Liability).
                // But let's check `createTransaction`:
                // if (type === 'Payment') mainAmount = mainAmount.abs().negated();
                // If I make a payment (spend money) on a CC, balance goes UP (more debt).
                // Wait, "Payment" on CC usually means paying OFF the debt.
                // "Charge" or "Expense" increases debt.
                // Let's assume standard accounting: Assets are Debit (+), Liabilities are Credit (-).
                // If user enters "1000" for Bank (Asset), they mean +1000.
                // If user enters "1000" for CC (Liability), they usually mean they owe 1000.
                // So that should be -1000 in the DB?
                // Let's stick to: Asset = +amount, Liability = -amount.

                let amountForNewAccount = initialBalance;
                if (schemaType === 'Liability') {
                    amountForNewAccount = initialBalance.negated();
                }

                // Create the transaction
                await prisma.transaction.create({
                    data: {
                        date: new Date(), // Today
                        payee: 'Opening Balance',
                        description: 'Opening Balance',
                        tenantId: req.tenantId,
                        lines: {
                            create: [
                                {
                                    accountId: account.id,
                                    amount: amountForNewAccount
                                },
                                {
                                    accountId: equityAccount.id,
                                    amount: amountForNewAccount.negated() // Balancing entry
                                }
                            ]
                        }
                    }
                });

                // Recalculate balances
                await recalculateAccountBalance(account.id, req.tenantId, prisma);
                await recalculateAccountBalance(equityAccount.id, req.tenantId, prisma);
            }

            return account;
        });

        // Fetch the final account with updated balance to return
        const finalAccount = await prisma.account.findUnique({
            where: { id: result.id }
        });

        res.json({ ...finalAccount, balance: finalAccount.cachedBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create account' });
    }
};

const deleteAccount = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;

    try {
        await prisma.account.delete({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            }
        });
        res.json({ message: 'Account deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

const getChartOfAccounts = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const coa = await prisma.account.findMany({
        where: {
            tenantId: req.tenantId,
        }
    });
    res.json(coa.map(a => ({ ...a, balance: a.cachedBalance })));
};

const createChartOfAccount = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { name, type } = req.body;
    const coa = await prisma.account.create({
        data: {
            name,
            type,
            tenantId: req.tenantId
        }
    });
    res.json({ ...coa, balance: coa.cachedBalance });
};

const updateChartOfAccount = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    const { name, type } = req.body;
    try {
        const coa = await prisma.account.update({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            },
            data: { name, type }
        });
        res.json({ ...coa, balance: coa.cachedBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

const deleteChartOfAccount = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    try {
        await prisma.account.delete({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            }
        });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete category. It may be in use.' });
    }
};

module.exports = {
    getAccounts,
    getAccount,
    createAccount,
    deleteAccount,
    getChartOfAccounts,
    createChartOfAccount,
    updateChartOfAccount,
    deleteChartOfAccount
};
