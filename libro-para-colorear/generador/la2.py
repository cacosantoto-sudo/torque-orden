import cv2, numpy as np
from skimage.morphology import skeletonize
def _boundaries(r):
    b=np.zeros(r.shape,np.uint8)
    b[:,1:]|=(r[:,1:]!=r[:,:-1]); b[1:,:]|=(r[1:,:]!=r[:-1,:]); return b
def _clean_regions(mask, minarea):
    mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    n,cc,st,_=cv2.connectedComponentsWithStats(mask)
    out=np.zeros_like(mask)
    for i in range(1,n):
        if st[i,4]>=minarea: out[cc==i]=255
    out=cv2.GaussianBlur(out,(0,0),2.5); return (out>127).astype(np.uint8)*255
def lineart(rgb, m, W=2400, canny=(40,110), minlen=0.08, dark=0.30, detail='auto', target=0.05):
    h,w=m.shape; s=W/w
    rgb=cv2.resize(rgb,(W,int(h*s)),interpolation=cv2.INTER_CUBIC)
    m=cv2.resize(m,(W,int(h*s)),interpolation=cv2.INTER_NEAREST)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(25,25)))
    m=cv2.GaussianBlur(m,(0,0),3); m=(m>127).astype(np.uint8)*255
    n,cc,st,_=cv2.connectedComponentsWithStats(m)
    if n>2:
        big=st[1:,4].max(); m=np.zeros_like(m)
        for i in range(1,n):
            if st[i,4]>=0.03*big: m[cc==i]=255
    H=m.shape[0]; area=m.sum()/255
    sm=rgb.copy()
    for _ in range(4): sm=cv2.bilateralFilter(sm,9,35,7)
    lab=cv2.cvtColor(sm,cv2.COLOR_RGB2LAB)
    Lc=lab[:,:,0].astype(np.float32)
    # dark parts: tyres, windows, grilles
    thr=np.percentile(Lc[m>0],100*dark) if dark>0 else -1
    thr=min(thr,95)
    dk=((Lc<=thr)&(m>0)).astype(np.uint8)*255
    dk=_clean_regions(dk,0.0025*area)
    # chroma regions (e.g. stripes, different-color panels)
    ab=lab[:,:,1:].astype(np.float32)-128
    chroma=np.sqrt((ab**2).sum(2))
    # edges
    g=cv2.cvtColor(sm,cv2.COLOR_RGB2GRAY)
    inner=cv2.erode(m,np.ones((15,15),np.uint8))
    if detail=='auto':
        best=None
        for d in [0.35,0.5,0.7,0.9,1.1,1.3,1.6,2.0]:
            e=cv2.Canny(g,canny[0]*d,canny[1]*d); e[inner==0]=0
            dens=e.sum()/255/max(1,inner.sum()/255)
            if best is None or abs(dens-target)<abs(best[1]-target): best=(d,dens)
        detail=best[0]
    e=cv2.Canny(g,canny[0]*detail,canny[1]*detail)
    e[inner==0]=0
    # keep only long edges
    n,cc,st,_=cv2.connectedComponentsWithStats(cv2.dilate(e,np.ones((3,3),np.uint8)),connectivity=8)
    L=minlen*W/10
    keep=np.zeros_like(e)
    for i in range(1,n):
        if max(st[i,2],st[i,3])>=L: keep[cc==i]=255
    e=cv2.bitwise_and(e,keep)
    lines=np.zeros((H,W),np.uint8)
    lines|=cv2.dilate(e,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    db=cv2.Canny(dk,50,150); lines|=cv2.dilate(db,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(6,6)))
    cnts,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(lines,cnts,-1,255,14,lineType=cv2.LINE_AA)
    out=255-lines
    out=cv2.GaussianBlur(out,(0,0),0.9)
    return out
