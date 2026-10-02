import sys, json, numpy as np
from PIL import Image
import la2
picks=json.load(open("picks.json"))
keys=sys.argv[1:] or list(picks)
for k in keys:
    d=np.load(f"art/{k}_cut.npz"); out=la2.lineart(d["rgb"],d["m"])
    Image.fromarray(out).save(f"art/{k}_line.png"); print("regen",k,flush=True)
