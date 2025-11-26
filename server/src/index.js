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

// Firebase Auth Middleware & Tenant Context
const verifyToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  const tenantIdHeader = req.headers['x-tenant-id'];

  if (!idToken) return res.status(401).send('Unauthorized');

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
    if (tenantIdHeader) {
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

// --- Tenants ---
app.get('/api/tenants', verifyToken, async (req, res) => {
  const userTenants = await prisma.userTenant.findMany({
    where: { userId: req.dbUser.id },
    include: { tenant: true }
  });
  res.json(userTenants.map(ut => ({ ...ut.tenant, role: ut.role })));
});

app.post('/api/tenants', verifyToken, async (req, res) => {
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
});

app.post('/api/tenants/:id/users', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { email, role } = req.body; // Expect email to invite/add

  if (req.tenantId !== parseInt(id) || req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can add users' });
  }

  try {
    let userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      // In a real app, we might send an invite email. 
      // Here we require the user to have logged in at least once (created via auth middleware)
      // Or we could create a placeholder user.
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
});


// --- Accounts (Bank & Credit Cards) ---
app.get('/api/accounts', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const accounts = await prisma.account.findMany({
    where: {
      tenantId: req.tenantId,
      subtype: { in: ['Bank', 'Credit Card'] }
    }
  });
  res.json(accounts);
});

app.post('/api/accounts', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { name, type, balance } = req.body; // type here is 'Bank' or 'Credit Card' from frontend

  // Map frontend "type" to Schema "type" and "subtype"
  // Bank -> Asset, subtype: Bank
  // Credit Card -> Liability, subtype: Credit Card
  let schemaType = 'Asset';
  if (type === 'Credit Card') schemaType = 'Liability';

  try {
    const account = await prisma.account.create({
      data: {
        name,
        type: schemaType,
        subtype: type,
        balance: parseFloat(balance) || 0,
        tenantId: req.tenantId
      },
    });
    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.delete('/api/accounts/:id', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { id } = req.params;

  try {
    await prisma.account.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// --- Chart of Accounts (Categories) ---
// In the new schema, these are also Accounts, but usually Income/Expense/Equity/Liability/Asset
app.get('/api/chart-of-accounts', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const coa = await prisma.account.findMany({
    where: {
      tenantId: req.tenantId,
      // Optionally exclude Bank/CC if we only want "Categories"
      // But for Double Entry, we might want to see all.
      // For the dropdown in Register, we usually want Income/Expense/Equity/Liability (and maybe other Assets).
      // Let's return all for now, frontend can filter.
    }
  });
  res.json(coa);
});

app.post('/api/chart-of-accounts', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { name, type } = req.body; // type: Income, Expense, etc.
  const coa = await prisma.account.create({
    data: {
      name,
      type,
      tenantId: req.tenantId
    }
  });
  res.json(coa);
});

app.put('/api/chart-of-accounts/:id', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { id } = req.params;
  const { name, type } = req.body;
  try {
    const coa = await prisma.account.update({
      where: { id: parseInt(id) },
      data: { name, type }
    });
    res.json(coa);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/chart-of-accounts/:id', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { id } = req.params;
  try {
    await prisma.account.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category. It may be in use.' });
  }
});


// --- Customers ---
app.get('/api/customers', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const customers = await prisma.customer.findMany({
    where: { tenantId: req.tenantId }
  });
  res.json(customers);
});

app.post('/api/customers', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { name, firstName, lastName, isBusiness, email, phone, address } = req.body;

  // Determine display name if not provided
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
});

app.put('/api/customers/:id', verifyToken, async (req, res) => {
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
      where: { id: parseInt(id) },
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
});

app.delete('/api/customers/:id', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { id } = req.params;
  try {
    // Optional: Check for transactions. 
    // If we delete customer, we might want to set transaction.customerId to null instead of deleting transaction.
    // Or just let it fail if FK constraint.
    // Let's try to set transactions to null first if we want to preserve history but delete customer record?
    // Or just delete.

    // For now, simple delete.
    await prisma.customer.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete customer. It may be in use.' });
  }
});

