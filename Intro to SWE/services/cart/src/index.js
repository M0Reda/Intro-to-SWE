const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://cart.localhost'],
  credentials: true
}));
app.use(express.json());

console.log('🚨 CART SERVICE: Authentication DISABLED for development');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart', mode: 'dev-no-auth' });
});

// Get cart - NO AUTH
app.get('/cart', async (req, res) => {
  try {
    const userId = 'dev-user';
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.json({ userId, items: [] });
    }
    res.json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});


app.post('/cart', async (req, res) => {
  try {
    const userId = 'dev-user';
    const { sku, qty, name, price } = req.body;
    
    const existing = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    let items = [];
    if (existing.rows.length > 0) {
      items = existing.rows[0].items;
    }
    
    const itemIndex = items.findIndex(item => item.sku === sku);
    if (itemIndex >= 0) {
      items[itemIndex].qty += qty;
    } else {
      items.push({ sku, qty, name, price: parseFloat(price) });  // ← FIX: Convert to number
    }
    
    const result = await pool.query(
      `INSERT INTO cart (user_id, items, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET items = $2, updated_at = NOW()
       RETURNING *`,
      [userId, JSON.stringify(items)]
    );
    
    console.log('✅ Added to cart:', sku);
    res.status(201).json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update quantity - NO AUTH
app.put('/cart/:sku', async (req, res) => {
  try {
    const userId = 'dev-user';
    const { sku } = req.params;
    const { qty } = req.body;
    
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = result.rows[0].items;
    const itemIndex = items.findIndex(item => item.sku === sku);
    if (itemIndex < 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    if (qty <= 0) {
      items.splice(itemIndex, 1);
    } else {
      items[itemIndex].qty = qty;
    }
    
    await pool.query(
      'UPDATE cart SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(items), userId]
    );
    
    res.json({ userId, items });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item - NO AUTH
app.delete('/cart/:sku', async (req, res) => {
  try {
    const userId = 'dev-user';
    const { sku } = req.params;
    
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = result.rows[0].items;
    items = items.filter(item => item.sku !== sku);
    
    await pool.query(
      'UPDATE cart SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(items), userId]
    );
    
    res.json({ userId, items });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear cart - NO AUTH
app.delete('/cart', async (req, res) => {
  try {
    const userId = 'dev-user';
    await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    res.json({ userId, items: [] });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

const PORT = 3005;
app.listen(PORT, () => console.log(`🛒 Cart service running on port ${PORT} (NO AUTH)`));