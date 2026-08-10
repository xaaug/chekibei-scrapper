import React, { useState, useEffect } from "react";

export function PriceComparison({ defaultQuery = "milk" }) {
  const [query, setQuery] = useState(defaultQuery);
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchComparisons = async (term) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/compare?search=${encodeURIComponent(term)}`);
      const data = await resp.json();
      setComparisons(data.comparisons || []);
    } catch (err) {
      console.error("Error fetching price comparison:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisons(query);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="apple-card" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="text"
          className="apple-input"
          placeholder="Compare price for product (e.g. Flour, Milk, Sugar)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchComparisons(query)}
        />
        <button className="apple-button apple-button-primary" onClick={() => fetchComparisons(query)}>
          Compare Prices
        </button>
      </div>

      {loading ? (
        <div className="apple-card" style={{ padding: "30px", textAlign: "center", opacity: 0.6 }}>
          Comparing prices across Kenyan stores...
        </div>
      ) : comparisons.length === 0 ? (
        <div className="apple-card" style={{ padding: "30px", textAlign: "center", opacity: 0.6 }}>
          No comparison results for '{query}'. Try running a live Scrapling crawl first!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {comparisons.map((c, idx) => (
            <div key={idx} className="apple-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{c.display_name}</h3>
                {c.cheapest_store && (
                  <span
                    style={{
                      background: "rgba(52, 199, 89, 0.15)",
                      color: "var(--accent-green)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 600
                    }}
                  >
                    🏆 Lowest at {c.cheapest_store.toUpperCase()} (KES {c.lowest_price})
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                {["quickmart", "naivas", "carrefour"].map((storeKey) => {
                  const p = c.stores[storeKey];
                  const isLowest = c.cheapest_store === storeKey;
                  return (
                    <div
                      key={storeKey}
                      style={{
                        background: isLowest ? "rgba(0, 113, 227, 0.05)" : "var(--bg-secondary)",
                        border: isLowest ? "1px solid var(--accent-blue)" : "1px solid var(--apple-border)",
                        borderRadius: "10px",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px"
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.6, textTransform: "uppercase" }}>
                        {storeKey}
                      </span>
                      {p ? (
                        <>
                          <span style={{ fontWeight: 700, fontSize: "1rem", color: isLowest ? "var(--accent-blue)" : "var(--text-primary)" }}>
                            KES {p.price ? p.price.toLocaleString() : "N/A"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: "0.8rem", opacity: 0.4, fontStyle: "italic" }}>Not Available</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