// --- Transactions ---
app.get('/api/accounts/:id/transactions', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { id } = req.params;
  const accountId = parseInt(id);

  // Verify account belongs to tenant
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId: req.tenantId }
  });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  // Find transactions where one of the lines belongs to this account
  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId: req.tenantId,
      lines: {
        some: { accountId: accountId }
      }
    },
    include: {
      lines: { include: { account: true } },
      customer: true,
    },
    orderBy: { date: 'desc' },
  });

  // Transform for Frontend
  // Frontend expects: { id, date, payee, description, amount, type, accountId, customerId, splits: [{ chartOfAccountId, amount }] }
  // We need to infer "amount" and "type" relative to the requested account.
  const transformed = transactions.map(tx => {
    const mainLine = tx.lines.find(l => l.accountId === accountId);
    const otherLines = tx.lines.filter(l => l.accountId !== accountId);

    // If mainLine amount is positive, it's a Debit. For a Bank Account (Asset), Debit is Deposit (Increase).
    // If mainLine amount is negative, it's a Credit. For a Bank Account (Asset), Credit is Payment (Decrease).
    // Wait, let's standardize:
    // Asset: Debit (+) Increase, Credit (-) Decrease.
    // Liability: Credit (+) Increase, Debit (-) Decrease.

    // Let's assume the requested account is a Bank Account (Asset) or Credit Card (Liability).
    // If Asset: + is Deposit, - is Payment.
    // If Liability: - is Payment (Decrease debt? No, usually Payment to CC increases balance available? Or decreases debt balance?)
    // Let's stick to the "Balance" view.
    // If Balance increases, it's a Deposit (in UI terms).
    // If Balance decreases, it's a Payment.

    // For Asset (Bank): +Amount = Deposit. -Amount = Payment.
    // For Liability (CC): +Amount = Charge (Increase Debt). -Amount = Payment (Decrease Debt).
    // But UI usually shows CC Charges as positive numbers in the "Charge" column?
    // Let's stick to the raw signed amount logic for now and let UI interpret?
    // Or map to "Payment"/"Deposit" strings.

    let type = 'Payment';
    let amount = Math.abs(mainLine.amount);

    if (account.type === 'Asset') {
      if (mainLine.amount > 0) type = 'Deposit';
      else type = 'Payment';
    } else if (account.type === 'Liability') {
      // Credit Card
      // If I buy something, Liability increases (Credit, negative in my signed logic? No, Liability Credit is usually positive in accounting books, but I said "Credit (-) decreases" for Asset.
      // Let's define the signed convention strictly:
      // DEBIT = Positive (+). CREDIT = Negative (-).
      // Asset: Debit (+) Increase. Credit (-) Decrease.
      // Liability: Credit (-) Increase. Debit (+) Decrease.
      // Expense: Debit (+) Increase.
      // Income: Credit (-) Increase.
      // Equity: Credit (-) Increase.

      // So for CC (Liability):
      // Charge $100 (Expense +100 Debit). CC (-100 Credit).
      // So CC line is negative.
      // Payment $100 to CC (Asset -100 Credit). CC (+100 Debit).
      // So CC line is positive.

      if (mainLine.amount < 0) type = 'Payment'; // Charge (Increase Liability) - wait, UI "Payment" usually means Money Out. For CC, a Charge is Money Out (spending).
      // Actually, for CC:
      // "Payment" usually means paying off the card.
      // "Charge" means spending.
      // Let's look at how the UI uses "Payment" vs "Deposit".
      // UI "Payment" -> Money leaving the entity?
      // UI "Deposit" -> Money entering.

      // Let's simplify:
      // If amount < 0 (Credit), it's a "Payment" (Spending/Withdrawal) for Assets.
      // If amount > 0 (Debit), it's a "Deposit" (Income/Deposit) for Assets.

      // For CC:
      // Spending (Charge) = Credit (-). So "Payment".
      // Paying off (Payment) = Debit (+). So "Deposit".

      if (mainLine.amount > 0) type = 'Deposit';
      else type = 'Payment';
    }

    return {
      id: tx.id,
      date: tx.date,
      payee: tx.payee,
      description: tx.description,
      amount: amount,
      type: type,
      accountId: accountId,
      customerId: tx.customerId,
      splits: otherLines.map(l => ({
        chartOfAccountId: l.accountId,
        chartOfAccount: l.account, // Include account details
        amount: Math.abs(l.amount) // UI expects positive split amounts usually?
      }))
    };
  });

  res.json(transformed);
});

