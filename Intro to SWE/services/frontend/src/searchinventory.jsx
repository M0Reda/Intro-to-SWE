import React, { useState } from 'react';

export default function SearchInventory() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false); // track if a search has been done

  const search = async () => {
    const res = await fetch(`http://inventory.localhost/inventory/search?q=${query}`);
    const data = await res.json();
    setResults(data);
    setSearched(true); // mark that a search happened
  };

  return (
    <div>
      <h2>Inventory Search</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search SKU..."
      />
      <button onClick={search} style={{ marginLeft: 5 }}>Search</button>

      {/* Show "Not found" if search done and no results */}
      {searched && results.length === 0 && (
        <span style={{ color: 'red', marginLeft: 10 }}>Not found</span>
      )}

      <ul>
        {results.map(item => (
          <li key={item.id}>{item.sku} - Qty: {item.quantity}</li>
        ))}
      </ul>
    </div>
  );
}
