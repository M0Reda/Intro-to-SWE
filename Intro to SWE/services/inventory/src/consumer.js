const amqp = require('amqplib');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function startConsumer() {
  try {
    console.log('📦 Inventory Consumer: Connecting to RabbitMQ...');
    
    // Wait for RabbitMQ to be ready
    let connection;
    let retries = 10;
    while (retries > 0) {
      try {
        connection = await amqp.connect(process.env.RABBITMQ_URL);
        break;
      } catch (err) {
        retries--;
        console.log(`RabbitMQ not ready, retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (!connection) {
      throw new Error('Failed to connect to RabbitMQ');
    }

    const channel = await connection.createChannel();
    const exchange = 'marketplace.events';
    const queue = 'inventory.order.created';

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, 'order.created');

    console.log('✅ Inventory Consumer: Waiting for order.created events...');

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const order = JSON.parse(msg.content.toString());
          console.log(`📦 Received order.created event for order #${order.id}`);
          
          await processOrderInventory(order);
          
          channel.ack(msg);
          console.log(`✅ Inventory updated for order #${order.id}`);
        } catch (err) {
          console.error('❌ Error processing order:', err);
          // Reject and don't requeue - send to dead letter queue or log
          channel.nack(msg, false, false);
        }
      }
    });

    // Handle connection closure
    connection.on('close', () => {
      console.error('❌ RabbitMQ connection closed, reconnecting...');
      setTimeout(startConsumer, 5000);
    });

  } catch (err) {
    console.error('❌ Inventory Consumer error:', err);
    setTimeout(startConsumer, 5000);
  }
}

async function processOrderInventory(order) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Process each item in the order
    for (const item of order.items) {
      const { sku, qty } = item;
      
      // Check current inventory
      const result = await client.query(
        'SELECT quantity FROM inventory WHERE sku = $1 FOR UPDATE',
        [sku]
      );

      if (result.rows.length === 0) {
        throw new Error(`Product ${sku} not found in inventory`);
      }

      const currentQty = result.rows[0].quantity;
      
      if (currentQty < qty) {
        throw new Error(`Insufficient stock for ${sku}. Available: ${currentQty}, Requested: ${qty}`);
      }

      // Decrement inventory
      await client.query(
        'UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2',
        [qty, sku]
      );

      console.log(`   ✓ Decremented ${qty} units of ${sku} (${currentQty} → ${currentQty - qty})`);
    }

    await client.query('COMMIT');
    console.log(`✅ Inventory updated successfully for order #${order.id}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to update inventory for order #${order.id}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Start the consumer
startConsumer();

module.exports = { startConsumer };