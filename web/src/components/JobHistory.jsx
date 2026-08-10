import React, { useState, useEffect } from "react";

export function JobHistory() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/jobs");
      const data = await resp.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="apple-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Scrape Execution Job History</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Audit log of previous background and UI-triggered automated Scrapling jobs.
          </p>
        </div>
        <button className="apple-button" style={{ border: "1px solid var(--apple-border)" }} onClick={fetchJobs}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", opacity: 0.6 }}>Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", opacity: 0.5 }}>No job history recorded yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--apple-border)", textAlign: "left" }}>
                <th style={{ padding: "10px", color: "var(--text-secondary)" }}>Job ID</th>
                <th style={{ padding: "10px", color: "var(--text-secondary)" }}>Supermarket</th>
                <th style={{ padding: "10px", color: "var(--text-secondary)" }}>Query</th>
                <th style={{ padding: "10px", color: "var(--text-secondary)" }}>Status</th>
                <th style={{ padding: "10px", color: "var(--text-secondary)" }}>Items Found</th>
                <th style={{ padding: "10px", color: "var(--text-secondary)" }}>Started At</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: "1px solid var(--apple-border)" }}>
                  <td style={{ padding: "10px", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{j.id}</td>
                  <td style={{ padding: "10px", textTransform: "uppercase", fontWeight: 600 }}>{j.supermarket}</td>
                  <td style={{ padding: "10px" }}>'{j.query}'</td>
                  <td style={{ padding: "10px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: j.status === "completed" ? "rgba(52, 199, 89, 0.15)" : j.status === "failed" ? "rgba(255, 59, 48, 0.15)" : "rgba(255, 149, 0, 0.15)",
                        color: j.status === "completed" ? "var(--accent-green)" : j.status === "failed" ? "var(--accent-red)" : "var(--accent-orange)"
                      }}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px", fontWeight: 600 }}>{j.items_found}</td>
                  <td style={{ padding: "10px", opacity: 0.7 }}>
                    {j.started_at ? new Date(j.started_at * 1000).toLocaleTimeString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
