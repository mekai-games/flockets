#!/usr/bin/env python3
"""Portachiavi Flockets da stampare in 3D.

Genera gli STL (e un 3MF a più parti quando c'è un QR da stampare in due colori) di:
  B  targhetta   targhetta verticale con omino e nome, QR e logo sul retro
  Q  quadrato    quadrato con logo e nome davanti, QR sul retro

Tutti hanno il foro in cima al centro. Il retro (z = 0) va sul piatto, il rilievo guarda in alto.

Uso:
  stampa3d/.venv/bin/python stampa3d/genera.py                      # tutti, omino 0, senza QR
  stampa3d/.venv/bin/python stampa3d/genera.py --omino 5 --nome "FLOCKETS"
  stampa3d/.venv/bin/python stampa3d/genera.py --qr "https://flockets.vercel.app"
"""
import argparse
import json
import re
from functools import reduce
from pathlib import Path

import numpy as np
import qrcode
import trimesh
from manifold3d import CrossSection, FillRule, Manifold
from matplotlib.font_manager import FontProperties
from matplotlib.textpath import TextPath
from PIL import Image
from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent
ATLANTE = RADICE / 'web/assets/personaggi.png'
META = RADICE / 'web/assets/personaggi.json'
LOGO = RADICE / 'design/logo.svg'
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'

# misure in mm, pensate per ugello 0.4 e layer 0.2
SPESSORE = 3.0      # piastra
RILIEVO = 1.0       # scritte e logo
BORDINO = 0.8       # cornice in rilievo lungo il bordo
LARGH_BORDINO = 1.2
FORO = 4.5          # diametro del foro per l'anellino
PARETE_FORO = 2.5   # materiale attorno al foro
INCISIONE = 0.4     # profondità di logo e segni incisi sul retro
QR_SPESSORE = 0.6   # spessore dell'intarsio del QR (3 layer da 0.2)
# rilievo dell'omino in base alla luminosità del pixel: il contorno scuro sta più in alto
LIVELLI_OMINO = [(60, 1.4), (140, 1.0), (256, 0.6)]


# ---------- geometria 2D ----------

def poligoni(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon) and not p.is_empty]


def estrudi(g, z0, h):
    """Estrude la geometria 2D da z0 a z0 + h."""
    g = g.buffer(0)
    anelli = []
    for p in poligoni(g):
        anelli.append(np.asarray(p.exterior.coords)[:-1])
        anelli += [np.asarray(r.coords)[:-1] for r in p.interiors]
    if not anelli:
        return Manifold()
    return CrossSection(anelli, FillRule.EvenOdd).extrude(h).translate((0, 0, z0))


def specchia(g):
    """Le cose sul retro si leggono girando il pezzo: vanno specchiate in x."""
    return affinity.scale(g, -1, 1, origin=(0, 0))


def rettangolo(cx, cy, w, h, r=0):
    b = box(cx - w / 2 + r, cy - h / 2 + r, cx + w / 2 - r, cy + h / 2 - r)
    return b.buffer(r, quad_segs=16) if r else b


def cerchio(cx, cy, r):
    return Point(cx, cy).buffer(r, quad_segs=32)


def bordino(forma):
    return forma.difference(forma.buffer(-LARGH_BORDINO, quad_segs=16))


def centra(g, cx=0, cy=0):
    x0, y0, x1, y1 = g.bounds
    return affinity.translate(g, cx - (x0 + x1) / 2, cy - (y0 + y1) / 2)


# ---------- testo, logo, QR ----------

def testo(s, cap, larghezza_max=None):
    """Scritta centrata in (0, 0); cap = altezza delle maiuscole in mm."""
    fp = FontProperties(fname=FONT)
    g = Polygon()
    for anello in TextPath((0, 0), s, size=10, prop=fp).to_polygons(closed_only=True):
        if len(anello) >= 3:
            g = g.symmetric_difference(Polygon(anello).buffer(0))
    hx = TextPath((0, 0), 'H', size=10, prop=fp).get_extents()
    k = cap / hx.height
    g = affinity.scale(g, k, k, origin=(0, 0))
    w = g.bounds[2] - g.bounds[0]
    if larghezza_max and w > larghezza_max:
        g = affinity.scale(g, larghezza_max / w, larghezza_max / w, origin=(0, 0))
    return centra(g)


def _bezier(p0, c, p1, n=16):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1


