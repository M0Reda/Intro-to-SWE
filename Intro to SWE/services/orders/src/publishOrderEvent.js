const amqp = require('amqplib');

async function publishEvent(routingKey, data) {
  let conn, ch;
  try {
    conn = await amqp.connect(process.env.RABBITMQ_URL);
    ch = await conn.createChannel();
    const exchange = 'marketplace.events';
    
    await ch.assertExchange(exchange, 'topic', { durable: true });
    ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(data)), { 
      persistent: true 
    });
    
    console.log(`📤 Published ${routingKey} event:`, data.id);
    
    setTimeout(() => { 
      ch.close(); 
      conn.close(); 
    }, 500);
  } catch (err) {
    console.error(`Failed to publish ${routingKey} event:`, err.message);
    if (ch) await ch.close();
    if (conn) await conn.close();
  }
}

async function publishOrderCreated(order) {
  await publishEvent('order.created', order);
}

async function publishOrderCompleted(order) {
  await publishEvent('order.completed', order);
}

async function publishOrderCancelled(order) {
  await publishEvent('order.cancelled', order);
}

module.exports = { 
  publishOrderCreated,
  publishOrderCompleted,
  publishOrderCancelled
};