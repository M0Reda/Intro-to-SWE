import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Cart from './cart.jsx';
import SearchInventory from './searchinventory.jsx';

function App() {
  const userId = 'user1';
  const [notFound, setNotFound] = useState(false);

  async function createOrder() {
    const res = await fetch('http://api.localhost/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, items: [{ sku: 'sku-1', qty: 1 }], total: 9.99 })
    });
    const j = await res.json();
    alert('order created: ' + JSON.stringify(j));
  }

  function openCart() {
    const newWindow = window.open('', '_blank', 'width=500,height=500');
    const root = createRoot(newWindow.document.body);
    root.render(<Cart userId={userId} />);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Marketplace demo</h1>
      <button onClick={createOrder}>Create test order</button>
      <button onClick={openCart} style={{ marginLeft: 10 }}>Open Cart</button>

      <div style={{ marginTop: 20 }}>
        <SearchInventory onNotFound={setNotFound} />
        {notFound && <span style={{ color: 'red', marginLeft: 10 }}>Not Found</span>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