def logo(altezza):
    """Il logo (lo stormo) da design/logo.svg, alto `altezza` mm e centrato in (0, 0)."""
    svg = LOGO.read_text()
    pezzi = []
    for d in re.findall(r'<path d="([^"]+)"', svg):
        tok = re.findall(r'[A-Za-z]|-?\d*\.?\d+', d)
        pts, i, cur = [], 0, None
        while i < len(tok):
            t = tok[i]
            if t == 'M':
                cur = np.array([float(tok[i + 1]), float(tok[i + 2])]); pts.append(cur); i += 3
            elif t == 'Q':
                c = np.array([float(tok[i + 1]), float(tok[i + 2])])
                p1 = np.array([float(tok[i + 3]), float(tok[i + 4])])
                pts += list(_bezier(cur, c, p1)[1:]); cur = p1; i += 5
            else:
                i += 1
        pezzi.append(Polygon(pts).buffer(0.4, join_style='round'))   # stroke-width .8
    for cx, cy, r in re.findall(r'<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"', svg):
        pezzi.append(cerchio(float(cx), float(cy), float(r)))
    g = affinity.scale(unary_union(pezzi), 1, -1, origin=(24, 24))       # in SVG la y va in giù
    k = altezza / (g.bounds[3] - g.bounds[1])
    g = affinity.scale(g, k, k, origin=(0, 0))
    return centra(g.buffer(0.15))   # code degli uccelli almeno ~0.7 mm: l'ugello da 0.4 le stampa


def qr_moduli(dati, lato):
    """Moduli scuri del QR in un quadrato di `lato` mm centrato in (0, 0), margine di 2 moduli compreso."""
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, border=0, box_size=1)
    q.add_data(dati)
    q.make(fit=True)
    m = np.array(q.get_matrix(), dtype=bool)
    n = m.shape[0]
    mod = lato / (n + 4)
    if mod < 0.79:
        print(f'  attenzione: moduli del QR da {mod:.2f} mm, sotto 0.8 mm si leggono male. Accorcia il link.')
    o = -lato / 2 + 2 * mod
    quadri = [box(o + c * mod, -(o + (r + 1) * mod), o + (c + 1) * mod, -(o + r * mod))
              for r in range(n) for c in range(n) if m[r, c]]
    return unary_union([b.buffer(0.001, join_style='mitre') for b in quadri]), n, mod


def segni_qr(lato, cx=0, cy=0, l=4.0, s=0.8):
    """Quattro angoli a L che segnano dove va l'adesivo del QR."""
    h = lato / 2
    angoli = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx * h, cy + sy * h
            angoli.append(box(min(x, x - sx * l), min(y, y - sy * s), max(x, x - sx * l), max(y, y - sy * s)))
            angoli.append(box(min(x, x - sx * s), min(y, y - sy * l), max(x, x - sx * s), max(y, y - sy * l)))
    return unary_union(angoli)


# ---------- omino ----------

