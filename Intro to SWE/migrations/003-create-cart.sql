CREATE TABLE IF NOT EXISTS cart (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
