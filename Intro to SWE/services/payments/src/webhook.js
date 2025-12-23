const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const paypal = require('@paypal/checkout-server-sdk');

// PayPal environment (sandbox)
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

const app = express();
app.use(bodyParser.json());

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
