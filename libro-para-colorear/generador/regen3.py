import sys, json, numpy as np
from PIL import Image
import la3
picks=json.load(open("picks.json"))
for k in (sys.argv[1:] or list(picks)):
    d=np.load(f"art/{k}_cut.npz"); out=la3.lineart(d["rgb"],d["m"],enhance={"m250f":False}.get(k))
    Image.fromarray(out).save(f"art/{k}_line.png"); print("ok",k,out.shape,flush=True)
