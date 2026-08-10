import sqlite3
import json
import os
import time
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "scrapling_data.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Products table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            supermarket TEXT NOT NULL,
            name TEXT NOT NULL,
            price REAL,
            currency TEXT DEFAULT 'KES',
            url TEXT,
            image_url TEXT,
            category TEXT,
            in_stock INTEGER DEFAULT 1,
            product_id TEXT,
            source_query TEXT,
            updated_at INTEGER
        )
    """)
    
    # Price History table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id_fk TEXT NOT NULL,
            supermarket TEXT NOT NULL,
            product_name TEXT NOT NULL,
            price REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (product_id_fk) REFERENCES products (id)
        )
    """)
    
    # Scrape Jobs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scrape_jobs (
            id TEXT PRIMARY KEY,
            supermarket TEXT NOT NULL,
            query TEXT,
            status TEXT NOT NULL, -- pending, running, completed, failed
            items_found INTEGER DEFAULT 0,
            started_at INTEGER,
            completed_at INTEGER,
            error_message TEXT,
            logs TEXT
        )
    """)
    
    conn.commit()
    conn.close()

def save_scraped_products(products: List[Dict[str, Any]], supermarket: str, query: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())
    saved_count = 0
    
    for p in products:
        name = p.get("name", "").strip()
        if not name:
            continue
            
        p_id = f"{supermarket}::{p.get('productId') or name.lower().replace(' ', '_')}"
        price = p.get("price")
        url = p.get("url", "")
        image_url = p.get("image_url", "")
        category = p.get("category", "General")
        in_stock = 1 if p.get("in_stock", True) else 0
        raw_pid = p.get("productId", "")
        
        cursor.execute("""
            INSERT INTO products (id, supermarket, name, price, currency, url, image_url, category, in_stock, product_id, source_query, updated_at)
            VALUES (?, ?, ?, ?, 'KES', ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                price = excluded.price,
                url = excluded.url,
                image_url = CASE WHEN excluded.image_url != '' THEN excluded.image_url ELSE products.image_url END,
                category = excluded.category,
                in_stock = excluded.in_stock,
                updated_at = excluded.updated_at
        """, (p_id, supermarket, name, price, url, image_url, category, in_stock, raw_pid, query, now))
        
        if price is not None:
            cursor.execute("""
                INSERT INTO price_history (product_id_fk, supermarket, product_name, price, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (p_id, supermarket, name, price, now))
            
        saved_count += 1
        
    conn.commit()
    conn.close()
    return saved_count

def get_products(supermarket: Optional[str] = None, search: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    
    if supermarket and supermarket != "all":
        query += " AND supermarket = ?"
        params.append(supermarket)
        
    if search:
        query += " AND name LIKE ?"
        params.append(f"%{search}%")
        
    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(r) for r in rows]

def create_job(job_id: str, supermarket: str, query: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())
    cursor.execute("""
        INSERT INTO scrape_jobs (id, supermarket, query, status, items_found, started_at, logs)
        VALUES (?, ?, ?, 'running', 0, ?, '[]')
    """, (job_id, supermarket, query, now))
    conn.commit()
    conn.close()

def update_job(job_id: str, status: str, items_found: int = 0, error: Optional[str] = None, logs: Optional[List[str]] = None) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())
    
    logs_json = json.dumps(logs) if logs else "[]"
    
    cursor.execute("""
        UPDATE scrape_jobs
        SET status = ?, items_found = ?, completed_at = ?, error_message = ?, logs = ?
        WHERE id = ?
    """, (status, items_found, now if status in ('completed', 'failed') else None, error, logs_json, job_id))
    
    conn.commit()
    conn.close()

def get_jobs(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        item = dict(r)
        if item.get("logs"):
            try:
                item["logs"] = json.loads(item["logs"])
            except Exception:
                item["logs"] = []
        result.append(item)
    return result

# Initialize tables on load
init_db()
