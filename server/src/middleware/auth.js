const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifyToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    const tenantIdHeader = req.headers['x-tenant-id'];

    if (!idToken) {
        console.log('No ID token provided');
        return res.status(401).send('Unauthorized');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;

        // Upsert User in DB
        let user = await prisma.user.findUnique({ where: { firebaseUid: decodedToken.uid } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    firebaseUid: decodedToken.uid,
                    email: decodedToken.email
                }
            });
        }
        req.dbUser = user;

        // If Tenant ID is provided, verify access
        // Skip verification for creating (POST) or listing (GET) tenants
        const isTenantRoot = req.baseUrl === '/api/tenants' &&
            (req.path === '/' || req.path === '');

        if (tenantIdHeader && !isTenantRoot) {
            const tenantId = parseInt(tenantIdHeader);
            const userTenant = await prisma.userTenant.findUnique({
                where: {
                    userId_tenantId: {
                        userId: user.id,
                        tenantId: tenantId
                    }
                }
            });

            if (!userTenant) {
                return res.status(403).send('Access to this tenant denied');
            }
            req.tenantId = tenantId;
            req.userRole = userTenant.role;
        }

        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).send('Unauthorized');
    }
};

module.exports = verifyToken;
