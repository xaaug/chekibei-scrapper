import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ScraperControl } from "./components/ScraperControl";
import { ProductCatalog } from "./components/ProductCatalog";
import { PriceComparison } from "./components/PriceComparison";
import { JobHistory } from "./components/JobHistory";

export function App() {
  const [activeTab, setActiveTab] = useState("catalog"); // catalog, compare, scraper, jobs
  const [isDark, setIsDark] = useState(true);
  const [selectedStore, setSelectedStore] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickQuery, setQuickQuery] = useState("");

  const [products, setProducts] = useState([]);
  const [storeStats, setStoreStats] = useState({ all: 0, quickmart: 0, naivas: 0, carrefour: 0 });

  const loadData = async () => {
    try {
      const resp = await fetch("/api/products?limit=200");
      const data = await resp.json();
      const items = data.products || [];
      setProducts(items);

      const stats = { all: items.length, quickmart: 0, naivas: 0, carrefour: 0 };
      items.forEach((p) => {
        if (stats[p.supermarket] !== undefined) {
          stats[p.supermarket]++;
        }
      });
      setStoreStats(stats);
    } catch (err) {
      console.error("Error loading products:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickScrape = (keyword) => {
    setQuickQuery(keyword);
    setActiveTab("scraper");
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        setIsDark={setIsDark}
        storeStats={storeStats}
      />

      <main className="app-container">
        <Sidebar
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
          storeStats={storeStats}
          onQuickScrape={handleQuickScrape}
        />

        <section className="main-content">
          {activeTab === "catalog" && (
            <ProductCatalog
              products={products}
              selectedStore={selectedStore}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRefresh={loadData}
            />
          )}

          {activeTab === "compare" && (
            <PriceComparison defaultQuery={searchQuery || "milk"} />
          )}

          {activeTab === "scraper" && (
            <ScraperControl
              initialQuery={quickQuery || searchQuery || "milk"}
              onScrapeComplete={loadData}
            />
          )}

          {activeTab === "jobs" && <JobHistory />}
        </section>
      </main>
    </div>
  );
}

export default App;
