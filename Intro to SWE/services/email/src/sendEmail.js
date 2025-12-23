const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  auth: { user: process.env.SMTP_USER || 'user', pass: process.env.SMTP_PASS || 'pass' }
});

async function start() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  const exchange = 'marketplace.events';
  await ch.assertExchange(exchange, 'topic', { durable: true });
  const q = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(q.queue, exchange, 'order.confirmed');

  ch.consume(q.queue, async (msg) => {
    try {
      const data = JSON.parse(msg.content.toString());
      await transport.sendMail({
        from: 'noreply@marketplace.local',
        to: data.userEmail || 'user@example.com',
        subject: 'Order update',
        text: 'Your order status: ' + (data.status || 'unknown')
      });
      ch.ack(msg);
    } catch (err) {
      console.error('email error', err);
      ch.nack(msg, false, false);
    }
  });
}

start().catch(err => { console.error(err); process.exit(1); });