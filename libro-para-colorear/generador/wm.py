import os, re, time, hashlib, urllib.parse, subprocess, html
UA="KidsColoringBook/1.0 (https://github.com/cacosantoto-sudo/torque-orden; cacosantoto@gmail.com)"
CACHE="cache"; os.makedirs(CACHE,exist_ok=True)
def get(url, binary=False, tries=14):
    h=hashlib.md5(url.encode()).hexdigest()
    p=os.path.join(CACHE,h)
    if os.path.exists(p):
        return open(p,'rb').read() if binary else open(p,encoding='utf-8',errors='ignore').read()
    for i in range(tries):
        r=subprocess.run(["curl","-sS","-L","-A",UA,"-o",p+".tmp","-w","%{http_code}","--max-time","90",url],capture_output=True,text=True)
        code=r.stdout.strip()
        if code in ("400","404"): break
        if code=="200":
            os.rename(p+".tmp",p); time.sleep(1.0)
            return get(url,binary)
        time.sleep(min(120,15*(i+1)))
    raise RuntimeError(f"{code} {url}")
def search(q, n=40):
    u="https://commons.wikimedia.org/w/index.php?"+urllib.parse.urlencode({"search":q,"title":"Special:Search","ns6":1,"fulltext":1,"limit":n})
    t=get(u); out=[]
    for m in re.findall(r'href="/wiki/(File:[^"#]+)"',t):
        f=urllib.parse.unquote(html.unescape(m))
        if f not in out and re.search(r'\.(jpe?g|png)$',f,re.I): out.append(f)
    return out
def category(c):
    t=get("https://commons.wikimedia.org/wiki/"+urllib.parse.quote(c.replace(' ','_')))
    out=[]
    for m in re.findall(r'href="/wiki/(File:[^"#]+)"',t):
        f=urllib.parse.unquote(html.unescape(m))
        if f not in out and re.search(r'\.(jpe?g|png)$',f,re.I): out.append(f)
    return out
def thumb(f,w=330):
    return get("https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(f[5:].replace(' ','_'))+f"?width={w}",binary=True)
def image(f, widths=(1280,1024,960,800,640)):
    name=f[5:].replace(' ','_')
    h=hashlib.md5(name.encode()).hexdigest()
    q=urllib.parse.quote(name)
    for w in widths:
        u=f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}"
        try: return get(u,binary=True,tries=4)
        except RuntimeError as e: print("  miss",w,str(e)[:40],flush=True)
    raise RuntimeError("no image "+f)
