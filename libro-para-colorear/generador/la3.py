import cv2, numpy as np
from nnline import nn_lines
def lift(rgb, m, clip=2.5, gamma=0.6):
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0]
    L = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8)).apply(L)
    L = (255 * (L / 255.0) ** gamma).astype(np.uint8)
    lab[:, :, 0] = L
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

def lineart(rgb, m, long_side=1600, out_scale=2, model="sk_model2.pth", enhance=None):
    if enhance is None:
        enhance = np.median(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)[m > 0]) < 110
    if enhance: rgb = lift(rgb, m)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    n, cc, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 2:
        big = st[1:, 4].max(); keep = np.zeros_like(m)
        for i in range(1, n):
            if st[i, 4] >= 0.03 * big: keep[cc == i] = 255
        m = keep
    rgbw = rgb.copy(); rgbw[m == 0] = 255
    pad = 24
    rgbw = cv2.copyMakeBorder(rgbw, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    m = cv2.copyMakeBorder(m, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    y = nn_lines(rgbw, model, long_side)
    H, W = y.shape
    m = cv2.resize(m, (W, H), interpolation=cv2.INTER_NEAREST)
    # upscale for print
    y = cv2.resize(y, (W * out_scale, H * out_scale), interpolation=cv2.INTER_CUBIC)
    m = cv2.resize(m, (W * out_scale, H * out_scale), interpolation=cv2.INTER_LINEAR)
    m = (cv2.GaussianBlur(m, (0, 0), 3) > 127).astype(np.uint8) * 255
    # levels: darker, cleaner lines
    f = y.astype(np.float32) / 255.0
    f = np.clip((f - 0.35) / (0.93 - 0.35), 0, 1) ** 1.6
    y = (f * 255).astype(np.uint8)
    # clear outside the (slightly grown) car
    grow = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    y[grow == 0] = 255
    # remove small specks
    dark = (y < 170).astype(np.uint8)
    n, cc, st, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
    small = np.isin(cc, np.where(st[:, 4] < 60)[0][1:] if n > 1 else [])
    small &= dark.astype(bool)
    y[small] = 255
    # thicken lines a bit
    y = cv2.erode(y, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    # smooth outer contour
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    o = np.full_like(y, 255)
    sm = []
    for c in cnts:
        c = c[:, 0, :].astype(np.float32)
        if len(c) > 30:
            k = 7
            cp = np.vstack([c[-k:], c, c[:k]])
            ker = np.ones(2 * k + 1) / (2 * k + 1)
            c = np.stack([np.convolve(cp[:, 0], ker, "valid"), np.convolve(cp[:, 1], ker, "valid")], 1)
        sm.append(c.astype(np.int32).reshape(-1, 1, 2))
    cv2.polylines(o, sm, True, 0, 5, lineType=cv2.LINE_AA)
    # only fill gaps where the drawing has no line nearby
    dist = cv2.distanceTransform((y >= 150).astype(np.uint8), cv2.DIST_L2, 5)
    gap = dist > 9
    y = np.where(gap & (o < 255), np.minimum(y, o), y).astype(np.uint8)
    # crop
    ys, xs = np.where(y < 200)
    y = y[max(0, ys.min() - 10):ys.max() + 10, max(0, xs.min() - 10):xs.max() + 10]
    return y
