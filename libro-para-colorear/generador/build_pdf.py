# -*- coding: utf-8 -*-
import json, math, os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader, simpleSplit
from PIL import Image
from content import SECTIONS, CARS, FLAGS

for n, f in [("Baloo", "Baloo2-ExtraBold.ttf"), ("BalooM", "Baloo2-Medium.ttf"), ("Nunito", "Nunito-Regular.ttf"),
             ("NunitoB", "Nunito-Bold.ttf"), ("NunitoX", "Nunito-ExtraBold.ttf")]:
    pdfmetrics.registerFont(TTFont(n, os.path.join("fonts", f)))

W, H = landscape(A4)
M = 10 * mm
INK = HexColor("#1d1d1f")
GREY = HexColor("#8a8a8a")
LIGHT = HexColor("#f3f3f3")
SEC = {s[0]: s for s in SECTIONS}

NOTES = {
    "m250f": "La foto es de un Maserati 250F de 1955, igual al modelo que manejó Fangio.",
    "castellano": "Réplica de su Dodge Nº 1, exhibida en 2025.",
    "moriatis": "Ford Falcon de su equipo, Moriatis Competición (2023).",
    "mclarenf1": "Un McLaren F1 de 1994.",
    "aventin": "En la foto: el Ford Falcon de su hermano Antonio Aventín, en la Vuelta de Necochea de 1988.",
    "silva": "En la foto: Silva corriendo en Paraná, en 2015.",
    "traverso": "Su Chevy campeón, exhibido en 2023.",
    "ortelli": "Su Chevy campeón 2011, exhibido en 2023.",
    "torino": "Un Torino 380W de 1967.",
}

# ---------------------------------------------------------------- helpers
_BW = {}
def bw(path):
    if path not in _BW:
        im = Image.open(path).convert("L")
        jp = path.replace(".png", "_print.jpg")
        im.save(jp, quality=80, optimize=True)
        _BW[path] = (jp, im.size)
    return _BW[path]

def rrect(c, x, y, w, h, r=4 * mm, stroke=1, fill=0, lw=1.6, col=INK, fillcol=None):
    c.saveState(); c.setLineWidth(lw); c.setStrokeColor(col)
    if fillcol is not None: c.setFillColor(fillcol)
    c.roundRect(x, y, w, h, r, stroke=stroke, fill=fill); c.restoreState()

def text_fit(c, txt, font, size, maxw, minsize=8):
    while size > minsize and pdfmetrics.stringWidth(txt, font, size) > maxw: size -= 0.5
    return size

def para(c, txt, x, y, w, font, size, lead=None, col=INK, maxlines=None):
    lead = lead or size * 1.25
    lines = simpleSplit(txt, font, size, w)
    if maxlines: lines = lines[:maxlines]
    c.setFont(font, size); c.setFillColor(col)
    for i, ln in enumerate(lines): c.drawString(x, y - i * lead, ln)
    return y - len(lines) * lead

def charwrap(txt, font, size, w):
    out, cur = [], ""
    for ch in txt:
        if pdfmetrics.stringWidth(cur + ch, font, size) > w: out.append(cur); cur = ch
        else: cur += ch
    if cur: out.append(cur)
    return out

def star(c, cx, cy, r, fill=0):
    p = c.beginPath()
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.42
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    p.close(); c.drawPath(p, stroke=1, fill=fill)

def hint(c, txt, x, y, size=7):
    c.setFont("Nunito", size); c.setFillColor(HexColor("#b5b5b5")); c.drawCentredString(x, y, txt)

