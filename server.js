const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Firebase Init
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Connected - UNICRON Production");
} catch (e) {
  console.log("Firebase init error:", e.message);
}

// Static frontend
app.use(express.static(path.join(__dirname)));

// In-memory DB for now (Replace with Firestore for FINAL production)
let mockDB = {
  installers: [],
  installations: [],
  nextId: 2223
};

// Multer for photos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ===== AUTH - FIXED PASSWORD CHECK =====

// REGISTER - With password save
app.post('/api/register', (req, res) => {
  const { name, phone, password, city } = req.body;
  
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password required!" });
  }
  
  if (password.length < 4) {
    return res.status(400).json({ error: "Password min 4 chars!" });
  }
  
  const exists = mockDB.installers.find(i => i.phone === phone);
  if (exists) {
    return res.status(400).json({ error: "Phone already registered! Login karo" });
  }
  
  const newInstaller = {
    id: mockDB.nextId++,
    name: name || "Installer " + mockDB.nextId,
    phone,
    password, // In production use bcrypt.hash
    city: city || "",
    balance: 0,
    totalInstallations: 0,
    bank: null,
    selfieVerified: true,
    createdAt: new Date().toISOString()
  };
  
  mockDB.installers.push(newInstaller);
  console.log(`✅ New Installer Registered: ${newInstaller.id} - ${phone}`);
  res.json({ success: true, installer: newInstaller });
});

// LOGIN - FIXED WITH REAL PASSWORD CHECK
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  
  console.log(`Login attempt: ${phone}`);
  
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password both required!" });
  }
  
  const installer = mockDB.installers.find(i => i.phone === phone);
  
  if (!installer) {
    return res.status(404).json({ error: "Installer not found! Register first" });
  }
  
  // REAL PASSWORD CHECK - This was missing!
  if (installer.password !== password) {
    console.log(`❌ Wrong password for ${phone}`);
    return res.status(401).json({ error: "Wrong password! Try again" });
  }
  
  console.log(`✅ Login success: ${installer.id}`);
  res.json({ success: true, installer });
});

// Verify Bank - Flutterwave
app.post('/api/verify-bank', async (req, res) => {
  const { account_number, account_bank } = req.body;
  
  try {
    const response = await axios.post('https://api.flutterwave.com/v3/accounts/resolve', 
      { account_number, account_bank },
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );
    
    res.json({ success: true, account_name: response.data.data.account_name });
  } catch (e) {
    res.status(400).json({ error: "Bank verify failed! Check number", details: e.response?.data });
  }
});

