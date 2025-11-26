const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Firebase Auth Middleware
const verifyToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).send('Unauthorized');
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).send('Unauthorized');
  }
};

// --- Accounts ---
app.get('/api/accounts', verifyToken, async (req, res) => {
  const accounts = await prisma.account.findMany();
  res.json(accounts);
});

app.post('/api/accounts', verifyToken, async (req, res) => {
  const { name, type, balance } = req.body;
  const account = await prisma.account.create({
    data: { name, type, balance: parseFloat(balance) || 0 },
  });
  res.json(account);
});

// --- Chart of Accounts ---
app.get('/api/chart-of-accounts', verifyToken, async (req, res) => {
  const coa = await prisma.chartOfAccount.findMany();
  res.json(coa);
});

app.post('/api/chart-of-accounts', verifyToken, async (req, res) => {
  const { name, type } = req.body;
  const coa = await prisma.chartOfAccount.create({
    data: { name, type }
  });
  res.json(coa);
});


// --- Customers ---
app.get('/api/customers', verifyToken, async (req, res) => {
  const customers = await prisma.customer.findMany();
  res.json(customers);
});

app.post('/api/customers', verifyToken, async (req, res) => {
  const { name, email, phone, address } = req.body;
  const customer = await prisma.customer.create({
    data: { name, email, phone, address }
  });
  res.json(customer);
});

// --- Transactions ---
app.get('/api/accounts/:id/transactions', verifyToken, async (req, res) => {
  const { id } = req.params;
  const transactions = await prisma.transaction.findMany({
    where: { accountId: parseInt(id) },
    include: {
      splits: { include: { chartOfAccount: true } },
      customer: true,
    },
    orderBy: { date: 'desc' },
  });
  res.json(transactions);
});

app.post('/api/transactions', verifyToken, async (req, res) => {
  const { date, payee, description, amount, type, accountId, customerId, splits } = req.body;

  try {
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        payee,
        description,
        amount: parseFloat(amount),
        type,
        account: { connect: { id: parseInt(accountId) } },
        customer: customerId ? { connect: { id: parseInt(customerId) } } : undefined,
        splits: {
          create: splits.map(split => ({
            amount: parseFloat(split.amount),
            chartOfAccount: { connect: { id: parseInt(split.chartOfAccountId) } }
          }))
        }
      },
      include: { splits: true }
    });

    // Update Account Balance
    const account = await prisma.account.findUnique({ where: { id: parseInt(accountId) } });
    let newBalance = account.balance;
    if (type === 'Deposit') {
      newBalance += parseFloat(amount);
    } else {
      newBalance -= parseFloat(amount);
    }
    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { balance: newBalance }
    });

    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.put('/api/transactions/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { date, payee, description, amount, type, accountId, customerId, splits } = req.body;

  try {
    // 1. Get original transaction to revert balance
    const originalTransaction = await prisma.transaction.findUnique({
      where: { id: parseInt(id) },
      include: { splits: true }
    });

    if (!originalTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 2. Revert old balance effect
    const account = await prisma.account.findUnique({ where: { id: parseInt(originalTransaction.accountId) } });
    let currentBalance = account.balance;

    if (originalTransaction.type === 'Deposit') {
      currentBalance -= originalTransaction.amount;
    } else {
      currentBalance += originalTransaction.amount;
    }

    // 3. Update transaction
    // We will delete existing splits and recreate them for simplicity
    const updatedTransaction = await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: {
        date: new Date(date),
        payee,
        description,
        amount: parseFloat(amount),
        type,
        customer: customerId ? { connect: { id: parseInt(customerId) } } : { disconnect: true },
        splits: {
          deleteMany: {},
          create: splits.map(split => ({
            amount: parseFloat(split.amount),
            chartOfAccount: { connect: { id: parseInt(split.chartOfAccountId) } }
          }))
        }
      },
      include: { splits: true }
    });

    // 4. Apply new balance effect
    if (type === 'Deposit') {
      currentBalance += parseFloat(amount);
    } else {
      currentBalance -= parseFloat(amount);
    }

    await prisma.account.update({
      where: { id: parseInt(accountId) },
      data: { balance: currentBalance }
    });

    res.json(updatedTransaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// --- Reports ---
app.get('/api/reports/balance-sheet', verifyToken, async (req, res) => {
  // Simplified Balance Sheet: Assets = Liabilities + Equity
  // Assets: Bank Accounts
  // Liabilities/Equity: Calculated from Chart of Accounts (not fully implemented logic here for brevity, but structure is ready)

  const accounts = await prisma.account.findMany();
  const assets = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // In a real app, we'd query TransactionSplits grouped by ChartOfAccount type
  res.json({
    assets,
    liabilities: 0, // Placeholder
    equity: assets // Placeholder (Assets - Liabilities)
  });
});

app.get('/api/reports/profit-loss', verifyToken, async (req, res) => {
  // Income vs Expenses
  // Query TransactionSplits where ChartOfAccount.type is Income or Expense

  const splits = await prisma.transactionSplit.findMany({
    include: { chartOfAccount: true }
  });

  let income = 0;
  let expenses = 0;

  splits.forEach(split => {
    if (split.chartOfAccount.type === 'Income') income += split.amount;
    if (split.chartOfAccount.type === 'Expense') expenses += split.amount;
  });

  res.json({
    income,
    expenses,
    netIncome: income - expenses
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
