import cv2, numpy as np, io
from PIL import Image
from rembg import remove, new_session
_S=None
def sess():
    global _S
    if _S is None: _S=new_session("isnet-general-use")
    return _S
def cutout(img):
    """img PIL RGB -> (rgb np, mask np uint8 0/255) cropped to car"""
    out=remove(img,session=sess(),post_process_mask=True)
    a=np.array(out)[:,:,3]
    _,m=cv2.threshold(a,127,255,cv2.THRESH_BINARY)
    # keep largest component(s)
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    if n>1:
        big=np.argmax(st[1:,cv2.CC_STAT_AREA])+1
        keep=np.zeros_like(m)
        for i in range(1,n):
            if st[i,cv2.CC_STAT_AREA]>0.08*st[big,cv2.CC_STAT_AREA]: keep[lab==i]=255
        m=keep
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    # fill holes
    cnts,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    m=np.zeros_like(m); cv2.drawContours(m,cnts,-1,255,-1)
    rgb=np.array(img.convert("RGB"))
    x,y,w,h=cv2.boundingRect(m)
    p=10
    x0,y0=max(0,x-p),max(0,y-p); x1,y1=min(m.shape[1],x+w+p),min(m.shape[0],y+h+p)
    return rgb[y0:y1,x0:x1], m[y0:y1,x0:x1]
MED_IT=3; MED_K=9
def lineart(rgb, m, W=2400, k=10, minfrac=0.0018, canny=(60,140)):
    h,w=m.shape; s=W/w
    rgb=cv2.resize(rgb,(W,int(h*s)),interpolation=cv2.INTER_CUBIC)
    m=cv2.resize(m,(W,int(h*s)),interpolation=cv2.INTER_NEAREST)
    H=m.shape[0]
    sm=rgb.copy()
    for _ in range(3): sm=cv2.bilateralFilter(sm,9,40,9)
    sm=cv2.pyrMeanShiftFiltering(sm,12,28)
    lab=cv2.cvtColor(sm,cv2.COLOR_RGB2LAB).reshape(-1,3).astype(np.float32)
    inside=m.reshape(-1)>0
    crit=(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,30,1.0)
    _,labels,cent=cv2.kmeans(lab[inside],k,None,crit,3,cv2.KMEANS_PP_CENTERS)
    L=np.full(H*W,255,np.int32); L[inside]=labels.ravel(); L=L.reshape(H,W).astype(np.uint8)
    for _ in range(MED_IT): L=cv2.medianBlur(L,MED_K)
    L=L.astype(np.int32); L[m==0]=-1
    # mode filter to clean
    L2=np.full_like(L,-1)
    regions=np.zeros((H,W),np.int32); rid=0
    minarea=minfrac*m.sum()/255
    # connected regions per label; merge tiny ones by majority dilation later
    for c in range(k):
        n,cc,st,_=cv2.connectedComponentsWithStats((L==c).astype(np.uint8),connectivity=4)
        for i in range(1,n):
            if st[i,4]>=minarea:
                rid+=1; regions[cc==i]=rid
    # fill tiny (0 inside mask) with nearest region
    unk=((regions==0)&(m>0)).astype(np.uint8)
    if unk.any():
        for _ in range(60):
            if not unk.any(): break
            d=cv2.dilate(regions.astype(np.float32),np.ones((3,3),np.uint8)).astype(np.int32)
            fill=(unk>0)&(d>0); regions[fill]=d[fill]; unk[fill]=0
    regions[m==0]=0
    # boundaries
    r=regions
    b=np.zeros((H,W),np.uint8)
    b[:,1:]|=(r[:,1:]!=r[:,:-1]); b[1:,:]|=(r[1:,:]!=r[:-1,:])
    b=b*255
    # smooth boundary lines
    b=cv2.GaussianBlur(b,(0,0),1.6); b=(b>40).astype(np.uint8)*255
    # outline thick
    cnts,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    o=np.zeros_like(m)
    cnts=[cv2.approxPolyDP(c,1.2,True) for c in cnts]
    cv2.drawContours(o,cnts,-1,255,9,lineType=cv2.LINE_AA)
    lines=cv2.max(cv2.dilate(b,np.ones((3,3),np.uint8)),o)
    # remove tiny line specks
    n,cc,st,_=cv2.connectedComponentsWithStats((lines>127).astype(np.uint8))
    keep=np.zeros_like(lines)
    for i in range(1,n):
        if st[i,4]>120: keep[cc==i]=255
    lines=cv2.min(lines,keep) if False else np.where(keep>0,lines,0).astype(np.uint8)
    out=255-lines
    out=cv2.GaussianBlur(out,(0,0),0.8)
    return out
if __name__=="__main__":
    import sys
    from wm import get
    import urllib.parse
    f=sys.argv[1]
    data=get("https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(f[5:])+"?width=1600",binary=True)
    img=Image.open(io.BytesIO(data)).convert("RGB")
    rgb,m=cutout(img)
    for k in [int(a) for a in sys.argv[3:]] or [12]:
        o=lineart(rgb,m,k=k)
        Image.fromarray(o).save(sys.argv[2].replace(".png",f"_k{k}.png"))
