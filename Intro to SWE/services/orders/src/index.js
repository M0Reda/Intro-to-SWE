const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { publishOrderCreated } = require('./publishOrderEvent');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://api.localhost'],
  credentials: true
}));
app.use(bodyParser.json());

console.log('🚨 ORDERS SERVICE: Authentication DISABLED for development');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders', mode: 'dev-no-auth' });
});

// GET all orders - NO AUTH
app.get('/orders', async (req, res) => {
  try {
    const userId = 'dev-user';
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single order - NO AUTH
app.get('/orders/:id', async (req, res) => {
  try {
    const userId = 'dev-user';
    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2', 
      [req.params.id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /orders - NO AUTH
app.post('/orders', async (req, res) => {
  const { items, total } = req.body;
  const userId = 'dev-user';

  console.log('Creating order for dev-user:', { items, total });

  if (!items || items.length === 0 || !total) {
    return res.status(400).json({ error: 'Missing items or total' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, JSON.stringify(items), total, 'pending']
    );

    const order = result.rows[0];

    // Publish event to RabbitMQ
    await publishOrderCreated({
      id: order.id,
      userId: order.user_id,
      items: order.items,
      total: order.total,
      userEmail: 'dev@example.com'
    });

    await client.query('COMMIT');

    console.log('✅ Order created:', order.id);
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`📦 Orders service running on port ${PORT} (NO AUTH)`));