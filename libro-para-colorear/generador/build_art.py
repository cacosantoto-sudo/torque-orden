import json, io, os, sys, urllib.parse
from PIL import Image
from wm import get, image
import lineart, la2
from meta import meta
os.makedirs("art",exist_ok=True)
picks=json.load(open("picks.json"))
only=sys.argv[1:]
for k,f in picks.items():
    if only and k not in only: continue
    if os.path.exists(f"art/{k}_cut.npz") and not only: continue
    print("fetch",k,flush=True)
    data=image(f, tuple(int(x) for x in os.environ.get("WIDTHS","1280,1024,960,800,640").split(",")))
    img=Image.open(io.BytesIO(data))
    if img.mode in("RGBA","LA","P"):
        img=img.convert("RGBA"); bg=Image.new("RGBA",img.size,(255,255,255,255)); bg.alpha_composite(img); img=bg
    img=img.convert("RGB")
    ref=img.copy(); ref.thumbnail((900,900)); ref.save(f"art/{k}_ref.jpg",quality=88)
    rgb,m=lineart.cutout(img)
    import numpy as np; np.savez_compressed(f"art/{k}_cut.npz",rgb=rgb,m=m)
    out=la2.lineart(rgb,m)
    Image.fromarray(out).save(f"art/{k}_line.png")
    json.dump(meta(f),open(f"art/{k}_meta.json","w"),ensure_ascii=False,indent=1)
    print("done",k,flush=True)
