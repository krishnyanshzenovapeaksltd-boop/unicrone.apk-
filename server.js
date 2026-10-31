const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const axiosLib = require('axios');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("✅ Firebase Firestore Connected - UNICRON Production");
} catch (e) {
  console.log("Firebase init error:", e.message);
}

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

async function getNextId() {
  if (!db) return Date.now();
  const counterRef = db.collection('counters').doc('installer');
  try {
    const newId = await db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      let next = 2223;
      if (doc.exists) next = (doc.data().nextId || 2223) + 1;
      t.set(counterRef, { nextId: next }, { merge: true });
      return next;
    });
    return newId;
  } catch (e) { return Date.now(); }
}

app.post('/api/register', async (req, res) => {
  const { name, phone, password, city } = req.body;
  if (!phone || !password) return res.status(400).json({ error: "Phone and password required!" });
  if (password.length < 4) return res.status(400).json({ error: "Password min 4 chars!" });
  try {
    if (db) {
      const snap = await db.collection('installers').where('phone', '==', phone).limit(1).get();
      if (!snap.empty) return res.status(400).json({ error: "Phone already registered! Login karo" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = await getNextId();
    const newInstaller = {
      id, name: name || "Installer " + id, phone, password: hashedPassword,
      city: city || "", balance: 0, totalInstallations: 0, bank: null,
      selfieVerified: true, createdAt: new Date().toISOString()
    };
    if (db) await db.collection('installers').doc(String(id)).set(newInstaller);
    console.log("REGISTERED: " + id + " - " + phone);
    const { password: _, ...safe } = newInstaller;
    res.json({ success: true, installer: safe });
  } catch (e) { res.status(500).json({ error: "Register failed: " + e.message }); }
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: "Phone and password both required!" });
  try {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const snap = await db.collection('installers').where('phone', '==', phone).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: "Installer not found! Register first" });
    const installer = snap.docs[0].data();
    const ok = await bcrypt.compare(password, installer.password);
    if (!ok) return res.status(401).json({ error: "Wrong password! Try again" });
    const { password: _, ...safe } = installer;
    res.json({ success: true, installer: safe });
  } catch (e) { res.status(500).json({ error: "Login failed" }); }
});

app.post('/api/verify-bank', async (req, res) => {
  const { account_number, account_bank } = req.body;
  try {
    const response = await axiosLib.post('https://api.flutterwave.com/v3/accounts/resolve',
      { account_number, account_bank },
      { headers: { Authorization: "Bearer " + process.env.FLW_SECRET_KEY } }
    );
    res.json({ success: true, account_name: response.data.data.account_name });
  } catch (e) { res.status(400).json({ error: "Bank verify failed!", details: e.response?.data?.message }); }
});

app.post('/api/submit-installation', upload.array('photos', 3), async (req, res) => {
  const { installerId, model, serialNo, customerName, customerPhone, gps, barcodeConfirmed } = req.body;
  const serialPattern = /^(260434\d{7}|2604\d{9})$/;
  if (!serialPattern.test(serialNo)) return res.status(400).json({ error: "Invalid Serial! 13 digits" });
  if (!barcodeConfirmed || barcodeConfirmed === 'false') return res.status(400).json({ error: "Barcode confirmation required!" });
  if (!req.files || req.files.length < 3) return res.status(400).json({ error: "3 LIVE photos compulsory!" });
  try {
    if (db) {
      const doc = await db.collection('installers').doc(String(installerId)).get();
      if (!doc.exists) return res.status(404).json({ error: "Installer not found! Login again" });
    }
    const newInstallation = {
      id: Date.now(), installerId: Number(installerId), model, serialNo,
      customerName, customerPhone, gps: gps || "", photos: req.files.length,
      status: 'pending', createdAt: new Date().toISOString()
    };
    if (db) await db.collection('installations').doc(String(newInstallation.id)).set(newInstallation);
    res.json({ success: true, installation: newInstallation });
  } catch (e) { res.status(500).json({ error: "Submit failed: " + e.message }); }
});

