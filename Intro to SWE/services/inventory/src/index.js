const amqp = require('amqplib');
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
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
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://inventory.localhost'],
  credentials: true
}));
app.use(express.json());

// Initialize Keycloak on startup
keycloak.init().catch(err => console.error('Keycloak init error:', err));

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory' });
});

// Search inventory (public with optional auth)
app.get('/inventory/search', keycloak.optionalAuth(), async (req, res) => {
  try {
    const q = req.query.q || '';
    const result = await pool.query(
      'SELECT * FROM inventory WHERE sku ILIKE $1 OR name ILIKE $1 ORDER BY name', 
      [`%${q}%`]
    );
    
    if (req.user) {
      console.log(`User ${req.user.preferred_username} searched for: ${q}`);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Inventory search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single item (public with optional auth)
app.get('/inventory/:sku', keycloak.optionalAuth(), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE sku = $1', [req.params.sku]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3004;
app.listen(PORT, () => console.log(`Inventory API running on port ${PORT}`));

// ----------------- RabbitMQ consumer -----------------
async function startConsumer() {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const ch = await conn.createChannel();
    const exchange = 'marketplace.events';
    await ch.assertExchange(exchange, 'topic', { durable: true });
    const q = await ch.assertQueue('', { exclusive: true });
    await ch.bindQueue(q.queue, exchange, 'order.created');

    console.log('Inventory service listening for order events...');

    ch.consume(q.queue, async (msg) => {
      const order = JSON.parse(msg.content.toString());
      console.log('Inventory received order:', order.id);
      
      try {
        for (const item of order.items) {
          const sku = item.sku;
          const qty = item.qty || 1;
          
          const result = await pool.query(
            'UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2 AND quantity >= $1 RETURNING *',
            [qty, sku]
          );
          
          if (result.rowCount === 0) {
            console.error(`Insufficient inventory for ${sku}`);
            // In production, you'd want to handle this better (e.g., cancel order)
          } else {
            console.log(`Updated inventory for ${sku}: -${qty}`);
          }
        }
        ch.ack(msg);
      } catch (err) {
        console.error('Inventory processing failed:', err);
        ch.nack(msg, false, false);
      }
    }, { noAck: false });
  } catch (err) {
    console.error('Failed to start RabbitMQ consumer:', err);
    setTimeout(startConsumer, 5000); // Retry after 5 seconds
  }
}

// Start consumer after a short delay to ensure RabbitMQ is ready
setTimeout(startConsumer, 3000);