// Submit Installation - 3 photos + GPS
app.post('/api/submit-installation', upload.array('photos', 3), (req, res) => {
  const { installerId, model, serialNo, customerName, customerPhone, gps, barcodeConfirmed } = req.body;
  
  const installer = mockDB.installers.find(i => i.id == installerId);
  if (!installer) {
    return res.status(404).json({ error: "Installer not found! Login again" });
  }
  
  // Serial validation - 13 digits
  const serialPattern = /^(260434\d{7}|2604\d{9})$/;
  if (!serialPattern.test(serialNo)) {
    return res.status(400).json({ error: "Invalid Serial! Must be 13 digits starting 260434 or 2604" });
  }
  
  if (!barcodeConfirmed || barcodeConfirmed === 'false') {
    return res.status(400).json({ error: "Barcode confirmation required!" });
  }
  
  if (!req.files || req.files.length < 3) {
    return res.status(400).json({ error: "3 LIVE photos compulsory!" });
  }
  
  // Photo difference check (simple)
  if (req.files[0].buffer.equals(req.files[1].buffer) || req.files[1].buffer.equals(req.files[2].buffer)) {
    return res.status(400).json({ error: "3 photos must be different!" });
  }
  
  const newInstallation = {
    id: Date.now(),
    installerId: installer.id,
    model,
    serialNo,
    customerName,
    customerPhone,
    gps,
    photos: req.files.length,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  mockDB.installations.push(newInstallation);
  console.log(`📸 New Installation: ${newInstallation.id} by ${installerId}`);
  res.json({ success: true, installation: newInstallation });
});

// Admin - Get all
app.get('/api/admin/installations', (req, res) => {
  res.json({ installations: mockDB.installations, installers: mockDB.installers });
});

// Admin - Approve + Add money + Bonus
app.post('/api/admin/approve/:id', (req, res) => {
  const inst = mockDB.installations.find(i => i.id == req.params.id);
  if (!inst) return res.status(404).json({ error: "Installation not found" });
  
  if (inst.status === 'approved') {
    return res.status(400).json({ error: "Already approved!" });
  }
  
  inst.status = 'approved';
  const installer = mockDB.installers.find(i => i.id == inst.installerId);
  
  if (installer) {
    installer.balance += 5000;
    installer.totalInstallations += 1;
    
    // Bonus every 5th
    if (installer.totalInstallations % 5 === 0) {
      installer.balance += 20000;
      console.log(`🎉 Bonus N20K for Installer ${installer.id} - 5 installations!`);
    }
  }
  
  console.log(`✅ Approved: ${inst.id} - Installer ${inst.installerId} new balance ${installer?.balance}`);
  res.json({ success: true, installation: inst, installer });
});

// WITHDRAW - REAL Flutterwave (Not demo)
app.post('/api/withdraw', async (req, res) => {
  const { installerId, amount, bank } = req.body;
  
  console.log(`💸 Withdraw request: Installer ${installerId} - N${amount}`);
  
  const installer = mockDB.installers.find(i => i.id == installerId);
  if (!installer) {
    console.log(`❌ Installer ${installerId} not found in mockDB - DB reset?`);
    return res.status(404).json({ 
      error: "Installer not found", 
      possible: ["Flutterwave wallet balance 0", "Transfers not enabled", "Bank wrong", "Or mockDB reset - Register again"],
      check: "Check Render Logs! Balance NOT deducted"
    });
  }
  
  if (installer.balance < amount) {
    return res.status(400).json({ error: `Insufficient balance! You have N${installer.balance}` });
  }
  
  if (amount < 10000) {
    return res.status(400).json({ error: "Min withdraw N10,000!" });
  }
  
  if (!bank || !bank.account_number || !bank.account_bank) {
    return res.status(400).json({ error: "Bank not set! Verify bank first" });
  }
  
  try {
    // REAL Flutterwave Transfer
    const response = await axios.post('https://api.flutterwave.com/v3/transfers',
      {
        account_bank: bank.account_bank,
        account_number: bank.account_number,
        amount: amount,
        currency: "NGN",
        beneficiary_name: bank.account_name || installer.name,
        reference: `UNICRON-${installerId}-${Date.now()}`,
        callback_url: "https://webhook.site",
        debit_currency: "NGN"
      },
      {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
      }
    );
    
    // Only deduct if Flutterwave success
    installer.balance -= amount;
    
    console.log(`✅ REAL Transfer success: ${response.data.data.id} - N${amount} to ${bank.account_number}`);
    
    res.json({ 
      success: true, 
      message: `REAL N${amount} sent to ${bank.account_number}!`,
      transfer_id: response.data.data.id,
      new_balance: installer.balance
    });
    
  } catch (e) {
    const errMsg = e.response?.data?.message || e.message;
    console.log(`❌ Flutterwave transfer failed: ${errMsg}`);
    
    res.status(400).json({ 
      error: "REAL Withdraw Failed!",
      details: errMsg,
      flutterwave_error: e.response?.data,
      possible: ["1. Flutterwave wallet balance 0", "2. Transfers not enabled", "3. Bank wrong"],
      check: "Check Render Logs! Balance NOT deducted"
    });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for PWA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 UNICRON Backend running on port ${PORT}`);
  console.log(`📦 mockDB Installers: ${mockDB.installers.length}`);
});
