import React, { useState } from "react";

export function ProductCatalog({ products, selectedStore, searchQuery, setSearchQuery, onRefresh }) {
  const [sortBy, setSortBy] = useState("default");

  let filtered = products.filter((p) => {
    if (selectedStore !== "all" && p.supermarket !== selectedStore) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (sortBy === "price_asc") {
    filtered = [...filtered].sort((a, b) => (a.price || 99999) - (b.price || 99999));
  } else if (sortBy === "price_desc") {
    filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  const getStoreClass = (sm) => {
    switch (sm) {
      case "quickmart": return "store-quickmart";
      case "naivas": return "store-naivas";
      case "carrefour": return "store-carrefour";
      default: return "store-all";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="apple-card" style={{ padding: "14px 20px", display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            className="apple-input"
            placeholder="Search catalog products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="apple-input"
          style={{ width: "180px" }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="default">Sort by Recent</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>

        <button className="apple-button" style={{ border: "1px solid var(--apple-border)" }} onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="apple-card" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "8px" }}>No items found in catalog</p>
          <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Try adjusting your search query or trigger a live Scrapling crawl to populate items.
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((p, idx) => (
            <div key={idx} className="apple-card product-card">
              <div className="product-img-container">
                <span className={`product-store-tag ${getStoreClass(p.supermarket)}`}>
                  {p.supermarket}
                </span>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: "2rem", opacity: 0.3 }}>🛒</span>
                )}
              </div>

              <div className="product-title" title={p.name}>
                {p.name}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "auto" }}>
                <div className="product-price">
                  {p.price ? `KES ${p.price.toLocaleString()}` : "Price N/A"}
                </div>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "0.8rem", color: "var(--accent-blue)", textDecoration: "none" }}
                  >
                    View Store ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
