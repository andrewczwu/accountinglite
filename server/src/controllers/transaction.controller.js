const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const Decimal = Prisma.Decimal;

const getTransactions = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    const accountId = parseInt(id);

    const account = await prisma.account.findFirst({
        where: { id: accountId, tenantId: req.tenantId }
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const transactions = await prisma.transaction.findMany({
        where: {
            tenantId: req.tenantId,
            deletedAt: null, // Filter out deleted transactions
            lines: {
                some: { accountId: accountId }
            }
        },
        include: {
            lines: { include: { account: true } },
            customer: true,
        },
        orderBy: { date: 'desc' },
    });

    const transformed = transactions.map(tx => {
        const mainLine = tx.lines.find(l => l.accountId === accountId);
        const otherLines = tx.lines.filter(l => l.accountId !== accountId);

        let type = 'Payment';
        const mainAmountVal = Number(mainLine.amount);

        if (account.type === 'Asset') {
            if (mainAmountVal > 0) type = 'Deposit';
            else type = 'Payment';
        } else if (account.type === 'Liability') {
            if (mainAmountVal > 0) type = 'Deposit';
            else type = 'Payment';
        }

        return {
            id: tx.id,
            date: tx.date,
            payee: tx.payee,
            description: tx.description,
            amount: Math.abs(mainAmountVal),
            type: type,
            accountId: accountId,
            customerId: tx.customerId,
            splits: otherLines.map(l => ({
                chartOfAccountId: l.accountId,
                chartOfAccount: l.account,
                amount: Math.abs(Number(l.amount))
            }))
        };
    });

    res.json(transformed);
};

const createTransaction = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { date, payee, description, amount, type, accountId, customerId, splits } = req.body;

    const mainAccountId = parseInt(accountId);
    const mainAccount = await prisma.account.findUnique({ where: { id: mainAccountId } });
    if (!mainAccount) return res.status(404).json({ error: 'Account not found' });

    let mainAmount = new Decimal(amount);

    if (type === 'Payment') mainAmount = mainAmount.abs().negated();
    else mainAmount = mainAmount.abs();

    const splitSign = mainAmount.isPositive() ? -1 : 1;

    try {
        const transaction = await prisma.transaction.create({
            data: {
                date: new Date(date),
                payee,
                description,
                customerId: customerId ? parseInt(customerId) : null,
                tenantId: req.tenantId,
                lines: {
                    create: [
                        {
                            accountId: mainAccountId,
                            amount: mainAmount
                        },
                        ...splits.map(split => ({
                            accountId: parseInt(split.chartOfAccountId),
                            amount: new Decimal(split.amount).mul(splitSign)
                        }))
                    ]
                }
            },
            include: { lines: true }
        });

        await prisma.account.update({
            where: { id: mainAccountId },
            data: { balance: { increment: mainAmount } }
        });

        for (const split of splits) {
            await prisma.account.update({
                where: { id: parseInt(split.chartOfAccountId) },
                data: { balance: { increment: new Decimal(split.amount).mul(splitSign) } }
            });
        }

        res.json(transaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
};

const updateTransaction = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    const { date, payee, description, amount, type, accountId, customerId, splits } = req.body;

    try {
        const originalTransaction = await prisma.transaction.findFirst({
            where: { id: parseInt(id), tenantId: req.tenantId },
            include: { lines: true }
        });

        if (!originalTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Revert balances
        for (const line of originalTransaction.lines) {
            await prisma.account.update({
                where: { id: line.accountId },
                data: { balance: { decrement: line.amount } }
            });
        }

        const mainAccountId = parseInt(accountId);
        let mainAmount = new Decimal(amount);
        if (type === 'Payment') mainAmount = mainAmount.abs().negated();
        else mainAmount = mainAmount.abs();

        const splitSign = mainAmount.isPositive() ? -1 : 1;

        const updatedTransaction = await prisma.transaction.update({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            },
            data: {
                date: new Date(date),
                payee,
                description,
                customerId: customerId ? parseInt(customerId) : (customerId === null ? { disconnect: true } : undefined),
                lines: {
                    deleteMany: {},
                    create: [
                        {
                            accountId: mainAccountId,
                            amount: mainAmount
                        },
                        ...splits.map(split => ({
                            accountId: parseInt(split.chartOfAccountId),
                            amount: new Decimal(split.amount).mul(splitSign)
                        }))
                    ]
                }
            },
            include: { lines: true }
        });

        await prisma.account.update({
            where: { id: mainAccountId },
            data: { balance: { increment: mainAmount } }
        });

        for (const split of splits) {
            await prisma.account.update({
                where: { id: parseInt(split.chartOfAccountId) },
                data: { balance: { increment: new Decimal(split.amount).mul(splitSign) } }
            });
        }

        res.json(updatedTransaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
};

const deleteTransaction = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;

    try {
        const transaction = await prisma.transaction.findFirst({
            where: { id: parseInt(id), tenantId: req.tenantId },
            include: { lines: true }
        });

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        if (transaction.deletedAt) return res.status(400).json({ error: 'Transaction already deleted' });

        // Revert balances (Soft delete acts like a delete for balances)
        for (const line of transaction.lines) {
            await prisma.account.update({
                where: { id: line.accountId },
                data: { balance: { decrement: line.amount } }
            });
        }

        // Mark as deleted
        await prisma.transaction.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() }
        });

        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
};

const restoreTransaction = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;

    try {
        const transaction = await prisma.transaction.findFirst({
            where: { id: parseInt(id), tenantId: req.tenantId },
            include: { lines: true }
        });

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        if (!transaction.deletedAt) return res.status(400).json({ error: 'Transaction is not deleted' });

        // Re-apply balances
        for (const line of transaction.lines) {
            await prisma.account.update({
                where: { id: line.accountId },
                data: { balance: { increment: line.amount } }
            });
        }

        // Mark as not deleted
        await prisma.transaction.update({
            where: { id: parseInt(id) },
            data: { deletedAt: null }
        });

        res.json({ message: 'Transaction restored' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to restore transaction' });
    }
};

module.exports = {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction
};
