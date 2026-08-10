import uuid
import asyncio
import json
import time
import re
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapper_service.scrapling_engine import run_scrapling_job
from scrapper_service.database import (
    save_scraped_products,
    get_products,
    create_job,
    update_job,
    get_jobs
)

app = FastAPI(
    title="Chekibei Scrapling Scraper API",
    description="Automated Kenyan Supermarket Data Scraper API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active streaming logs memory buffer per job_id
active_job_streams: Dict[str, Dict[str, Any]] = {}

class ScrapeRequest(BaseModel):
    supermarket: str = "quickmart" # quickmart, naivas, carrefour, all
    query: str = "milk"
    max_pages: int = 1

def execute_background_scrape(job_id: str, supermarket: str, query: str, max_pages: int):
    logs = [f"Job {job_id} initialized for {supermarket.upper()} with query '{query}'"]
    active_job_streams[job_id] = {
        "status": "running",
        "logs": logs,
        "products": [],
        "completed": False
    }
    
    try:
        products = run_scrapling_job(supermarket, query, max_pages=max_pages, logs=logs)
        saved_count = save_scraped_products(products, supermarket, query)
        
        logs.append(f"Completed! {len(products)} products found, {saved_count} saved to database.")
        active_job_streams[job_id]["status"] = "completed"
        active_job_streams[job_id]["products"] = products
        active_job_streams[job_id]["completed"] = True
        
        update_job(job_id, "completed", items_found=len(products), logs=logs)
    except Exception as e:
        error_msg = str(e)
        logs.append(f"ERROR: {error_msg}")
        active_job_streams[job_id]["status"] = "failed"
        active_job_streams[job_id]["completed"] = True
        update_job(job_id, "failed", error=error_msg, logs=logs)

@app.post("/api/scrape")
async def trigger_scrape(req: ScrapeRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    create_job(job_id, req.supermarket, req.query)
    
    background_tasks.add_task(
        execute_background_scrape,
        job_id,
        req.supermarket,
        req.query,
        req.max_pages
    )
    
    return {
        "status": "started",
        "job_id": job_id,
        "supermarket": req.supermarket,
        "query": req.query,
        "message": f"Scrape job started for {req.supermarket}"
    }

@app.get("/api/scrape/stream/{job_id}")
async def stream_job_status(job_id: str):
    async def event_generator():
        last_log_idx = 0
        while True:
            job_data = active_job_streams.get(job_id)
            if not job_data:
                yield f"data: {json.dumps({'status': 'running', 'log': 'Connecting to job stream...'})}\n\n"
                await asyncio.sleep(1)
                continue
                
            current_logs = job_data.get("logs", [])
            if last_log_idx < len(current_logs):
                for i in range(last_log_idx, len(current_logs)):
                    yield f"data: {json.dumps({'status': job_data['status'], 'log': current_logs[i]})}\n\n"
                last_log_idx = len(current_logs)
                
            if job_data.get("completed"):
                yield f"data: {json.dumps({'status': job_data['status'], 'log': 'Job execution finished.', 'products': job_data.get('products', []), 'done': True})}\n\n"
                break
                
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/products")
async def list_products(
    supermarket: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100)
):
    products = get_products(supermarket=supermarket, search=search, limit=limit)
    return {"count": len(products), "products": products}

@app.get("/api/compare")
async def compare_products(search: Optional[str] = Query("milk")):
    all_products = get_products(supermarket="all", search=search, limit=200)
    
    grouped: Dict[str, Dict[str, Any]] = {}
    
    for p in all_products:
        name = p["name"]
        norm_key = re.sub(r'[^a-zA-Z0-9]', '', name.lower())[:20]
        
        if norm_key not in grouped:
            grouped[norm_key] = {
                "display_name": name,
                "stores": {},
                "cheapest_store": None,
                "lowest_price": float("inf")
            }
            
        store = p["supermarket"]
        price = p["price"]
        grouped[norm_key]["stores"][store] = p
        
        if price and price < grouped[norm_key]["lowest_price"]:
            grouped[norm_key]["lowest_price"] = price
            grouped[norm_key]["cheapest_store"] = store
            
    comparison_list = []
    for k, v in grouped.items():
        if v["lowest_price"] == float("inf"):
            v["lowest_price"] = None
        comparison_list.append(v)
        
    return {"query": search, "comparisons": comparison_list}

@app.get("/api/jobs")
async def list_jobs(limit: int = 20):
    jobs = get_jobs(limit=limit)
    return {"count": len(jobs), "jobs": jobs}

@app.get("/api/stores")
async def store_stats():
    products = get_products(limit=1000)
    counts = {"quickmart": 0, "naivas": 0, "carrefour": 0}
    for p in products:
        sm = p.get("supermarket")
        if sm in counts:
            counts[sm] += 1
            
    return {
        "stores": [
            {"id": "quickmart", "name": "Quickmart Kenya", "color": "#e53e3e", "item_count": counts["quickmart"], "status": "active"},
            {"id": "naivas", "name": "Naivas Supermarket", "color": "#3182ce", "item_count": counts["naivas"], "status": "active"},
            {"id": "carrefour", "name": "Carrefour Kenya", "color": "#2b6cb0", "item_count": counts["carrefour"], "status": "active"},
        ]
    }

# Mount static web UI directory
web_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")
if os.path.exists(web_dir):
    app.mount("/styles", StaticFiles(directory=os.path.join(web_dir, "src", "styles")), name="styles")
    app.mount("/src", StaticFiles(directory=os.path.join(web_dir, "src")), name="src")

@app.get("/")
async def serve_index():
    index_file = os.path.join(web_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Chekibei Scrapling API Server is Running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("scrapper_service.server:app", host="127.0.0.1", port=8000, reload=True)