class Omino:
    """Il primo fotogramma di un personaggio di web/assets/personaggi.png, in mm (pixel di lato P)."""

    def __init__(self, idx, P):
        meta = json.loads(META.read_text())
        im = np.array(Image.open(ATLANTE).convert('RGBA'))
        x0, y0 = (idx % meta['colonne']) * meta['foglio'][0], (idx // meta['colonne']) * meta['foglio'][1]
        F = meta['fotogramma']
        f = im[y0:y0 + F, x0:x0 + F]
        pieno = f[..., 3] > 40
        ys, xs = np.where(pieno)
        self.nome = meta['nomi'][idx]
        self.pieno = pieno[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        self.rgb = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1, :3].astype(float)
        self.P = P
        self.h_px, self.w_px = self.pieno.shape
        self.larghezza, self.altezza = self.w_px * P, self.h_px * P
        self.x, self.y = 0.0, 0.0   # centro del riquadro dell'omino

    def colloca(self, cx=None, cima=None, fondo=None):
        if cx is not None:
            self.x = cx
        if cima is not None:
            self.y = cima - self.altezza / 2
        if fondo is not None:
            self.y = fondo + self.altezza / 2
        return self

    @property
    def cima(self):
        return self.y + self.altezza / 2

    @property
    def fondo(self):
        return self.y - self.altezza / 2

    def pixel(self, r, c):
        """Quadratino del pixel (riga r, colonna c), in mm."""
        P = self.P
        x0 = self.x - self.larghezza / 2 + c * P
        y1 = self.cima - r * P
        return box(x0, y1 - P, x0 + P, y1)

    def rilievo(self, z0):
        """Rilievo a gradini: più scuro il pixel, più alto (il contorno nero sta in cima)."""
        lum = self.rgb @ np.array([0.299, 0.587, 0.114])
        alt = np.zeros(lum.shape)
        for soglia, h in reversed(LIVELLI_OMINO):
            alt[lum < soglia] = h
        alt[~self.pieno] = 0
        corpo = Manifold()
        for h in sorted({h for _, h in LIVELLI_OMINO}):
            zona = unary_union([self.pixel(r, c).buffer(0.001, join_style='mitre')
                                for r, c in zip(*np.where(alt >= h))])
            corpo = corpo + estrudi(zona, z0, h)
        return corpo

# ---------- foro e pezzi comuni ----------

def foro_interno(cx, y_cima):
    """Centro del foro dentro una piastra il cui bordo alto sta a y_cima."""
    return cx, y_cima - FORO / 2 - PARETE_FORO


def buca(corpo, centro):
    return corpo - estrudi(cerchio(*centro, FORO / 2), -1, 20)


def retro_qr(corpo, lato, cx, cy, dati):
    """Sul retro: segni per l'adesivo, oppure (con --qr) l'intarsio del QR da stampare in un secondo colore."""
    if not dati:
        return corpo - estrudi(specchia(segni_qr(lato, cx, cy)), -1, 1 + INCISIONE), None
    moduli, n, mod = qr_moduli(dati, lato)
    print(f'  QR {n}x{n} moduli da {mod:.2f} mm su {lato:.1f} mm')
    intarsio = estrudi(specchia(affinity.translate(moduli, cx, cy)), 0, QR_SPESSORE)
    return corpo - intarsio, intarsio


# ---------- i modelli ----------

def targhetta(a):
    W, H = 36.0, 60.0
    forma = rettangolo(0, 0, W, H, 5)
    foro = foro_interno(0, H / 2)
    om = Omino(a.omino, 1.2).colloca(cx=0, cima=foro[1] - FORO / 2 - 1.5)
    corpo = estrudi(forma, 0, SPESSORE)
    corpo += estrudi(bordino(forma), SPESSORE, BORDINO)
    corpo += om.rilievo(SPESSORE)
    y_nome = (om.fondo + (-H / 2 + LARGH_BORDINO)) / 2
    corpo += estrudi(affinity.translate(testo(a.nome, 4.8, W - 7), 0, y_nome), SPESSORE, RILIEVO)
    # retro: QR in alto, logo inciso sotto
    lato = W - 8
    corpo, qr = retro_qr(corpo, lato, 0, foro[1] - FORO / 2 - 2.5 - lato / 2, a.qr)
    y_logo = (foro[1] - FORO / 2 - 2.5 - lato + (-H / 2)) / 2
    corpo -= estrudi(specchia(affinity.translate(logo(10), 0, y_logo)), -1, 1 + INCISIONE)
    return buca(corpo, foro), qr


def quadrato(a):
    L = 42.0
    forma = rettangolo(0, 0, L, L, 5)
    foro = foro_interno(0, L / 2)
    corpo = estrudi(forma, 0, SPESSORE)
    corpo += estrudi(bordino(forma), SPESSORE, BORDINO)
    corpo += estrudi(affinity.translate(logo(17), 0, 3.0), SPESSORE, RILIEVO)
    corpo += estrudi(affinity.translate(testo(a.nome, 5.2, L - 9), 0, -13.0), SPESSORE, RILIEVO)
    corpo, qr = retro_qr(corpo, 28, 0, -3, a.qr)
    return buca(corpo, foro), qr


MODELLI = {
    'B_targhetta': targhetta,
    'Q_quadrato': quadrato,
}


# ---------- uscita ----------

def a_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=True)


def salva(nome, corpo, qr, cartella):
    cartella.mkdir(parents=True, exist_ok=True)
    tm = a_trimesh(corpo)
    assert tm.is_watertight, f'{nome}: mesh non chiusa'
    x0, y0, z0 = tm.bounds[0]
    x1, y1, z1 = tm.bounds[1]
    if qr is None:
        tm.export(cartella / f'{nome}.stl')
        print(f'{nome}.stl  {x1 - x0:.1f} x {y1 - y0:.1f} x {z1 - z0:.1f} mm, {tm.volume / 1000:.1f} cm3')
    else:
        tq = a_trimesh(qr)
        tm.export(cartella / f'{nome}_corpo.stl')
        tq.export(cartella / f'{nome}_qr.stl')
        scena = trimesh.Scene()
        scena.add_geometry(tm, node_name='corpo', geom_name='corpo')
        scena.add_geometry(tq, node_name='qr', geom_name='qr')
        scena.export(cartella / f'{nome}.3mf')
        print(f'{nome}.3mf (corpo + qr)  {x1 - x0:.1f} x {y1 - y0:.1f} x {z1 - z0:.1f} mm')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--omino', type=int, default=0, help='numero del personaggio (0-99, vedi web/assets/personaggi.json)')
    p.add_argument('--nome', default='FLOCKETS', help='la scritta')
    p.add_argument('--qr', default=None, help='testo o link del QR; senza, il retro ha solo i segni per l\'adesivo')
    p.add_argument('--solo', nargs='*', default=None, help='solo questi modelli (es. Q_quadrato)')
    p.add_argument('--cartella', default=str(QUI / 'modelli'))
    a = p.parse_args()
    for nome, fn in MODELLI.items():
        if a.solo and nome not in a.solo:
            continue
        corpo, qr = fn(a)
        salva(nome, corpo, qr, Path(a.cartella))


if __name__ == '__main__':
    main()
