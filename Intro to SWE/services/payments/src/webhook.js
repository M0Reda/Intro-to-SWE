const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const amqp = require('amqplib');

const app = express();

app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://payments.localhost'],
  credentials: true
}));
app.use(bodyParser.json());

console.log('🚨 PAYMENTS SERVICE: MOCK MODE - No real PayPal charges');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payments', mode: 'mock' });
});

// Create payment - MOCK
app.post('/payments/create', async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || !orderId) {
      return res.status(400).json({ error: 'Missing amount or orderId' });
    }

    console.log('🎭 MOCK: Creating payment:', { amount, orderId });

    // Generate fake PayPal order ID
    const mockPaymentId = 'MOCK-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    res.json({
      paymentId: mockPaymentId,
      status: 'CREATED',
      links: [
        {
          rel: 'approve',
          href: 'http://mock-paypal.com/approve/' + mockPaymentId
        }
      ]
    });
  } catch (err) {
    console.error('Mock payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Capture payment - MOCK
app.post('/payments/:paymentId/capture', async (req, res) => {
  try {
    const { paymentId } = req.params;

    console.log('🎭 MOCK: Capturing payment:', paymentId);

    // Simulate successful payment
    setTimeout(async () => {
      try {
        // Publish payment success event
        const conn = await amqp.connect(process.env.RABBITMQ_URL);
        const ch = await conn.createChannel();
        const exchange = 'marketplace.events';
        await ch.assertExchange(exchange, 'topic', { durable: true });
        
        ch.publish(
          exchange, 
          'payment.succeeded', 
          Buffer.from(JSON.stringify({
            paymentId,
            userId: 'dev-user',
            status: 'COMPLETED',
            amount: '100.00'
          })),
          { persistent: true }
        );
        
        setTimeout(() => { ch.close(); conn.close(); }, 500);
        console.log('✅ MOCK: Payment event published');
      } catch (err) {
        console.error('Failed to publish payment event:', err);
      }
    }, 100);

    res.json({
      paymentId: paymentId,
      status: 'COMPLETED',
      captureId: 'CAPTURE-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    });
  } catch (err) {
    console.error('Mock capture error:', err);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

// Webhook (no-op in mock mode)
app.post('/webhook', async (req, res) => {
  console.log('🎭 MOCK: Webhook received (ignored)');
  res.status(200).send('OK');
});

app.listen(3002, () => console.log('💳 MOCK Payment service running on 3002'));