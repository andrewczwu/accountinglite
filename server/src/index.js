const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');

const verifyToken = require('./middleware/auth');

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production: Use environment variable
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    // Development: Use local file
    try {
      const serviceAccount = require('../serviceAccountKey.json');
      credential = admin.credential.cert(serviceAccount);
    } catch (error) {
      console.error('Error loading serviceAccountKey.json:', error);
    }
  }

  if (credential) {
    admin.initializeApp({ credential });
  }
}

const app = express();
const port = process.env.PORT || 3001;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Restrict to frontend
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/tenants', verifyToken, require('./routes/tenants'));
app.use('/api/accounts', verifyToken, require('./routes/accounts'));
app.use('/api/chart-of-accounts', verifyToken, require('./routes/chartOfAccounts'));
app.use('/api/customers', verifyToken, require('./routes/customers'));
app.use('/api/transactions', verifyToken, require('./routes/transactions'));
app.use('/api/reports', verifyToken, require('./routes/reports'));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
