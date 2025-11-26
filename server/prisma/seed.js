const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
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
        await prisma.chartOfAccount.create({ data: coa });
    }

    // Accounts
    await prisma.account.create({
        data: { name: 'Business Checking', type: 'Bank', balance: 5000.00 },
    });
    await prisma.account.create({
        data: { name: 'Business Savings', type: 'Bank', balance: 12000.00 },
    });
    await prisma.account.create({
        data: { name: 'Corporate Card', type: 'Credit Card', balance: -450.00 },
    });

    // Customers
    await prisma.customer.create({
        data: { name: 'Acme Corp', email: 'contact@acme.com' },
    });
    await prisma.customer.create({
        data: { name: 'Globex Inc', email: 'info@globex.com' },
    });

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
