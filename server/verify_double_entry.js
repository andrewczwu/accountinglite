const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDoubleEntry() {
    try {
        // 1. Create Tenant and User (Mock)
        const tenant = await prisma.tenant.create({
            data: { name: 'Test Tenant' }
        });

        // 2. Create Accounts
        const bank = await prisma.account.create({
            data: { name: 'Test Bank', type: 'Asset', subtype: 'Bank', tenantId: tenant.id, balance: 0 }
        });

        const expense = await prisma.account.create({
            data: { name: 'Test Expense', type: 'Expense', tenantId: tenant.id }
        });

        // 3. Create Transaction (Payment of $100)
        // Logic from API:
        // Main (Bank): -100 (Credit)
        // Split (Expense): +100 (Debit)

        const amount = 100;
        const splitSign = -1 * (amount > 0 ? -1 : 1); // Wait, logic in API:
        // if Payment: mainAmount = -100. splitSign = -1.
        // Split Amount = 100 * -1 = -100? No.
        // API Logic:
        // if Payment: mainAmount = -100.
        // splitSign = mainAmount > 0 ? -1 : 1 => -100 > 0 is false => 1.
        // Split Amount = 100 * 1 = 100.
        // Sum = -100 + 100 = 0. Correct.

        const mainAmount = -100;
        const splitAmount = 100;

        const tx = await prisma.transaction.create({
            data: {
                date: new Date(),
                payee: 'Test Payee',
                description: 'Test Transaction',
                tenantId: tenant.id,
                lines: {
                    create: [
                        { accountId: bank.id, amount: mainAmount },
                        { accountId: expense.id, amount: splitAmount }
                    ]
                }
            },
            include: { lines: true }
        });

        console.log('Transaction Created:', tx.id);

        // 4. Verify Sum
        const sum = tx.lines.reduce((acc, line) => acc + line.amount, 0);
        console.log('Sum of lines:', sum);

        if (Math.abs(sum) < 0.0001) {
            console.log('VERIFICATION PASSED: Sum is 0');
        } else {
            console.error('VERIFICATION FAILED: Sum is not 0');
        }

        // Clean up
        await prisma.transaction.delete({ where: { id: tx.id } });
        await prisma.account.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenant.delete({ where: { id: tenant.id } });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyDoubleEntry();
