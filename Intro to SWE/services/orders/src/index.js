const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // <-- added CORS
const { Pool } = require('pg');
const { publishOrderCreated } = require('./publishOrderEvent');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

// Enable CORS for frontend
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// POST /orders
app.post('/orders', async (req, res) => {
  const { userId, items, total } = req.body;

  // DEBUG: log payload
  console.log('POST /orders payload:', req.body);

  // Validate input
  if (!userId || !items || !total) {
    return res.status(400).json({ error: 'Missing userId, items, or total' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, JSON.stringify(items), total, 'pending']
    );

    const order = { id: r.rows[0].id, userId, items, total };

    // Publish event
    await publishOrderCreated(order);

    await client.query('COMMIT');

    res.status(201).json(order);
  } 
  catch (err) {
    await client.query('ROLLBACK');
    console.error('DB Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } 
  finally {
    client.release();
  }
});

app.listen(3000, () => console.log('orders running on 3000'));
