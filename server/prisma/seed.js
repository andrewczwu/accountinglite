const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Create User
    const user = await prisma.user.upsert({
        where: { email: 'test@example.com' },
        update: {},
        create: {
            email: 'test@example.com',
            firebaseUid: 'X6JxG2zPOsQP3xe3HEcZdukq1Ds2',
        },
    });

    // Create Tenant
    // We try to find a tenant for this user, or create one
    let tenant = await prisma.tenant.findFirst({
        where: {
            users: {
                some: {
                    userId: user.id
                }
            }
        }
    });

    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Demo Company',
                users: {
                    create: {
                        userId: user.id,
                        role: 'ADMIN'
                    }
                }
            }
        });
    }

    console.log(`Using tenant: ${tenant.name} (${tenant.id})`);

    // Chart of Accounts
    const coaData = [
        { name: 'Sales Income', type: 'Income' },
        { name: 'Consulting Income', type: 'Income' },
        { name: 'Office Supplies', type: 'Expense' },
        { name: 'Rent', type: 'Expense' },
        { name: 'Utilities', type: 'Expense' },
        { name: 'Inventory Asset', type: 'Asset' },
        { name: 'Accounts Payable', type: 'Liability' },
        { name: 'Owner Equity', type: 'Equity' },
    ];

    for (const coa of coaData) {
        const existing = await prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                name: coa.name,
                type: coa.type
            }
        });
        if (!existing) {
            await prisma.account.create({
                data: {
                    ...coa,
                    tenantId: tenant.id,
                    balance: new Prisma.Decimal(0)
                }
            });
        }
    }

    // Bank Accounts
    const bankAccounts = [
        { name: 'Business Checking', type: 'Asset', subtype: 'Bank', balance: 5000.00 },
        { name: 'Business Savings', type: 'Asset', subtype: 'Bank', balance: 12000.00 },
        { name: 'Corporate Card', type: 'Liability', subtype: 'Credit Card', balance: -450.00 },
    ];

    for (const acc of bankAccounts) {
        const existing = await prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                name: acc.name
            }
        });
        if (!existing) {
            await prisma.account.create({
                data: {
                    name: acc.name,
                    type: acc.type,
                    subtype: acc.subtype,
                    balance: new Prisma.Decimal(acc.balance),
                    tenantId: tenant.id
                }
            });
        }
    }

    // Customers
    const customers = [
        { name: 'Acme Corp', email: 'contact@acme.com', isBusiness: true },
        { name: 'Globex Inc', email: 'info@globex.com', isBusiness: true },
    ];

    for (const cust of customers) {
        const existing = await prisma.customer.findFirst({
            where: {
                tenantId: tenant.id,
                name: cust.name
            }
        });
        if (!existing) {
            await prisma.customer.create({
                data: {
                    ...cust,
                    tenantId: tenant.id
                }
            });
        }
    }

    console.log('Seed data inserted');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
