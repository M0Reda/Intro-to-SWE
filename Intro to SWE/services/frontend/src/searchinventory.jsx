import React, { useState, useEffect } from 'react';

export default function SearchInventory({ onAddToCart, apiUrl = 'http://localhost:3004' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);

  // Load all items on mount
  useEffect(() => {
    loadAllItems();
  }, []);

  const loadAllItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/inventory/search?q=`);
      const data = await res.json();
      setAllItems(data);
      setResults(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    try {
      setLoading(true);
      setSearched(true);
      const res = await fetch(`${apiUrl}/inventory/search?q=${query}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  return (
    <div className="inventory-search">
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search products by SKU or name..."
          className="search-input"
        />
        <button 
          onClick={search} 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searched && results.length === 0 && (
        <div className="no-results">
          No products found matching "{query}"
        </div>
      )}

      {results.length > 0 && (
        <div className="inventory-grid">
          {results.map(item => (
            <div key={item.id} className="inventory-card">
              <div className="inventory-card-header">
                <h3>{item.name}</h3>
                <span className="inventory-sku">SKU: {item.sku}</span>
              </div>
              <div className="inventory-card-body">
                <div className="inventory-info">
                  <span className="inventory-price">${parseFloat(item.price).toFixed(2)}</span>
                  <span className={`inventory-stock ${item.quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                    {item.quantity > 0 ? `${item.quantity} in stock` : 'Out of stock'}
                  </span>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => onAddToCart(item)}
                  disabled={item.quantity === 0}
                >
                  {item.quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}