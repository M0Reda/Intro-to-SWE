const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for frontend
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json());

// Example in-memory cart (replace with DB later)
const carts = {};

// Get user cart
app.get('/cart/:userId', (req, res) => {
  const userId = req.params.userId;
  const cart = carts[userId] || [];
  res.json({ userId, items: cart });
});

// Add item to cart
app.post('/cart/:userId', (req, res) => {
  const userId = req.params.userId;
  const { sku, qty } = req.body;
  if (!carts[userId]) carts[userId] = [];
  carts[userId].push({ sku, qty });
  res.status(201).json({ userId, items: carts[userId] });
});

app.listen(3004, () => console.log('cart running on 3004'));
