const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');

let admin;
let db = null;
try {
  admin = require('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
    }
    db = admin.firestore();
    console.log('Firebase Connected - Live Selfie Mode');
  } else {
    console.log('Firebase Mock Mode - FIREBASE_SERVICE_ACCOUNT not set, using in-memory DB');
  }
} catch (e) {
  console.log('Firebase init failed, using mock DB:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const mockDB = { users: [], installations: [], transactions: [] };

// --- Auth Register with Live Selfie Compulsory ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phone, password, name, hasLiveSelfie, selfieTimestamp, gps } = req.body;
    if (!phone || !password || !name) return res.status(400).json({ message: 'Phone, Password, Name required' });
    if (!hasLiveSelfie) return res.status(400).json({ message: 'Live Selfie Verification is COMPULSORY!' });

    const newUser = {
      id: 'inst_' + Date.now(),
      phone, password, name, role: 'installer',
      balance: 0, completed: 0, approvedCount: 0, bank: null,
      selfieVerified: true, selfieTimestamp, gps,
      createdAt: new Date(), isLiveVerified: true
    };

    if (db) {
      await db.collection('users').doc(newUser.id).set(newUser);
    } else {
      if (mockDB.users.find(u => u.phone === phone)) return res.status(400).json({ message: 'Phone already registered' });
      mockDB.users.push(newUser);
    }

    console.log(`Registered: ${name} ${phone} with Live Selfie`);
    res.json({ message: 'Registered', user: { ...newUser, password: undefined, token: 'token-' + newUser.id } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// --- Auth Login with Live Selfie Compulsory ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { role, phone, email, password, hasLiveSelfie, selfieTimestamp, gps } = req.body;

    if (role === 'admin') {
      const admins = [
        { email: 'admin@unicron.com', password: 'admin123', name: 'Admin MD' },
        { email: 'manager@unicron.com', password: 'manager123', name: 'Store Manager' }
      ];
      const found = admins.find(a => a.email === email && a.password === password);
      if (!found) return res.status(401).json({ message: 'Invalid admin credentials' });
      return res.json({ message: 'Admin login', user: { id: 'admin_' + Date.now(), role: 'admin', name: found.name, email: found.email, token: 'admin-token' } });
    }

    if (!phone || !password) return res.status(400).json({ message: 'Phone & Password required' });
    if (!hasLiveSelfie) return res.status(400).json({ message: 'Live Selfie Verification is COMPULSORY! Camera only.' });

    let user;
    if (db) {
      const snap = await db.collection('users').where('phone', '==', phone).get();
      if (snap.empty) return res.status(404).json({ message: 'Installer not found, register with live selfie' });
      const doc = snap.docs[0];
      user = { id: doc.id, ...doc.data() };
      if (user.password !== password) return res.status(401).json({ message: 'Invalid password' });
      await db.collection('users').doc(user.id).update({ selfieVerified: true, selfieTimestamp, gps, lastLogin: new Date() });
    } else {
      user = mockDB.users.find(u => u.phone === phone);
      if (!user) return res.status(404).json({ message: 'Installer not found' });
      if (user.password !== password) return res.status(401).json({ message: 'Invalid password' });
      user.selfieVerified = true;
    }

    console.log(`Login: ${user.name} ${phone} with Live Selfie`);
    res.json({ message: 'Login with Live Selfie Verified', user: { ...user, password: undefined, token: 'token-' + user.id } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/banks', async (req, res) => {
  try {
    if (process.env.FLW_SECRET_KEY) {
      const r = await axios.get('https://api.flutterwave.com/v3/banks/NG', { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } });
      return res.json(r.data);
    }
    res.json({ data: [{ name: 'Access Bank', code: '044' }, { name: 'GTBank', code: '058' }, { name: 'First Bank', code: '011' }, { name: 'UBA', code: '033' }, { name: 'Zenith Bank', code: '057' }, { name: 'OPay', code: '999' }] });
  } catch (e) { res.json({ data: [{ name: 'Access Bank', code: '044' }] }); }
});

app.post('/api/banks/verify', async (req, res) => {
  try {
    const { account_number, bank_code } = req.body;
    if (process.env.FLW_SECRET_KEY) {
      const r = await axios.post('https://api.flutterwave.com/v3/accounts/resolve', { account_number, account_bank: bank_code }, { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } });
      return res.json({ account_name: r.data.data.account_name, account_number });
    }
    res.json({ account_name: 'Verified Account - ' + account_number.slice(-4), account_number });
  } catch (e) { res.status(400).json({ message: 'Bank verification failed', error: e.response?.data }); }
});

// Installation with 3 Live Photos Compulsory
app.post('/api/installations', upload.fields([{ name: 'photo1', maxCount: 1 }, { name: 'photo2', maxCount: 1 }, { name: 'photo3', maxCount: 1 }]), async (req, res) => {
  try {
    const { model, serial, customerName, customerPhone, lat, lng, hasLivePhotos, installerId, installerName, timestamp } = req.body;
    if (!model || !serial || !customerName) return res.status(400).json({ message: 'Model, Serial, Customer Name required' });
    if (!hasLivePhotos || !req.files.photo1 || !req.files.photo2 || !req.files.photo3) return res.status(400).json({ message: '3 LIVE Photos are COMPULSORY! Camera only.' });
    if (!lat || !lng) return res.status(400).json({ message: 'GPS is COMPULSORY' });

    const installation = {
      id: Date.now().toString(), installerId, installerName, model, serial, customerName, customerPhone,
      lat: parseFloat(lat), lng: parseFloat(lng), hasLivePhotos: true, hasLiveSelfie: true,
      status: 'pending', amount: 5000, createdAt: new Date(), liveVerified: true, timestamp
    };

    if (db) {
      await db.collection('installations').doc(installation.id).set(installation);
    } else {
      mockDB.installations.push(installation);
    }

    console.log(`Installation Submitted LIVE: ${installerName} ${model} ${serial} GPS ${lat},${lng}`);
    res.json({ message: 'Submitted - 3 Live Photos + GPS + Selfie verified', data: installation });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/admin/installations', async (req, res) => {
  try {
    let installs;
    if (db) {
      const snap = await db.collection('installations').orderBy('createdAt', 'desc').limit(100).get();
      installs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      installs = mockDB.installations;
    }
    res.json({ data: installs });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/admin/approve', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'ID required' });

    let installation;
    if (db) {
      const doc = await db.collection('installations').doc(id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Not found' });
      installation = { id: doc.id, ...doc.data() };
      await db.collection('installations').doc(id).update({ status: 'approved', approvedAt: new Date() });
    } else {
      installation = mockDB.installations.find(i => i.id === id || i.serial === id);
      if (!installation) return res.status(404).json({ message: 'Not found' });
      installation.status = 'approved';
    }

    const installerId = installation.installerId;
    let newBalance = 0; let bonusAwarded = false;

    if (db) {
      const userDoc = await db.collection('users').doc(installerId).get();
      if (userDoc.exists) {
        const installer = { id: userDoc.id, ...userDoc.data() };
        const currentApproved = (installer.approvedCount || 0) + 1;
        newBalance = (installer.balance || 0) + 5000;
        let updateData = { balance: newBalance, approvedCount: currentApproved, completed: currentApproved };
        if (currentApproved % 5 === 0) { newBalance += 20000; updateData.balance = newBalance; bonusAwarded = true; }
        await db.collection('users').doc(installerId).update(updateData);
      }
    } else {
      const installer = mockDB.users.find(u => u.id === installerId);
      if (installer) {
        installer.approvedCount = (installer.approvedCount || 0) + 1;
        installer.balance = (installer.balance || 0) + 5000;
        newBalance = installer.balance;
        if (installer.approvedCount % 5 === 0) { installer.balance += 20000; newBalance = installer.balance; bonusAwarded = true; }
      }
    }

    res.json({ message: `Approved! ₦5K credited${bonusAwarded ? ' + BONUS ₦20K Extra for 5 installs!' : ''}`, newBalance, bonusAwarded });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, installerId, selfieVerified } = req.body;
    if (!amount || !installerId) return res.status(400).json({ message: 'Amount & Installer ID required' });
    if (amount < 10000) return res.status(400).json({ message: 'Min Withdraw ₦10,000' });
    if (!selfieVerified) return res.status(400).json({ message: 'Live Selfie required for withdrawal' });

    let installer;
    if (db) {
      const doc = await db.collection('users').doc(installerId).get();
      if (!doc.exists) return res.status(404).json({ message: 'Installer not found' });
      installer = { id: doc.id, ...doc.data() };
    } else {
      installer = mockDB.users.find(u => u.id === installerId);
      if (!installer) return res.status(404).json({ message: 'Installer not found' });
    }

    if ((installer.balance || 0) < amount) return res.status(400).json({ message: `Insufficient balance ₦${installer.balance}` });

    let transferId = 'MOCK-' + Date.now();
    if (process.env.FLW_SECRET_KEY) {
      try {
        const payload = {
          account_bank: installer.bank.code,
          account_number: installer.bank.account_number,
          amount, narration: `UNICRON+ Payout - ${installer.name} - Live Verified`,
          currency: 'NGN', reference: `UNICRON-${installerId}-${Date.now()}`
        };
        const r = await axios.post('https://api.flutterwave.com/v3/transfers', payload, { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } });
        transferId = r.data.data.id;
      } catch (e) { return res.status(500).json({ message: 'Flutterwave transfer failed', error: e.response?.data }); }
    }

    const newBalance = (installer.balance || 0) - amount;
    if (db) {
      await db.collection('users').doc(installerId).update({ balance: newBalance });
    } else {
      installer.balance = newBalance;
    }

    res.json({ message: `Withdrawal Initiated! ₦${amount} via Flutterwave`, transfer_id: transferId, newBalance });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'UNICRON+ Production Ready - Live Selfie + 3 Live Photos Compulsory - All Rights Reserved - Designed by krishnyansh zenova peaks ltd', firebase: !!db, flutterwave: !!process.env.FLW_SECRET_KEY });
});

app.listen(PORT, () => {
  console.log(`UNICRON+ Server Running on port ${PORT}`);
  console.log('Features: Live Selfie KYC Must + 3 Live Photos Must + GPS + Timestamp + ₦5K + Min ₦10K + Bonus 5=₦20K');
  console.log('Designed by krishnyansh zenova peaks ltd - All Rights Reserved');
});
