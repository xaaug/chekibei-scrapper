import urllib.request
import re
from scrapling import Selector

def test_parse():
    url = "https://naivas.online/search?term=milk"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        
    sel = Selector(html)
    
    # Check all hrefs containing product/item/p
    all_links = sel.css("a")
    product_links = []
    for a in all_links:
        href = a.attrib.get("href", "") if hasattr(a, 'attrib') else ""
        txt = a.text.strip()
        if href and ('/product/' in href or '/p/' in href or '/item/' in href or 'naivas.online' in href):
            product_links.append((txt, href))
            
    print(f"Total href links: {len(all_links)}")
    print(f"Product href links: {len(product_links)}")
    for txt, href in product_links[:15]:
        print(f" - '{txt}' -> {href}")

if __name__ == "__main__":
    test_parse()
