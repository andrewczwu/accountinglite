const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCustomers = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const customers = await prisma.customer.findMany({
        where: { tenantId: req.tenantId }
    });
    res.json(customers);
};

const createCustomer = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { name, firstName, lastName, isBusiness, email, phone, address } = req.body;

    let displayName = name;
    if (!displayName) {
        if (isBusiness) {
            displayName = 'Unknown Business';
        } else {
            displayName = `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Customer';
        }
    }

    try {
        const customer = await prisma.customer.create({
            data: {
                name: displayName,
                firstName,
                lastName,
                isBusiness: !!isBusiness,
                email,
                phone,
                address,
                tenantId: req.tenantId
            }
        });
        res.json(customer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
};

const updateCustomer = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    const { name, firstName, lastName, isBusiness, email, phone, address } = req.body;

    let displayName = name;
    if (!displayName) {
        if (isBusiness) {
            displayName = 'Unknown Business';
        } else {
            displayName = `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Customer';
        }
    }

    try {
        const customer = await prisma.customer.update({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            },
            data: {
                name: displayName,
                firstName,
                lastName,
                isBusiness: !!isBusiness,
                email,
                phone,
                address
            }
        });
        res.json(customer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
};

const deleteCustomer = async (req, res) => {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const { id } = req.params;
    try {
        await prisma.customer.delete({
            where: {
                id: parseInt(id),
                tenantId: req.tenantId
            }
        });
        res.json({ message: 'Customer deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete customer. It may be in use.' });
    }
};

module.exports = {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
