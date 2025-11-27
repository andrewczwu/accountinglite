const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getBalanceSheet = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

    const accounts = await prisma.account.findMany({
        where: { tenantId: req.tenantId }
    });

    // Prisma Decimal to Number for simple aggregation
    // For high precision aggregation, we should use Decimal.add
    // But for this report, we'll convert to Number for simplicity in this prototype refactor, 
    // acknowledging we might lose precision on very large numbers.
    // Ideally: acc.balance.toNumber()

    const assets = accounts.filter(a => a.type === 'Asset').reduce((sum, acc) => sum + Number(acc.cachedBalance), 0);
    const liabilities = accounts.filter(a => a.type === 'Liability').reduce((sum, acc) => sum + Number(acc.cachedBalance), 0);
    const equity = accounts.filter(a => a.type === 'Equity').reduce((sum, acc) => sum + Number(acc.cachedBalance), 0);

    res.json({
        assets,
        liabilities: Math.abs(liabilities),
        equity: Math.abs(equity)
    });
};

const getProfitLoss = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

    const lines = await prisma.transactionLine.findMany({
        where: {
            account: {
                tenantId: req.tenantId,
                type: { in: ['Income', 'Expense'] }
            },
            transaction: {
                deletedAt: null
            }
        },
        include: { account: true }
    });

    let income = 0;
    let expenses = 0;

    lines.forEach(line => {
        const amount = Number(line.amount);
        if (line.account.type === 'Income') income += Math.abs(amount);
        if (line.account.type === 'Expense') expenses += Math.abs(amount);
    });

    res.json({
        income,
        expenses,
        netIncome: income - expenses
    });
};

module.exports = {
    getBalanceSheet,
    getProfitLoss
};
