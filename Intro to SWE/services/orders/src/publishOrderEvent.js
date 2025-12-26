const amqp = require('amqplib');

async function publishOrderCreated(order) {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  const exchange = 'marketplace.events';
  await ch.assertExchange(exchange, 'topic', { durable: true });
  ch.publish(exchange, 'order.created', Buffer.from(JSON.stringify(order)), { persistent: true });
  setTimeout(() => { ch.close(); conn.close(); }, 500);
}

module.exports = { publishOrderCreated };