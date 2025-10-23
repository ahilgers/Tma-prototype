// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// In-memory stores (prototype only)
const users = {}; // key: email
const transactions = []; // escrow transactions
const flaggedBVNs = new Set();

// Helper
function generateId(prefix='id') {
return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// Mock signup + BVN verification
app.post('/api/signup', (req, res) => {
const { name, email, phone, password, bvn } = req.body;
if (!name || !email || !bvn) return res.status(400).json({ error: 'Missing fields' });

if (flaggedBVNs.has(bvn)) {
return res.status(403).json({ error: 'This BVN is flagged for fraud' });
}

// Simple BVN mock: accept 10-11 digit numeric bvn
const isBVNValid = /^[0-9]{10,11}$/.test(bvn);
if (!isBVNValid) return res.status(400).json({ error: 'Invalid BVN format' });

if (users[email]) return res.status(409).json({ error: 'User already exists'});

users[email] = {
id: generateId('u'),
name, email, phone, password: password||'',
bvn, verified: true, wallet: 125000, // prefill wallet for demo
role: 'user'
};

res.json({ ok: true, user: { name, email, wallet: users[email].wallet } });
});

// Simple login
app.post('/api/login', (req, res) => {
const { email } = req.body;
const user = users[email];
if (!user) return res.status(404).json({ error: 'User not found' });
res.json({ ok: true, user: { name: user.name, email: user.email, wallet: user.wallet }});
});

// Create Transaction (escrow)
app.post('/api/transactions', (req, res) => {
const { buyerEmail, sellerName, amount, description } = req.body;
if (!buyerEmail || !amount) return res.status(400).json({ error: 'Missing fields' });
const buyer = users[buyerEmail];
if (!buyer) return res.status(404).json({ error: 'Buyer not found' });
// For prototype: don't deduct wallet now, this is escrow
const tx = {
id: generateId('tx'),
buyerEmail,
sellerName: sellerName || 'Unknown Seller',
amount: Number(amount),
description: description || '',
status: 'holding', // holding, released, refund_requested, refunded, disputed
createdAt: Date.now(),
};
transactions.push(tx);
res.json({ ok: true, tx });
});

// List transactions for user
app.get('/api/transactions/:email', (req, res) => {
const email = req.params.email;
const userTx = transactions.filter(t => t.buyerEmail === email);
res.json({ ok: true, transactions: userTx });
});

// Confirm delivery -> release funds
app.post('/api/transactions/:id/confirm', (req, res) => {
const id = req.params.id;
const tx = transactions.find(t => t.id === id);
if (!tx) return res.status(404).json({ error: 'Transaction not found' });
if (tx.status !== 'holding') return res.status(400).json({ error: 'Cannot confirm' });

// Simulate releasing funds to seller: add to buyer? in prototype, we simulate
tx.status = 'released';
tx.releasedAt = Date.now();

// For demo: deduct nothing from buyer (wallet was prefill), but we can deduct if desired
res.json({ ok: true, tx });
});

// Request refund
app.post('/api/transactions/:id/refund', (req, res) => {
const id = req.params.id;
const { reason } = req.body;
const tx = transactions.find(t => t.id === id);
if (!tx) return res.status(404).json({ error: 'Transaction not found' });
if (tx.status !== 'holding' && tx.status !== 'released') {
return res.status(400).json({ error: 'Refund not allowed at this stage' });
}
tx.status = 'refund_requested';
tx.refundReason = reason || '';
res.json({ ok: true, tx });
});

// Admin endpoint: review refunds & decide (prototype)
app.post('/api/admin/review', (req, res) => {
const { txId, action } = req.body; // action: approve_refund | deny_refund | flag_bvn
const tx = transactions.find(t => t.id === txId);
if (!tx) return res.status(404).json({ error: 'Transaction not found' });

if (action === 'approve_refund') {
tx.status = 'refunded';
tx.refundedAt = Date.now();
// Optionally, credit buyer wallet in real app
return res.json({ ok: true, tx });
} else if (action === 'deny_refund') {
tx.status = 'released';
return res.json({ ok: true, tx });
} else if (action === 'flag_bvn') {
// flag buyer BVN
const buyer = users[tx.buyerEmail];
if (buyer) {
flaggedBVNs.add(buyer.bvn);
return res.json({ ok: true, flagged: buyer.bvn });
}
return res.status(404).json({ error: 'Buyer not found' });
} else {
return res.status(400).json({ error: 'Invalid action' });
}
});

// Support messages (simple push)
const supportMessages = [];
app.post('/api/support', (req, res) => {
const { email, message } = req.body;
const id = generateId('s');
supportMessages.push({ id, email, message, ts: Date.now() });
res.json({ ok: true, id });
});

app.get('/api/debug/transactions', (req, res) => {
res.json({ transactions, users: Object.keys(users).length, flaggedBVNs: Array.from(flaggedBVNs) });
});

// Start server
app.listen(PORT, () => {
console.log(`TMA prototype server running on http://localhost:${PORT}`);
});
