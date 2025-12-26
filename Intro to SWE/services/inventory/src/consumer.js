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
    
    // Queue for order completion (deduct inventory)
    const completedQueue = 'inventory.order.completed';
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(completedQueue, { durable: true });
    await channel.bindQueue(completedQueue, exchange, 'order.completed');
    
    // Queue for order cancellation (restore inventory)
    const cancelledQueue = 'inventory.order.cancelled';
    await channel.assertQueue(cancelledQueue, { durable: true });
    await channel.bindQueue(cancelledQueue, exchange, 'order.cancelled');

    console.log('✅ Inventory Consumer: Listening for events...');
    console.log('   - order.completed: will deduct inventory');
    console.log('   - order.cancelled: will restore inventory');

    // Handle order.completed events
    channel.consume(completedQueue, async (msg) => {
      if (msg !== null) {
        try {
          const order = JSON.parse(msg.content.toString());
          console.log(`📦 Received order.completed event for order #${order.id}`);
          
          await deductInventory(order);
          
          channel.ack(msg);
          console.log(`✅ Inventory deducted for order #${order.id}`);
        } catch (err) {
          console.error('❌ Error processing order.completed:', err);
          channel.nack(msg, false, false);
        }
      }
    });

    // Handle order.cancelled events
    channel.consume(cancelledQueue, async (msg) => {
      if (msg !== null) {
        try {
          const order = JSON.parse(msg.content.toString());
          console.log(`📦 Received order.cancelled event for order #${order.id}`);
          
          await restoreInventory(order);
          
          channel.ack(msg);
          console.log(`✅ Inventory restored for order #${order.id}`);
        } catch (err) {
          console.error('❌ Error processing order.cancelled:', err);
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

async function deductInventory(order) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

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

      console.log(`   ✓ Deducted ${qty} units of ${sku} (${currentQty} → ${currentQty - qty})`);
    }

    await client.query('COMMIT');
    console.log(`✅ Inventory deducted successfully for order #${order.id}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to deduct inventory for order #${order.id}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function restoreInventory(order) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const item of order.items) {
      const { sku, qty } = item;
      
      // Add inventory back
      const result = await client.query(
        'UPDATE inventory SET quantity = quantity + $1 WHERE sku = $2 RETURNING quantity',
        [qty, sku]
      );

      if (result.rows.length === 0) {
        console.warn(`⚠️ Product ${sku} not found, cannot restore inventory`);
        continue;
      }

      const newQty = result.rows[0].quantity;
      console.log(`   ✓ Restored ${qty} units of ${sku} (new quantity: ${newQty})`);
    }

    await client.query('COMMIT');
    console.log(`✅ Inventory restored successfully for order #${order.id}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to restore inventory for order #${order.id}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Start the consumer
startConsumer();

module.exports = { startConsumer };