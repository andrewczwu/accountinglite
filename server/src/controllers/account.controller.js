const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

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
        const account = await prisma.account.create({
            data: {
                name,
                type: schemaType,
                subtype: type,
                cachedBalance: new Prisma.Decimal(balance || 0),
                tenantId: req.tenantId
            },
        });
        res.json({ ...account, balance: account.cachedBalance });
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
