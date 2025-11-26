const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getTenants = async (req, res) => {
    const userTenants = await prisma.userTenant.findMany({
        where: { userId: req.dbUser.id },
        include: { tenant: true }
    });
    res.json(userTenants.map(ut => ({ ...ut.tenant, role: ut.role })));
};

const createTenant = async (req, res) => {
    const { name } = req.body;
    try {
        const tenant = await prisma.tenant.create({
            data: {
                name,
                users: {
                    create: {
                        userId: req.dbUser.id,
                        role: 'ADMIN'
                    }
                }
            }
        });
        res.json(tenant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create tenant' });
    }
};

const addUserToTenant = async (req, res) => {
    const { id } = req.params;
    const { email, role } = req.body;

    if (req.tenantId !== parseInt(id) || req.userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can add users' });
    }

    try {
        let userToAdd = await prisma.user.findUnique({ where: { email } });
        if (!userToAdd) {
            return res.status(404).json({ error: 'User not found. Ask them to login once first.' });
        }

        const userTenant = await prisma.userTenant.create({
            data: {
                userId: userToAdd.id,
                tenantId: parseInt(id),
                role: role || 'USER'
            }
        });
        res.json(userTenant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add user to tenant' });
    }
};

module.exports = {
    getTenants,
    createTenant,
    addUserToTenant
};
