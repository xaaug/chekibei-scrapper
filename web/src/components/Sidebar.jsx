import React from "react";

export function Sidebar({ selectedStore, setSelectedStore, storeStats, onQuickScrape }) {
  const stores = [
    { id: "all", name: "All Supermarkets", color: "store-all", count: storeStats?.all || 0 },
    { id: "quickmart", name: "Quickmart Kenya", color: "store-quickmart", count: storeStats?.quickmart || 0 },
    { id: "naivas", name: "Naivas Online", color: "store-naivas", count: storeStats?.naivas || 0 },
    { id: "carrefour", name: "Carrefour Kenya", color: "store-carrefour", count: storeStats?.carrefour || 0 },
  ];

  return (
    <aside className="sidebar">
      <div className="apple-card">
        <h3 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Target Supermarkets
        </h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {stores.map((s) => (
            <div
              key={s.id}
              className={`store-option ${selectedStore === s.id ? "selected" : ""}`}
              onClick={() => setSelectedStore(s.id)}
              style={{ flexDirection: "row", justifyContent: "space-between", padding: "10px 14px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`store-badge ${s.color}`}></span>
                <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{s.name}</span>
              </div>
              <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{s.count} items</span>
            </div>
          ))}
        </div>
      </div>

      <div className="apple-card">
        <h3 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Quick Auto Scrape
        </h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-tertiary)", marginBottom: "12px" }}>
          Trigger instant Scrapling crawl across Kenyan stores for essential commodities:
        </p>
        <div className="pill-group">
          {["Flour", "Milk", "Rice", "Sugar", "Cooking Oil", "Bread", "Eggs", "Tea"].map((cat) => (
            <button
              key={cat}
              className="category-pill"
              onClick={() => onQuickScrape(cat)}
            >
              ⚡ Scrape {cat}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
