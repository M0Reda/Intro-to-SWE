// services/inventory/src/index.js
const amqp = require('amqplib');
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

// Enable CORS for your frontend
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json());

// ----------------- HTTP API -----------------
app.get('/inventory/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const r = await pool.query('SELECT * FROM inventory WHERE sku ILIKE $1', [`%${q}%`]);
    res.json(r.rows);
  } catch (err) {
    console.error('Inventory search error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3004, () => console.log('Inventory API running on 3004'));

// ----------------- RabbitMQ consumer -----------------
async function startConsumer() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  const exchange = 'marketplace.events';
  await ch.assertExchange(exchange, 'topic', { durable: true });
  const q = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(q.queue, exchange, 'order.created');

  ch.consume(q.queue, async (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log('Inventory received order', order.id);
    try {
      for (const item of order.items) {
        const sku = item.sku;
        const qty = item.qty || 1;
        await pool.query('UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2', [qty, sku]);
      }
      ch.ack(msg);
    } catch (err) {
      console.error('inventory processing failed', err);
      ch.nack(msg, false, false); // drop or handle retry logic
    }
  }, { noAck: false });
}

startConsumer().catch(err => { 
  console.error(err); 
  process.exit(1); 
});
