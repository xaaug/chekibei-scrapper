import React from "react";

export function Header({ activeTab, setActiveTab, isDark, setIsDark, storeStats }) {
  return (
    <header className="apple-header">
      <div className="brand-logo">
        <div className="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <span>Chekibei <span style={{ opacity: 0.5, fontWeight: 400 }}>Scrapling</span></span>
      </div>

      <nav className="segmented-control">
        <button
          className={`segment-btn ${activeTab === "catalog" ? "active" : ""}`}
          onClick={() => setActiveTab("catalog")}
        >
          Catalog
        </button>
        <button
          className={`segment-btn ${activeTab === "compare" ? "active" : ""}`}
          onClick={() => setActiveTab("compare")}
        >
          Price Matrix
        </button>
        <button
          className={`segment-btn ${activeTab === "scraper" ? "active" : ""}`}
          onClick={() => setActiveTab("scraper")}
        >
          Live Scraper
        </button>
        <button
          className={`segment-btn ${activeTab === "jobs" ? "active" : ""}`}
          onClick={() => setActiveTab("jobs")}
        >
          Jobs Log
        </button>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={() => setIsDark(!isDark)}
          className="segment-btn"
          style={{ padding: "6px 12px", border: "1px solid var(--apple-border)" }}
          title="Toggle Dark/Light Mode"
        >
          {isDark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
    </header>
  );
}
