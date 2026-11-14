#!/usr/bin/env python3
"""Anteprime PNG (fronte e retro) dei modelli in stampa3d/modelli.

Vista dall'alto con ombreggiatura, come se fosse stampato con due cambi di filamento:
scuro fino a 3.0 mm, chiaro fino a 4.0 mm, poi di nuovo scuro (contorni dell'omino, scritte sul cartello).
Con il QR intarsiato: corpo chiaro, QR scuro.
Uso: stampa3d/.venv/bin/python stampa3d/anteprima.py [cartella]
"""
import sys
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont

QUI = Path(__file__).resolve().parent
RIS = 0.1                    # mm per pixel
SCURO = np.array([30, 32, 38])
CHIARO = np.array([244, 242, 236])
SFONDO = np.array([255, 255, 255])
CAMBI = (3.0, 4.0)       # da scuro a chiaro, da chiaro a scuro


def mappa(mesh, xmin, ymax, W, H):
    """Altezza massima della superficie per pixel (z-buffer ortogonale dall'alto)."""
    z = np.full((H, W), -np.inf)
    T = mesh.triangles
    for t in T[mesh.face_normals[:, 2] > 1e-6]:
        px = (t[:, 0] - xmin) / RIS
        py = (ymax - t[:, 1]) / RIS
        x0, x1 = int(max(np.floor(px.min()), 0)), int(min(np.ceil(px.max()), W - 1))
        y0, y1 = int(max(np.floor(py.min()), 0)), int(min(np.ceil(py.max()), H - 1))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, bx, cx), (ay, by, cy) = px, py
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-12:
            continue
        l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
        l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
        l3 = 1 - l1 - l2
        dentro = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
        zz = l1 * t[0, 2] + l2 * t[1, 2] + l3 * t[2, 2]
        blocco = z[y0:y1 + 1, x0:x1 + 1]
        np.maximum(blocco, np.where(dentro, zz, -np.inf), out=blocco)
    return z


def ombra(z):
    zz = np.where(np.isfinite(z), z, np.nan)
    gy, gx = np.gradient(np.nan_to_num(zz, nan=np.nanmin(zz)), RIS)
    n = np.dstack([-gx, gy, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    luce = np.array([-0.5, 0.6, 1.0]); luce /= np.linalg.norm(luce)
    return np.clip(0.55 + 0.45 * (n @ luce) / luce[2], 0.35, 1.1)


def immagine(parti, retro):
    tutte = []
    for mesh, ruolo in parti:
        m = mesh.copy()
        if retro:   # girato come una pagina: x -> -x, z -> -z
            m.apply_transform(np.diag([-1, 1, -1, 1]))
        tutte.append((m, ruolo))
    v = np.vstack([m.vertices for m, _ in tutte])
    xmin, ymax = v[:, 0].min() - 1, v[:, 1].max() + 1
    W = int((v[:, 0].max() + 1 - xmin) / RIS) + 1
    H = int((ymax - v[:, 1].min() + 1) / RIS) + 1
    zs = {ruolo: mappa(m, xmin, ymax, W, H) for m, ruolo in tutte}
    z = np.max(np.stack(list(zs.values())), axis=0)
    col = np.tile(SFONDO, (H, W, 1)).astype(float)
    pieno = np.isfinite(z)
    if 'qr' in zs:   # intarsio: corpo chiaro, moduli scuri
        col[pieno] = CHIARO * 0.93
        col[np.isfinite(zs['qr']) & (zs['qr'] >= z - 1e-3)] = SCURO
    else:
        col[pieno] = SCURO
        if not retro:
            col[pieno & (z > CAMBI[0] + 1e-3) & (z <= CAMBI[1] + 1e-3)] = CHIARO
    col[pieno] *= ombra(z)[pieno][:, None]
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))


def parti_di(cartella, nome):
    stl = cartella / f'{nome}.stl'
    if stl.exists():
        return [(trimesh.load(stl), 'corpo')]
    return [(trimesh.load(cartella / f'{nome}_corpo.stl'), 'corpo'),
            (trimesh.load(cartella / f'{nome}_qr.stl'), 'qr')]


def main():
    cartella = Path(sys.argv[1]) if len(sys.argv) > 1 else QUI / 'modelli'
    nomi = sorted({p.stem.replace('_corpo', '') for p in cartella.glob('*.stl') if not p.stem.endswith('_qr')})
    cella, margine, testa = 760, 30, 60
    foglio = Image.new('RGB', (len(nomi) * cella, 2 * cella + testa), 'white')
    d = ImageDraw.Draw(foglio)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    except OSError:
        font = ImageFont.load_default()
    for i, nome in enumerate(nomi):
        parti = parti_di(cartella, nome)
        for j, retro in enumerate((False, True)):
            im = immagine(parti, retro)
            im.save(cartella / f'{nome}_{"retro" if retro else "fronte"}.png')
            k = (cella - 2 * margine) / max(im.size)
            im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
            foglio.paste(im, (i * cella + (cella - im.width) // 2, testa + j * cella + (cella - im.height) // 2))
        d.text((i * cella + cella // 2, 18), nome.replace('_', ' '), fill='black', font=font, anchor='mt')
    out = cartella / 'anteprima.png'
    foglio.save(out)
    print(out)


if __name__ == '__main__':
    main()