app.post('/api/transactions', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { date, payee, description, amount, type, accountId, customerId, splits } = req.body;
  // splits: [{ chartOfAccountId, amount }]

  // Logic to create lines:
  // Main Account Line:
  // If Type == 'Payment' (Money Out):
  //   Asset: Credit (-)
  //   Liability: Credit (-) (Charge)
  // If Type == 'Deposit' (Money In):
  //   Asset: Debit (+)
  //   Liability: Debit (+) (Payment to Account)

  // Split Lines (Categories):
  // If Main is Credit (-), Splits must be Debit (+).
  // If Main is Debit (+), Splits must be Credit (-).

  const mainAccountId = parseInt(accountId);
  const mainAccount = await prisma.account.findUnique({ where: { id: mainAccountId } });
  if (!mainAccount) return res.status(404).json({ error: 'Account not found' });

  let mainAmount = parseFloat(amount);
  // Determine sign for Main Account
  // Default assumption: Payment = Credit (-), Deposit = Debit (+)
  // This works for Assets.
  // For Liabilities (CC): Payment (Charge) = Credit (-), Deposit (Pay off) = Debit (+).
  // So the sign logic is consistent for "Money Flow" direction relative to the account balance in signed terms?
  // Wait.
  // Asset: Debit (+) Increase.
  // Liability: Credit (-) Increase.
  // If I "Deposit" into Bank (Asset), it increases (+).
  // If I "Deposit" into CC (Pay off), it decreases the liability (Debit +).
  // So "Deposit" always means Debit (+).
  // "Payment" always means Credit (-).

  if (type === 'Payment') mainAmount = -Math.abs(mainAmount);
  else mainAmount = Math.abs(mainAmount);

  // Splits must balance the Main Amount.
  // Sum(Splits) = -MainAmount.
  // But we have multiple splits.
  // Each split amount from UI is positive.
  // We need to apply the opposite sign of MainAmount.
  const splitSign = mainAmount > 0 ? -1 : 1;

  try {
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        payee,
        description,
        customerId: customerId ? parseInt(customerId) : null,
        tenantId: req.tenantId,
        lines: {
          create: [
            {
              accountId: mainAccountId,
              amount: mainAmount
            },
            ...splits.map(split => ({
              accountId: parseInt(split.chartOfAccountId),
              amount: parseFloat(split.amount) * splitSign
            }))
          ]
        }
      },
      include: { lines: true }
    });

    // Update Balances
    // We need to update balance for ALL accounts involved.
    // Balance = Sum of all lines? Or incremental update.
    // Incremental is faster.

    // Update Main Account
    await prisma.account.update({
      where: { id: mainAccountId },
      data: { balance: { increment: mainAmount } }
    });

    // Update Split Accounts
    for (const split of splits) {
      await prisma.account.update({
        where: { id: parseInt(split.chartOfAccountId) },
        data: { balance: { increment: parseFloat(split.amount) * splitSign } }
      });
    }

    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.put('/api/transactions/:id', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  const { id } = req.params;
  const { date, payee, description, amount, type, accountId, customerId, splits } = req.body;

  try {
    // 1. Get original transaction lines to revert balances
    const originalTransaction = await prisma.transaction.findFirst({
      where: { id: parseInt(id), tenantId: req.tenantId },
      include: { lines: true }
    });

    if (!originalTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 2. Revert balances
    for (const line of originalTransaction.lines) {
      await prisma.account.update({
        where: { id: line.accountId },
        data: { balance: { decrement: line.amount } } // Decrement by the signed amount to revert
      });
    }

    // 3. Prepare new lines data
    const mainAccountId = parseInt(accountId);
    let mainAmount = parseFloat(amount);
    if (type === 'Payment') mainAmount = -Math.abs(mainAmount);
    else mainAmount = Math.abs(mainAmount);
    const splitSign = mainAmount > 0 ? -1 : 1;

    // 4. Update Transaction (Delete old lines, create new ones)
    const updatedTransaction = await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: {
        date: new Date(date),
        payee,
        description,
        customerId: customerId ? parseInt(customerId) : (customerId === null ? { disconnect: true } : undefined),
        lines: {
          deleteMany: {},
          create: [
            {
              accountId: mainAccountId,
              amount: mainAmount
            },
            ...splits.map(split => ({
              accountId: parseInt(split.chartOfAccountId),
              amount: parseFloat(split.amount) * splitSign
            }))
          ]
        }
      },
      include: { lines: true }
    });

    // 5. Apply new balances
    await prisma.account.update({
      where: { id: mainAccountId },
      data: { balance: { increment: mainAmount } }
    });

    for (const split of splits) {
      await prisma.account.update({
        where: { id: parseInt(split.chartOfAccountId) },
        data: { balance: { increment: parseFloat(split.amount) * splitSign } }
      });
    }

    res.json(updatedTransaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// --- Reports ---
// --- Reports ---
app.get('/api/reports/balance-sheet', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });
  // Assets = Liabilities + Equity

  // Fetch all accounts with balances
  const accounts = await prisma.account.findMany({
    where: { tenantId: req.tenantId }
  });

  const assets = accounts.filter(a => a.type === 'Asset').reduce((sum, acc) => sum + acc.balance, 0);
  const liabilities = accounts.filter(a => a.type === 'Liability').reduce((sum, acc) => sum + acc.balance, 0); // Liabilities usually Credit (-), so this sum might be negative.
  const equity = accounts.filter(a => a.type === 'Equity').reduce((sum, acc) => sum + acc.balance, 0);

  // Net Income (Income - Expenses) should also be part of Equity in a real report, but for now let's just return raw balances.
  // Note: In Double Entry, Assets + Liabilities + Equity + Income + Expenses = 0.
  // So Assets = -(Liabilities + Equity + Income + Expenses).
  // Or Assets - Liabilities - Equity = Net Income.

  res.json({
    assets,
    liabilities: Math.abs(liabilities), // Display as positive
    equity: Math.abs(equity) // Display as positive
  });
});

app.get('/api/reports/profit-loss', verifyToken, async (req, res) => {
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant ID required' });

  // Income vs Expenses
  // Query TransactionLines where Account.type is Income or Expense

  const lines = await prisma.transactionLine.findMany({
    where: {
      account: {
        tenantId: req.tenantId,
        type: { in: ['Income', 'Expense'] }
      }
    },
    include: { account: true }
  });

  let income = 0;
  let expenses = 0;

  lines.forEach(line => {
    // Income is Credit (-), Expense is Debit (+).
    // But we want to display positive numbers.
    if (line.account.type === 'Income') income += Math.abs(line.amount);
    if (line.account.type === 'Expense') expenses += Math.abs(line.amount);
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
