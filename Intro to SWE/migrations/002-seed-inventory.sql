-- Seed inventory with sample products
-- This runs automatically when postgres container first starts

INSERT INTO inventory (sku, name, quantity, price) VALUES
  ('LAPTOP-001', 'Gaming Laptop Pro', 15, 1299.99),
  ('LAPTOP-002', 'Business Laptop Ultra', 20, 899.99),
  ('PHONE-001', 'Smartphone X', 50, 699.99),
  ('PHONE-002', 'Smartphone Plus', 30, 899.99),
  ('TABLET-001', 'Tablet Pro 12', 25, 599.99),
  ('TABLET-002', 'Tablet Mini', 40, 399.99),
  ('WATCH-001', 'Smart Watch Elite', 60, 349.99),
  ('WATCH-002', 'Fitness Watch', 45, 199.99),
  ('HEADPHONE-001', 'Wireless Headphones Pro', 100, 249.99),
  ('HEADPHONE-002', 'Noise Cancelling Buds', 80, 179.99),
  ('KEYBOARD-001', 'Mechanical Keyboard RGB', 35, 129.99),
  ('MOUSE-001', 'Gaming Mouse Pro', 55, 79.99),
  ('MONITOR-001', '4K Monitor 27"', 18, 449.99),
  ('MONITOR-002', 'Curved Gaming Monitor 32"', 12, 599.99),
  ('CAMERA-001', 'Webcam HD Pro', 40, 89.99),
  ('SPEAKER-001', 'Bluetooth Speaker', 65, 59.99),
  ('CHARGER-001', 'Fast Charger 65W', 120, 29.99),
  ('CABLE-001', 'USB-C Cable 6ft', 200, 14.99),
  ('CASE-001', 'Laptop Sleeve 15"', 75, 24.99),
  ('CASE-002', 'Phone Case Premium', 150, 19.99)
ON CONFLICT (sku) DO NOTHING;

-- Display summary
SELECT 'Seeded ' || COUNT(*) || ' products into inventory' AS result FROM inventory;