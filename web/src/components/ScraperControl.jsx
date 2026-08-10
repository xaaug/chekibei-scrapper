import React, { useState, useEffect } from "react";

export function ScraperControl({ initialQuery = "milk", onScrapeComplete }) {
  const [store, setStore] = useState("all");
  const [query, setQuery] = useState(initialQuery);
  const [maxPages, setMaxPages] = useState(1);
  const [isScraping, setIsScraping] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [liveProducts, setLiveProducts] = useState([]);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleStartScrape = async () => {
    if (!query.trim()) return;
    setIsScraping(true);
    setLogs([`[System] Initializing Scrapling crawl for ${store.toUpperCase()} ('${query}')...`]);
    setLiveProducts([]);

    try {
      const resp = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supermarket: store, query, max_pages: maxPages })
      });
      const data = await resp.json();
      setActiveJobId(data.job_id);

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/scrape/stream/${data.job_id}`);
      
      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.log) {
          setLogs((prev) => [...prev, payload.log]);
        }
        if (payload.products) {
          setLiveProducts(payload.products);
        }
        if (payload.done) {
          eventSource.close();
          setIsScraping(false);
          if (onScrapeComplete) onScrapeComplete();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsScraping(false);
      };
    } catch (err) {
      setLogs((prev) => [...prev, `[ERROR] Failed to launch scraper: ${err.message}`]);
      setIsScraping(false);
    }
  };

  return (
    <div className="apple-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Scrapling Engine Controller</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Execute automated, stealth scraping jobs directly from your browser.
          </p>
        </div>
        {isScraping && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-blue)", fontSize: "0.85rem", fontWeight: 500 }}>
            <span className="dot dot-yellow" style={{ animation: "pulse 1s infinite" }}></span>
            Crawl In Progress...
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "center" }}>
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
            Target Store
          </label>
          <select
            className="apple-input"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            disabled={isScraping}
          >
            <option value="all">All Kenyan Supermarkets</option>
            <option value="quickmart">Quickmart Kenya</option>
            <option value="naivas">Naivas Online</option>
            <option value="carrefour">Carrefour Kenya</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
            Product Search Keyword
          </label>
          <input
            type="text"
            className="apple-input"
            placeholder="e.g. Rice, Sugar, Milk, Maize Flour"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isScraping}
            onKeyDown={(e) => e.key === "Enter" && handleStartScrape()}
          />
        </div>

        <div style={{ alignSelf: "flex-end" }}>
          <button
            className="apple-button apple-button-primary"
            onClick={handleStartScrape}
            disabled={isScraping || !query.trim()}
          >
            {isScraping ? "Scraping..." : "⚡ Run Scrapling"}
          </button>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="dot dot-red"></div>
          <div className="dot dot-yellow"></div>
          <div className="dot dot-green"></div>
          <span style={{ marginLeft: "8px", opacity: 0.7 }}>Scrapling Real-time Console</span>
        </div>
        <div className="terminal-body">
          {logs.length === 0 ? (
            <div style={{ opacity: 0.4 }}>Idle. Enter keyword and press 'Run Scrapling' to start live extraction.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`log-entry ${log.includes("ERROR") ? "error" : log.includes("Completed") ? "success" : ""}`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Live Stream Products Preview */}
      {liveProducts.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <h4 style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
            Live Stream Extracted Items ({liveProducts.length})
          </h4>
          <div className="product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {liveProducts.map((p, idx) => (
              <div key={idx} className="apple-card" style={{ padding: "10px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent-blue)", textTransform: "uppercase" }}>
                  {p.supermarket}
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", margin: "4px 0" }}>{p.name}</div>
                <div style={{ color: "var(--accent-green)", fontWeight: 700 }}>
                  {p.price ? `KES ${p.price.toLocaleString()}` : "Price N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