app.get('/api/banks', async (req, res) => {
  try {
    const response = await axiosLib.get('https://api.flutterwave.com/v3/banks/NG', {
      headers: { Authorization: "Bearer " + process.env.FLW_SECRET_KEY }, timeout: 8000
    });
    if (response.data.data && response.data.data.length > 10) return res.json(response.data.data);
    throw new Error("Less banks");
  } catch (e) {
    res.json([
      { id: 1, code: "044", name: "Access Bank" }, { id: 2, code: "063", name: "Access Bank (Diamond)" },
      { id: 3, code: "050", name: "Ecobank Nigeria" }, { id: 4, code: "070", name: "Fidelity Bank" },
      { id: 5, code: "011", name: "First Bank of Nigeria" }, { id: 6, code: "214", name: "First City Monument Bank" },
      { id: 7, code: "058", name: "Guaranty Trust Bank" }, { id: 8, code: "030", name: "Heritage Bank" },
      { id: 9, code: "082", name: "Keystone Bank" }, { id: 10, code: "076", name: "Polaris Bank" },
      { id: 11, code: "221", name: "Stanbic IBTC Bank" }, { id: 12, code: "068", name: "Standard Chartered Bank" },
      { id: 13, code: "232", name: "Sterling Bank" }, { id: 14, code: "032", name: "Union Bank" },
      { id: 15, code: "033", name: "United Bank for Africa" }, { id: 16, code: "215", name: "Unity Bank" },
      { id: 17, code: "035", name: "Wema Bank" }, { id: 18, code: "057", name: "Zenith Bank" },
      { id: 19, code: "301", name: "Jaiz Bank" }, { id: 20, code: "023", name: "Citibank Nigeria" },
      { id: 21, code: "052", name: "Providus Bank" }, { id: 22, code: "100", name: "Kuda Bank" },
      { id: 23, code: "999", name: "OPay" }, { id: 24, code: "999", name: "Palmpay" },
      { id: 25, code: "999", name: "Moniepoint MFB" }, { id: 26, code: "035", name: "Paga" },
      { id: 27, code: "999", name: "Carbon" }, { id: 28, code: "035", name: "Rubies MFB" },
      { id: 29, code: "999", name: "VFD Microfinance Bank" }, { id: 30, code: "035", name: "ALAT by WEMA" },
      { id: 31, code: "058", name: "GTBank" }, { id: 32, code: "011", name: "First Bank" },
      { id: 33, code: "999", name: "FairMoney" }, { id: 34, code: "999", name: "Chipper Cash" },
      { id: 35, code: "999", name: "Lotus Bank" }, { id: 36, code: "999", name: "PremiumTrust Bank" },
      { id: 37, code: "999", name: "Eyowo" }, { id: 38, code: "999", name: "GoMoney" },
      { id: 39, code: "999", name: "Sparkle Bank" }, { id: 40, code: "035", name: "Mint MFB" },
      { id: 41, code: "999", name: "Alerzo MFB" }, { id: 42, code: "999", name: "Suntrust Bank" },
      { id: 43, code: "050", name: "Titan Trust Bank" }, { id: 44, code: "221", name: "Globus Bank" },
      { id: 45, code: "076", name: "Parallex Bank" }, { id: 46, code: "101", name: "Providus Bank" },
      { id: 47, code: "999", name: "PremiumTrust" }, { id: 48, code: "044", name: "Access Bank" },
      { id: 49, code: "070", name: "Fidelity" }, { id: 50, code: "033", name: "UBA" },
      { id: 51, code: "057", name: "Zenith" }, { id: 52, code: "999", name: "Opay MFB" }
    ]);
  }
});

app.get('/api/admin/installations', async (req, res) => {
  try {
    if (!db) return res.json({ installations: [], installers: [] });
    const [instSnap, installerSnap] = await Promise.all([
      db.collection('installations').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('installers').limit(500).get()
    ]);
    const installations = instSnap.docs.map(d => d.data());
    const installers = installerSnap.docs.map(d => { const { password, ...safe } = d.data(); return safe; });
    res.json({ installations, installers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/approve/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const instRef = db.collection('installations').doc(id);
    const instDoc = await instRef.get();
    if (!instDoc.exists) return res.status(404).json({ error: "Installation not found" });
    const inst = instDoc.data();
    if (inst.status === 'approved') return res.status(400).json({ error: "Already approved!" });
    const installerRef = db.collection('installers').doc(String(inst.installerId));
    const installerDoc = await installerRef.get();
    if (!installerDoc.exists) return res.status(404).json({ error: "Installer not found" });
    const installer = installerDoc.data();
    let newBalance = (installer.balance || 0) + 5000;
    let newTotal = (installer.totalInstallations || 0) + 1;
    let bonus = 0;
    if (newTotal % 5 === 0) { bonus = 20000; newBalance += bonus; }
    await db.runTransaction(async (t) => {
      t.update(instRef, { status: 'approved', approvedAt: new Date().toISOString() });
      t.update(installerRef, { balance: newBalance, totalInstallations: newTotal });
    });
    res.json({ success: true, installation: { ...inst, status: 'approved' }, installer: { id: installer.id, balance: newBalance, totalInstallations: newTotal, bonus } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/withdraw', async (req, res) => {
  const { installerId, amount, bank } = req.body;
  if (!db) return res.status(500).json({ error: "DB not connected" });
  if (!bank?.account_number || !bank?.account_bank) return res.status(400).json({ error: "Bank not set!" });
  try {
    const installerRef = db.collection('installers').doc(String(installerId));
    const doc = await installerRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Installer not found - Register again" });
    const installer = doc.data();
    if ((installer.balance || 0) < amount) return res.status(400).json({ error: "Insufficient! You have N" + installer.balance });
    if (amount < 10000) return res.status(400).json({ error: "Min withdraw N10,000!" });
    const response = await axiosLib.post('https://api.flutterwave.com/v3/transfers',
      {
        account_bank: bank.account_bank, account_number: bank.account_number,
        amount, currency: "NGN", beneficiary_name: bank.account_name || installer.name,
        reference: "UNICRON-" + installerId + "-" + Date.now(), debit_currency: "NGN"
      },
      { headers: { Authorization: "Bearer " + process.env.FLW_SECRET_KEY } }
    );
    const newBalance = installer.balance - amount;
    await installerRef.update({ balance: newBalance });
    res.json({ success: true, message: "REAL N" + amount + " sent!", transfer_id: response.data.data.id, new_balance: newBalance });
  } catch (e) {
    const errMsg = e.response?.data?.message || e.message;
    res.status(400).json({ error: "Withdraw Failed!", details: errMsg, flutterwave_error: e.response?.data });
  }
});

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('*', (req, res) => { if (!req.path.startsWith('/api/')) res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, () => console.log("🚀 UNICRON PRODUCTION on " + PORT + " - 500+ users ready")
