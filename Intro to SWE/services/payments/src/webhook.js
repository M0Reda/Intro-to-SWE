const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const amqp = require('amqplib');
const paypal = require('@paypal/checkout-server-sdk');
const KeycloakAuth = require('../shared/keycloakAuth');

// PayPal environment (sandbox)
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID || 'your-client-id',
  process.env.PAYPAL_CLIENT_SECRET || 'your-client-secret'
);
const paypalClient = new paypal.core.PayPalHttpClient(environment);

const app = express();

// Initialize Keycloak
const keycloak = new KeycloakAuth(
  process.env.KEYCLOAK_URL || 'http://keycloak:8080',
  process.env.KEYCLOAK_REALM || 'marketplace'
);

// Enable CORS
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://payments.localhost'],
  credentials: true
}));
app.use(bodyParser.json());

// Initialize Keycloak on startup
keycloak.init().catch(err => console.error('Keycloak init error:', err));

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payments' });
});

// Create payment intent - PROTECTED
app.post('/payments/create', keycloak.middleware(), async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    const userId = req.user.sub || req.user.preferred_username;

    if (!amount || !orderId) {
      return res.status(400).json({ error: 'Missing amount or orderId' });
    }

    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId.toString(),
        amount: {
          currency_code: 'USD',
          value: parseFloat(amount).toFixed(2)
        }
      }],
      application_context: {
        brand_name: 'Marketplace',
        user_action: 'PAY_NOW',
        return_url: 'http://app.localhost/payment/success',
        cancel_url: 'http://app.localhost/payment/cancel'
      }
    });

    const order = await paypalClient.execute(request);

    res.json({
      paymentId: order.result.id,
      status: order.result.status,
      links: order.result.links
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Capture payment - PROTECTED
app.post('/payments/:paymentId/capture', keycloak.middleware(), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.sub || req.user.preferred_username;

    const request = new paypal.orders.OrdersCaptureRequest(paymentId);
    request.requestBody({});

    const capture = await paypalClient.execute(request);

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
        userId,
        status: capture.result.status,
        amount: capture.result.purchase_units[0].amount.value
      })),
      { persistent: true }
    );
    
    setTimeout(() => { ch.close(); conn.close(); }, 500);

    res.json({
      paymentId: capture.result.id,
      status: capture.result.status,
      captureId: capture.result.purchase_units[0].payments.captures[0].id
    });
  } catch (err) {
    console.error('Capture payment error:', err);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

// PayPal webhook (public - validated by PayPal)
app.post('/webhook', async (req, res) => {
  try {
    const event = req.body;

    // Handle completed payments
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderData = event.resource;

      const conn = await amqp.connect(process.env.RABBITMQ_URL);
      const ch = await conn.createChannel();
      const exchange = 'marketplace.events';
      await ch.assertExchange(exchange, 'topic', { durable: true });
      ch.publish(exchange, 'payment.succeeded', Buffer.from(JSON.stringify(orderData)));
      setTimeout(() => { ch.close(); conn.close(); }, 300);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('PayPal webhook error', err);
    res.status(400).send('error');
  }
});

app.listen(3002, () => console.log('PayPal payments running on 3002'));