import re, html, urllib.parse
from wm import get
def strip(s):
    s=re.sub(r'<style.*?</style>','',s,flags=re.S)
    s=re.sub(r'<[^>]+>','',s); s=html.unescape(s)
    return re.sub(r'\s+',' ',s).strip()
def meta(f):
    t=get("https://commons.wikimedia.org/wiki/"+urllib.parse.quote(f.replace(' ','_')))
    t=t.replace("&#95;","_")
    lic=[strip(x) for x in re.findall(r'class="licensetpl_short"[^>]*>(.*?)</span>',t,re.S)]
    aut=re.search(r'id="fileinfotpl_aut".*?</td>\s*<td[^>]*>(.*?)</td>',t,re.S)
    aut=strip(aut.group(1)) if aut else ""
    attr=[strip(x) for x in re.findall(r'class="licensetpl_attr"[^>]*>(.*?)</span>',t,re.S)]
    desc=re.search(r'id="fileinfotpl_desc".*?</td>\s*<td[^>]*>(.*?)</td>',t,re.S)
    desc=strip(desc.group(1))[:300] if desc else ""
    date=re.search(r'id="fileinfotpl_date".*?</td>\s*<td[^>]*>(.*?)</td>',t,re.S)
    date=strip(date.group(1))[:60] if date else ""
    return dict(file=f,license=list(dict.fromkeys(lic)),author=aut[:150],attr=attr[:1],desc=desc,date=date,
                url="https://commons.wikimedia.org/wiki/"+urllib.parse.quote(f.replace(' ','_')))
if __name__=="__main__":
    import sys,json
    for f in sys.argv[1:]: print(json.dumps(meta(f),ensure_ascii=False,indent=1))