def checkered(c, x, y, w, h, n=None, sq=4 * mm):
    cols = int(w // sq); rows = int(h // sq)
    c.saveState(); c.setFillColor(INK)
    for i in range(cols):
        for j in range(rows):
            if (i + j) % 2 == 0: c.rect(x + i * sq, y + j * sq, sq, sq, stroke=0, fill=1)
    c.setStrokeColor(INK); c.setLineWidth(1); c.rect(x, y, cols * sq, rows * sq, stroke=1, fill=0)
    c.restoreState()

# ---------------------------------------------------------------- flags (outline, to color)
def flag(c, kind, x, y, w, h):
    c.saveState(); c.setStrokeColor(INK); c.setLineWidth(1.4); c.setFillColor(white)
    if kind == "argentina":
        for i in range(3): c.rect(x, y + i * h / 3, w, h / 3, stroke=1, fill=0)
        hint(c, "celeste", x + w / 2, y + h * 5 / 6 - 2.5); hint(c, "celeste", x + w / 2, y + h / 6 - 2.5)
        cx, cy, r = x + w / 2, y + h / 2, h / 9
        c.setLineWidth(1)
        for i in range(16):
            a = i * math.pi / 8
            c.line(cx + r * 1.15 * math.cos(a), cy + r * 1.15 * math.sin(a),
                   cx + r * (1.55 if i % 2 == 0 else 1.35) * math.cos(a), cy + r * (1.55 if i % 2 == 0 else 1.35) * math.sin(a))
        c.circle(cx, cy, r, stroke=1, fill=1)
        c.setFont("Nunito", 5.5); c.setFillColor(HexColor("#b5b5b5")); c.drawCentredString(cx, cy - 2, "sol")
        hint(c, "blanco", x + w * 0.2, y + h / 2 - 2.5)
    elif kind in ("italia", "francia"):
        names = ["verde", "blanco", "rojo"] if kind == "italia" else ["azul", "blanco", "rojo"]
        for i in range(3):
            c.rect(x + i * w / 3, y, w / 3, h, stroke=1, fill=0); hint(c, names[i], x + (i + .5) * w / 3, y + h / 2 - 2.5)
    elif kind == "alemania":
        names = ["dorado", "rojo", "negro"]
        for i in range(3):
            c.rect(x, y + i * h / 3, w, h / 3, stroke=1, fill=0); hint(c, names[i], x + w / 2, y + (i + .5) * h / 3 - 2.5)
    elif kind == "japon":
        c.rect(x, y, w, h, stroke=1, fill=0); c.circle(x + w / 2, y + h / 2, h * 0.3, stroke=1, fill=0)
        hint(c, "rojo", x + w / 2, y + h / 2 - 2.5); hint(c, "blanco", x + w * 0.12, y + h * 0.1)
    elif kind == "eeuu":
        sh = h / 13
        c.setLineWidth(0.9)
        for i in range(13): c.rect(x, y + i * sh, w, sh, stroke=1, fill=0)
        cw, ch = w * 0.4, sh * 7
        c.setLineWidth(1.4); c.rect(x, y + h - ch, cw, ch, stroke=1, fill=1)
        c.setLineWidth(0.5)
        for row in range(9):
            n = 6 if row % 2 == 0 else 5
            for k in range(n):
                sx = x + cw * ((k + (0.5 if row % 2 == 0 else 1.0)) / 6.0)
                sy = y + h - ch * (row + 0.75) / 9.6
                star(c, sx, sy, ch / 30)
        c.setLineWidth(1.4); c.rect(x, y, w, h, stroke=1, fill=0)
        hint(c, "rayas rojas y blancas", x + w * 0.7, y + sh * 0.25, 5.5)
    elif kind == "reinounido":
        c.rect(x, y, w, h, stroke=1, fill=0)
        t = h * 0.1  # diagonal half width
        c.saveState(); p = c.beginPath(); p.rect(x, y, w, h); c.clipPath(p, stroke=0)
        L = math.hypot(w, h)
        for (x0, y0, x1, y1) in [(x, y, x + w, y + h), (x, y + h, x + w, y)]:
            dx, dy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = -dy * t, dx * t
            p = c.beginPath(); p.moveTo(x0 + nx - dx * 20, y0 + ny - dy * 20); p.lineTo(x1 + nx + dx * 20, y1 + ny + dy * 20)
            p.lineTo(x1 - nx + dx * 20, y1 - ny + dy * 20); p.lineTo(x0 - nx - dx * 20, y0 - ny - dy * 20); p.close()
            c.drawPath(p, stroke=1, fill=0)
        c.restoreState()
        c.rect(x + w / 2 - h * 0.17, y, h * 0.34, h, stroke=1, fill=1)
        c.rect(x, y + h / 2 - h * 0.17, w, h * 0.34, stroke=1, fill=1)
        c.setStrokeColor(white); c.setLineWidth(2)
        c.line(x + w / 2 - h * 0.17 + 0.8, y + h / 2 - h * 0.17 + 0.8, x + w / 2 + h * 0.17 - 0.8, y + h / 2 - h * 0.17 + 0.8)
        c.setStrokeColor(INK); c.setLineWidth(1.4)
        c.rect(x + w / 2 - h * 0.1, y, h * 0.2, h, stroke=1, fill=0)
        c.rect(x, y + h / 2 - h * 0.1, w, h * 0.2, stroke=1, fill=0)
        c.setFillColor(white); c.setStrokeColor(white)
        c.rect(x + w / 2 - h * 0.1 + 0.8, y + h / 2 - h * 0.1 + 0.8, h * 0.2 - 1.6, h * 0.2 - 1.6, stroke=0, fill=1)
        hint(c, "rojo", x + w / 2, y + h / 2 - 2.5, 6); hint(c, "azul", x + w * 0.2, y + h * 0.78, 6)
    c.restoreState()

# ---------------------------------------------------------------- page decorations
def footer(c, page):
    c.setFont("NunitoB", 8); c.setFillColor(GREY)
    c.drawCentredString(W / 2, 5 * mm, f"— {page} —")

def section_tag(c, sec, x, y):
    _, title, _, col = SEC[sec]
    c.setFont("NunitoX", 8.5)
    tw = pdfmetrics.stringWidth(title.upper(), "NunitoX", 8.5)
    rrect(c, x, y, tw + 8 * mm, 6 * mm, r=3 * mm, lw=1.2, col=HexColor(col), fill=1, fillcol=white)
    c.setFillColor(HexColor(col)); c.drawString(x + 4 * mm, y + 1.9 * mm, title.upper())

def car_page(c, car, idx, total, page):
    k = car["key"]
    meta = json.load(open(f"art/{k}_meta.json"))
    # frame
    rrect(c, M, M, W - 2 * M, H - 2 * M, r=6 * mm, lw=2.2)
    # header
    section_tag(c, car["sec"], M + 6 * mm, H - M - 11 * mm)
    c.setFont("NunitoB", 8.5); c.setFillColor(GREY)
    c.drawRightString(W - M - 6 * mm, H - M - 9 * mm, f"Auto {idx} de {total}")
    size = text_fit(c, car["name"], "Baloo", 30, W - 2 * M - 12 * mm, 18)
    c.setFont("Baloo", size); c.setFillColor(INK)
    c.drawString(M + 6 * mm, H - M - 23 * mm, car["name"])
    # info line
    y_info = H - M - 31 * mm
    c.setFont("NunitoX", 11); c.setFillColor(INK)
    c.drawString(M + 6 * mm, y_info, "Año:")
    c.setFont("Nunito", 11); c.drawString(M + 16 * mm, y_info, car["year"])
    c.setFont("NunitoX", 11); c.drawString(M + 30 * mm, y_info, "Piloto:")
    dsize = text_fit(c, car["driver"], "Nunito", 11, W - 2 * M - 52 * mm, 8)
    c.setFont("Nunito", dsize); c.drawString(M + 44 * mm, y_info, car["driver"])
    c.setStrokeColor(HexColor("#dddddd")); c.setLineWidth(0.8)
    c.line(M + 6 * mm, y_info - 3.5 * mm, W - M - 6 * mm, y_info - 3.5 * mm)

    # right column
    colw = 58 * mm
    colx = W - M - 6 * mm - colw
    top = y_info - 7 * mm
    # reference photo
    c.setFont("NunitoX", 9); c.setFillColor(INK); c.drawString(colx, top - 3 * mm, "La foto de verdad:")
    ref = Image.open(f"art/{k}_ref.jpg")
    pw = colw; ph = pw * ref.height / ref.width
    if ph > 46 * mm: ph = 46 * mm; pw = ph * ref.width / ref.height
    py = top - 6 * mm - ph
    px = colx + (colw - pw) / 2
    c.drawImage(f"art/{k}_ref.jpg", px, py, pw, ph)
    c.setStrokeColor(INK); c.setLineWidth(1); c.rect(px, py, pw, ph)
    yy = py - 3 * mm
    lic = " / ".join(meta["license"]) or "ver créditos"
    author = meta["author"].replace("Unknown authorUnknown author", "Autor desconocido").strip() or "ver créditos"
    if len(author) > 60: author = author[:57] + "…"
    note = NOTES.get(k)
    if note:
        yy = para(c, note, colx, yy, colw, "Nunito", 7, 8.5, GREY)
    yy = para(c, f"Foto: {author} · {lic} · Wikimedia Commons", colx, yy, colw, "Nunito", 6.5, 8, GREY)
    # flag
    fy_top = yy - 4 * mm
    c.setFont("NunitoX", 9); c.setFillColor(INK)
    c.drawString(colx, fy_top - 3 * mm, f"Pintá la bandera de {FLAGS[car['flag']]}:")
    fw = 50 * mm; fh = fw * 0.6
    if car["flag"] == "reinounido": fh = fw * 0.5
    if car["flag"] == "eeuu": fh = fw * 0.53
    fx = colx + (colw - fw) / 2; fyy = fy_top - 7 * mm - fh
    flag(c, car["flag"], fx, fyy, fw, fh)

    # fun fact box (right column, under the flag)
    boxx = colx; boxw = colw; boxy = M + 5 * mm
    fs = 10
    while True:
        lines = simpleSplit(car["fact"], "Nunito", fs, boxw - 8 * mm)
        boxh = 11 * mm + len(lines) * fs * 1.3 + 3 * mm
        if boxy + boxh < fyy - 5 * mm or fs <= 8: break
        fs -= 0.5
    col_s = HexColor(SEC[car["sec"]][3])
    rrect(c, boxx, boxy, boxw, boxh, r=4 * mm, lw=1.4, col=col_s, fill=1, fillcol=HexColor("#fbfbfb"))
    c.setFont("Baloo", 13); c.setFillColor(col_s)
    c.drawString(boxx + 4 * mm, boxy + boxh - 8 * mm, "¿Sabías que...?")
    c.setFont("Nunito", fs); c.setFillColor(INK)
    ty = boxy + boxh - 13.5 * mm
    for ln in lines:
        c.drawString(boxx + 4 * mm, ty, ln); ty -= fs * 1.3

    # line art (main area: everything left of the column)
    ax0, ax1 = M + 6 * mm, colx - 6 * mm
    ay0, ay1 = M + 7 * mm, y_info - 6 * mm
    jp, (iw, ih) = bw(f"art/{k}_line.png")
    aw, ah = ax1 - ax0, ay1 - ay0
    s = min(aw / iw, ah / ih)
    dw, dh = iw * s, ih * s
    c.drawImage(jp, ax0 + (aw - dw) / 2, ay0 + (ah - dh) / 2, dw, dh)
    footer(c, page)

def cover(c, page):
    rrect(c, M, M, W - 2 * M, H - 2 * M, r=6 * mm, lw=2.4)
    checkered(c, M + 6 * mm, H - M - 14 * mm, W - 2 * M - 12 * mm, 8 * mm)
    checkered(c, M + 6 * mm, M + 6 * mm, W - 2 * M - 12 * mm, 8 * mm)
    c.setFont("Baloo", 40); c.setFillColor(INK)
    c.drawCentredString(W / 2, H - M - 33 * mm, "¡Autos de carrera para pintar!")
    c.setFont("NunitoB", 13); c.setFillColor(GREY)
    c.drawCentredString(W / 2, H - M - 42 * mm, "Autos argentinos · Autos del mundo · El TC de hoy · Campeones históricos del TC")
    jp, (iw, ih) = bw("art/tc_camaro_line.png")
    aw, ah = 200 * mm, 95 * mm
    s = min(aw / iw, ah / ih); dw, dh = iw * s, ih * s
    c.drawImage(jp, (W - dw) / 2, M + 34 * mm + (ah - dh) / 2, dw, dh)
    c.setFont("NunitoX", 14); c.setFillColor(INK)
    c.drawString(W / 2 - 75 * mm, M + 22 * mm, "Este libro es de:")
    c.setLineWidth(1.2); c.line(W / 2 - 33 * mm, M + 21.5 * mm, W / 2 + 75 * mm, M + 21.5 * mm)
    footer(c, page)

def howto(c, page):
    rrect(c, M, M, W - 2 * M, H - 2 * M, r=6 * mm, lw=2.2)
    c.setFont("Baloo", 30); c.setFillColor(INK); c.drawString(M + 10 * mm, H - M - 22 * mm, "¿Cómo se usa este libro?")
    items = [
        ("1", "Cada dibujo está calcado de una foto real de ese auto. Arriba a la derecha está la foto en colores, chiquita, para que veas cómo es de verdad."),
        ("2", "Podés pintarlo igual que la foto... ¡o inventar tus propios colores y diseños, como hacen los equipos de carrera!"),
        ("3", "Al lado de cada auto hay una bandera para pintar: es la del país del auto o de su piloto."),
        ("4", "Leé el '¿Sabías que...?' de cada página: ¡vas a aprender un montón de cosas de autos y pilotos!"),
        ("5", "Cuando termines todos, pedile a un grande que complete tu diploma de la última página."),
    ]
    y = H - M - 40 * mm
    for n, t in items:
        c.setFillColor(white); c.setStrokeColor(INK); c.setLineWidth(1.6)
        c.circle(M + 18 * mm, y + 1.5 * mm, 5.5 * mm, stroke=1, fill=0)
        c.setFont("Baloo", 18); c.setFillColor(INK); c.drawCentredString(M + 18 * mm, y - 1.5 * mm, n)
        para(c, t, M + 28 * mm, y + 2.5 * mm, W - 2 * M - 45 * mm, "Nunito", 13, 17)
        y -= 25 * mm
    c.setFont("NunitoB", 9.5); c.setFillColor(GREY)
    c.drawString(M + 10 * mm, M + 10 * mm, "Todas las fotos son de Wikimedia Commons, con licencias libres. Los autores están en la página de créditos.")
    footer(c, page)

def section_page(c, sec, page):
    _, title, sub, col = SEC[sec]
    rrect(c, M, M, W - 2 * M, H - 2 * M, r=6 * mm, lw=2.2)
    checkered(c, M + 6 * mm, H / 2 + 26 * mm, W - 2 * M - 12 * mm, 12 * mm, sq=6 * mm)
    checkered(c, M + 6 * mm, H / 2 - 38 * mm, W - 2 * M - 12 * mm, 12 * mm, sq=6 * mm)
    c.setFont("Baloo", 40); c.setFillColor(HexColor(col)); c.drawCentredString(W / 2, H / 2 + 2 * mm, title)
    c.setFont("NunitoB", 14); c.setFillColor(INK); c.drawCentredString(W / 2, H / 2 - 12 * mm, sub)
    names = [x["name"] for x in CARS if x["sec"] == sec]
    c.setFont("Nunito", 11); c.setFillColor(GREY)
    yy = H / 2 - 52 * mm
    for ln in simpleSplit("  ·  ".join(names), "Nunito", 11, W - 2 * M - 30 * mm):
        c.drawCentredString(W / 2, yy, ln); yy -= 14
    footer(c, page)

def credits(c, page0):
    page = page0
    def head(cont=False):
        rrect(c, M, M, W - 2 * M, H - 2 * M, r=6 * mm, lw=2.2)
        c.setFont("Baloo", 24); c.setFillColor(INK)
        c.drawString(M + 8 * mm, H - M - 16 * mm, "Créditos de las fotos" + (" (continuación)" if cont else ""))
        y = H - M - 22 * mm
        if not cont:
            y = para(c, "Todas las fotos de referencia vienen de Wikimedia Commons (commons.wikimedia.org) y tienen licencias libres. "
                        "Cada dibujo para colorear es un calco hecho a partir de su foto (una obra derivada) y se comparte con la misma licencia que la foto original. "
                        "Las fotos se usan achicadas y sin otros cambios. Licencias: CC BY / CC BY-SA = Creative Commons Atribución (y Compartir Igual) — creativecommons.org/licenses; "
                        "CC0 y Dominio público = sin restricciones; GFDL = GNU Free Documentation License.",
                     M + 8 * mm, y, W - 2 * M - 16 * mm, "Nunito", 8.5, 10.5, INK)
            y -= 3 * mm
        return y
    y = head()
    colw = (W - 2 * M - 22 * mm) / 2
    col = 0
    x0 = M + 8 * mm
    ytop = y
    for i, car in enumerate(CARS, 1):
        meta = json.load(open(f"art/{car['key']}_meta.json"))
        author = meta["author"].replace("Unknown authorUnknown author", "Autor desconocido").strip() or "—"
        if len(author) > 110: author = author[:107] + "…"
        fname = meta["file"]
        txt = [(f"{i}. {car['name']}", "NunitoX", 8.5),
               (f"Archivo: {fname}", "Nunito", 7.2),
               (f"Autor: {author}  ·  Licencia: {' / '.join(meta['license']) or 'ver página del archivo'}", "Nunito", 7.2),
               ("URL", "Nunito", 6.6)]
        url = "https://commons.wikimedia.org/wiki/" + fname.replace(" ", "_")
        ulines = charwrap(url, "Nunito", 6.6, colw)
        need = sum(len(simpleSplit(t, f, s, colw)) * (s * 1.22) for t, f, s in txt[:-1]) + len(ulines) * 8 + 3
        if y - need < M + 12 * mm:
            if col == 0:
                col = 1; y = ytop
            else:
                footer(c, page); c.showPage(); page += 1; y = head(True); ytop = y; col = 0
        x = x0 + col * (colw + 6 * mm)
        for t, f, s in txt[:-1]:
            y = para(c, t, x, y, colw, f, s, s * 1.22, INK if f == "NunitoX" else HexColor("#444444"))
        c.setFont("Nunito", 6.6); c.setFillColor(HexColor("#2E86AB"))
        for ln in ulines: c.drawString(x, y, ln); y -= 8
        y -= 3
    footer(c, page)
    return page

def diploma(c, page):
    gold = HexColor("#C9A227")
    rrect(c, M, M, W - 2 * M, H - 2 * M, r=6 * mm, lw=3, col=gold)
    rrect(c, M + 4 * mm, M + 4 * mm, W - 2 * M - 8 * mm, H - 2 * M - 8 * mm, r=4 * mm, lw=1.2, col=gold)
    checkered(c, M + 10 * mm, H - M - 20 * mm, 40 * mm, 8 * mm)
    checkered(c, W - M - 50 * mm, H - M - 20 * mm, 40 * mm, 8 * mm)
    c.setFont("Baloo", 44); c.setFillColor(INK); c.drawCentredString(W / 2, H - M - 30 * mm, "DIPLOMA")
    c.setFont("BalooM", 18); c.setFillColor(gold); c.drawCentredString(W / 2, H - M - 40 * mm, "de Campeón Pintor de Autos de Carrera")
    c.setFont("Nunito", 14); c.setFillColor(INK); c.drawCentredString(W / 2, H - M - 56 * mm, "Se otorga a")
    c.setLineWidth(1.2); c.setStrokeColor(INK); c.line(W / 2 - 80 * mm, H - M - 72 * mm, W / 2 + 80 * mm, H - M - 72 * mm)
    yy = H - M - 84 * mm; c.setFont("Nunito", 13); c.setFillColor(INK)
    for ln in simpleSplit("por haber pintado los 23 autos de este libro y aprendido un montón sobre los grandes autos deportivos "
                          "de Argentina y del mundo, el Turismo Carretera y sus campeones. ¡Bandera a cuadros!", "Nunito", 13, 190 * mm):
        c.drawCentredString(W / 2, yy, ln); yy -= 17
    # trophy (outline to color)
    tx, ty = W / 2, M + 42 * mm
    c.setLineWidth(1.6); c.setStrokeColor(INK); c.setFillColor(white)
    p = c.beginPath(); p.moveTo(tx - 16 * mm, ty + 30 * mm); p.lineTo(tx + 16 * mm, ty + 30 * mm)
    p.curveTo(tx + 16 * mm, ty + 12 * mm, tx + 8 * mm, ty + 6 * mm, tx + 3 * mm, ty + 5 * mm)
    p.lineTo(tx + 3 * mm, ty); p.lineTo(tx - 3 * mm, ty); p.lineTo(tx - 3 * mm, ty + 5 * mm)
    p.curveTo(tx - 8 * mm, ty + 6 * mm, tx - 16 * mm, ty + 12 * mm, tx - 16 * mm, ty + 30 * mm); p.close()
    c.drawPath(p, stroke=1, fill=0)
    for sgn in (-1, 1):
        q = c.beginPath(); q.moveTo(tx + sgn * 16 * mm, ty + 27 * mm)
        q.curveTo(tx + sgn * 25 * mm, ty + 27 * mm, tx + sgn * 24 * mm, ty + 14 * mm, tx + sgn * 11 * mm, ty + 13 * mm)
        c.drawPath(q, stroke=1, fill=0)
    c.rect(tx - 9 * mm, ty - 6 * mm, 18 * mm, 6 * mm, stroke=1, fill=0)
    c.rect(tx - 13 * mm, ty - 11 * mm, 26 * mm, 5 * mm, stroke=1, fill=0)
    star(c, tx, ty + 19 * mm, 6 * mm)
    # signature / date
    c.setFont("Nunito", 11); c.setFillColor(INK)
    c.line(M + 25 * mm, M + 25 * mm, M + 95 * mm, M + 25 * mm); c.drawCentredString(M + 60 * mm, M + 20 * mm, "Fecha")
    c.line(W - M - 95 * mm, M + 25 * mm, W - M - 25 * mm, M + 25 * mm); c.drawCentredString(W - M - 60 * mm, M + 20 * mm, "Firma del jefe de equipo")
    for sx in (M + 30 * mm, W - M - 30 * mm):
        star(c, sx, M + 50 * mm, 7 * mm)

def build(out):
    c = canvas.Canvas(out, pagesize=(W, H))
    c.setTitle("¡Autos de carrera para pintar!"); c.setAuthor("Libro para colorear")
    c.setSubject("Libro para colorear con autos deportivos reales; fotos de Wikimedia Commons")
    page = 1
    cover(c, page); c.showPage(); page += 1
    howto(c, page); c.showPage(); page += 1
    total = len(CARS); idx = 0
    for sec in [s[0] for s in SECTIONS]:
        section_page(c, sec, page); c.showPage(); page += 1
        for car in [x for x in CARS if x["sec"] == sec]:
            idx += 1
            car_page(c, car, idx, total, page); c.showPage(); page += 1
    page = credits(c, page); c.showPage(); page += 1
    diploma(c, page); c.showPage()
    c.save()

if __name__ == "__main__":
    import sys
    build(sys.argv[1] if len(sys.argv) > 1 else "libro.pdf")
