#!/usr/bin/env node

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgres://marketplace:marketplace@localhost:5432/marketplace'
});

const sampleInventory = [
  { sku: 'LAPTOP-001', name: 'Gaming Laptop Pro', quantity: 15, price: 1299.99 },
  { sku: 'LAPTOP-002', name: 'Business Laptop Ultra', quantity: 20, price: 899.99 },
  { sku: 'PHONE-001', name: 'Smartphone X', quantity: 50, price: 699.99 },
  { sku: 'PHONE-002', name: 'Smartphone Plus', quantity: 30, price: 899.99 },
  { sku: 'TABLET-001', name: 'Tablet Pro 12', quantity: 25, price: 599.99 },
  { sku: 'TABLET-002', name: 'Tablet Mini', quantity: 40, price: 399.99 },
  { sku: 'WATCH-001', name: 'Smart Watch Elite', quantity: 60, price: 349.99 },
  { sku: 'WATCH-002', name: 'Fitness Watch', quantity: 45, price: 199.99 },
  { sku: 'HEADPHONE-001', name: 'Wireless Headphones Pro', quantity: 100, price: 249.99 },
  { sku: 'HEADPHONE-002', name: 'Noise Cancelling Buds', quantity: 80, price: 179.99 },
  { sku: 'KEYBOARD-001', name: 'Mechanical Keyboard RGB', quantity: 35, price: 129.99 },
  { sku: 'MOUSE-001', name: 'Gaming Mouse Pro', quantity: 55, price: 79.99 },
  { sku: 'MONITOR-001', name: '4K Monitor 27"', quantity: 18, price: 449.99 },
  { sku: 'MONITOR-002', name: 'Curved Gaming Monitor 32"', quantity: 12, price: 599.99 },
  { sku: 'CAMERA-001', name: 'Webcam HD Pro', quantity: 40, price: 89.99 },
  { sku: 'SPEAKER-001', name: 'Bluetooth Speaker', quantity: 65, price: 59.99 },
  { sku: 'CHARGER-001', name: 'Fast Charger 65W', quantity: 120, price: 29.99 },
  { sku: 'CABLE-001', name: 'USB-C Cable 6ft', quantity: 200, price: 14.99 },
  { sku: 'CASE-001', name: 'Laptop Sleeve 15"', quantity: 75, price: 24.99 },
  { sku: 'CASE-002', name: 'Phone Case Premium', quantity: 150, price: 19.99 }
];

async function seedDatabase() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Clear existing inventory
    await client.query('DELETE FROM inventory');
    console.log('Cleared existing inventory');

    // Insert sample data
    for (const item of sampleInventory) {
      await client.query(
        'INSERT INTO inventory (sku, name, quantity, price) VALUES ($1, $2, $3, $4)',
        [item.sku, item.name, item.quantity, item.price]
      );
      console.log(`Added: ${item.name}`);
    }

    console.log(`\n✅ Successfully seeded ${sampleInventory.length} items to the database!`);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedDatabase();