const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Recalculates the cached balance for a specific account based on its transaction history.
 * @param {number} accountId - The ID of the account to recalculate.
 * @param {number} tenantId - The tenant ID for security context.
 * @param {object} [tx] - Optional Prisma transaction client.
 */
const recalculateAccountBalance = async (accountId, tenantId, tx = prisma) => {
    // Sum all transaction lines for this account where the transaction is not deleted
    const aggregate = await tx.transactionLine.aggregate({
        where: {
            accountId: accountId,
            transaction: {
                tenantId: tenantId,
                deletedAt: null
            }
        },
        _sum: {
            amount: true
        }
    });

    const newBalance = aggregate._sum.amount || 0;

    // Update the account's cached balance
    await tx.account.update({
        where: { id: accountId },
        data: { cachedBalance: newBalance }
    });

    return newBalance;
};

module.exports = {
    recalculateAccountBalance
};
