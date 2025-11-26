const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin if not already (it might be initialized in server, but this is a standalone script)
// Actually, we can't easily mint tokens without client SDK or custom token minting.
// We'll use custom tokens and exchange them? No, that requires client SDK.
// For this test, we might need to mock the auth middleware or use a backdoor.
// OR, we can just use the `admin.auth().createCustomToken(uid)` and then exchange it for ID token?
// Exchanging custom token for ID token requires calling Firebase Auth REST API.

const API_KEY = 'YOUR_WEB_API_KEY'; // We need web API key to exchange custom token. 
// Since we don't have it easily, let's try a different approach.
// We can modify the server to accept a special header for testing? No, unsafe.

// Let's assume we can just use the `verifyToken` middleware to mock user if we run server in test mode?
// Or better, let's just use the existing `npm run dev` and try to hit it.
// But we need valid ID tokens.

// Alternative: We can use the `firebase-admin` to generate a custom token, 
// but we need to exchange it. 
// Let's try to find the Web API Key in `client/src/firebase.js`.

const fs = require('fs');
const path = require('path');

async function getApiKey() {
    const envPath = path.join(__dirname, '../../client/.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/VITE_FIREBASE_API_KEY=(.*)/);
        if (match) return match[1].trim();
    }
    return null;
}

async function getIdToken(uid, apiKey) {
    const customToken = await admin.auth().createCustomToken(uid);
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: customToken,
            returnSecureToken: true
        })
    });
    const data = await res.json();
    return data.idToken;
}

async function apiRequest(endpoint, method, token, tenantId, body) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    if (tenantId) headers['X-Tenant-ID'] = tenantId.toString();

    const res = await fetch(`http://localhost:3001/api${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 204) return null;

    const text = await res.text();
    try {
        const data = JSON.parse(text);
        if (!res.ok) throw { response: { status: res.status, data } };
        return { data };
    } catch (e) {
        if (!res.ok) throw { response: { status: res.status, data: text } };
        throw e;
    }
}

async function run() {
    // Init Admin
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
        console.error("Could not find API Key");
        return;
    }

    const userA = 'userA_' + Date.now();
    const userB = 'userB_' + Date.now();
    const emailA = `${userA}@test.com`;
    const emailB = `${userB}@test.com`;

    try {
        console.log("Creating users in Firebase...");
        try {
            await admin.auth().createUser({ uid: userA, email: emailA });
            await admin.auth().createUser({ uid: userB, email: emailB });
        } catch (e) {
            console.log("Users might already exist, continuing...");
        }

        console.log("Getting tokens...");
        const tokenA = await getIdToken(userA, apiKey);
        const tokenB = await getIdToken(userB, apiKey);

        // 1. User A creates Tenant A
        console.log("User A creating Tenant A...");
        const resTenantA = await apiRequest('/tenants', 'POST', tokenA, null, { name: 'Tenant A' });
        const tenantAId = resTenantA.data.id;
        console.log("Tenant A ID:", tenantAId);

        // 2. User B creates Tenant B
        console.log("User B creating Tenant B...");
        const resTenantB = await apiRequest('/tenants', 'POST', tokenB, null, { name: 'Tenant B' });
        const tenantBId = resTenantB.data.id;
        console.log("Tenant B ID:", tenantBId);

        // 3. User A creates Account in Tenant A
        console.log("User A creating Account in Tenant A...");
        await apiRequest('/accounts', 'POST', tokenA, tenantAId, { name: 'Bank A', type: 'Bank', balance: 1000 });

        // 4. User B tries to read accounts in Tenant A (Should fail)
        console.log("User B trying to read Tenant A accounts (Expect 403)...");
        try {
            await apiRequest('/accounts', 'GET', tokenB, tenantAId);
            console.error("FAIL: User B should not access Tenant A");
        } catch (e) {
            if (e.response && e.response.status === 403) {
                console.log("PASS: User B denied access to Tenant A");
            } else {
                console.error("FAIL: Unexpected error", e);
            }
        }

        // 5. User A adds User B to Tenant A
        // We need User B's email. Since we used random UID, we didn't set email in Firebase Auth (createCustomToken doesn't set email in DB unless we create user first).
        // But our backend creates user from token email. `createCustomToken` allows setting claims but not email directly in the token payload standard fields unless we pass additional claims?
        // Actually, `verifyIdToken` returns the email if it exists in the user record.
        // Let's create the users in Firebase first? Or just mock email in claims?
        // Our backend uses `decodedToken.email`.
        // We can pass `{ email: ... }` as second arg to createCustomToken (developer claims), but `verifyIdToken` puts them in `claims`.
        // Standard `email` comes from user record.

        // Let's create users in Firebase Auth first.
        /*
        await admin.auth().createUser({ uid: userA, email: `${userA}@test.com` });
        await admin.auth().createUser({ uid: userB, email: `${userB}@test.com` });
        */
        // But we need to clean them up.

        // Simpler: Just rely on the fact that we can't easily test "Add User" without real emails.
        // But we can test isolation.

        // Let's verify User B can create account in Tenant B and User A can't see it.
        console.log("User B creating Account in Tenant B...");
        await apiRequest('/accounts', 'POST', tokenB, tenantBId, { name: 'Bank B', type: 'Bank', balance: 500 });

        console.log("User A reading Tenant A accounts...");
        const resAccountsA = await apiRequest('/accounts', 'GET', tokenA, tenantAId);
        console.log("User A sees:", resAccountsA.data.map(a => a.name));
        if (resAccountsA.data.length === 1 && resAccountsA.data[0].name === 'Bank A') {
            console.log("PASS: User A sees correct data");
        } else {
            console.log("FAIL: User A sees wrong data");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

run();
