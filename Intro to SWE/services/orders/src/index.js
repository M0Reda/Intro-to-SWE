const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { publishOrderCreated } = require('./publishOrderEvent');
const KeycloakAuth = require('../shared/keycloakAuth');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

// Initialize Keycloak
const keycloak = new KeycloakAuth(
  process.env.KEYCLOAK_URL || 'http://keycloak:8080',
  process.env.KEYCLOAK_REALM || 'marketplace'
);

// Enable CORS for frontend - allow both localhost and traefik domains
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://api.localhost'],
  credentials: true
}));
app.use(bodyParser.json());

// Initialize Keycloak on startup
keycloak.init().catch(err => console.error('Keycloak init error:', err));

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders' });
});

// GET all orders (for a user or all) - PROTECTED
app.get('/orders', keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    
    // Only allow users to see their own orders unless admin
    const query = 'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC';
    const params = [userId];
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single order - PROTECTED
app.get('/orders/:id', keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
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

// POST /orders - PROTECTED
app.post('/orders', keycloak.middleware(), async (req, res) => {
  const { items, total } = req.body;
  const userId = req.user.sub || req.user.preferred_username;

  console.log('POST /orders payload:', req.body);
  console.log('Authenticated user:', userId);

  // Validate input
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
      userEmail: req.user.email
    });

    await client.query('COMMIT');

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
app.listen(PORT, () => console.log(`Orders service running on port ${PORT}`));