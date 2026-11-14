#!/usr/bin/env python3
"""Un lotto di portachiavi con QR: codici nuovi, registrati nel database, e i file da stampare.

Ogni portachiavi ha un codice di 6 caratteri; il QR punta a https://flockets.site/#/q/CODICE.
Chi lo inquadra per primo, da collegato, lo collega a uno dei suoi progetti; da lì il QR apre quel progetto a tutti.

Per ogni codice escono:
  <modello>_<CODICE>.3mf            corpo + QR intarsiato, da stampare in due colori (AMS)
  <modello>_<CODICE>_corpo.stl / _qr.stl
e per tutto il lotto:
  adesivi.png                       i QR alla misura giusta (300 dpi), da stampare su carta adesiva
  codici.txt                        l'elenco dei codici

Serve la CLI di Supabase collegata al progetto (supabase link) e la password del database in web/.env.supabase.

Uso:
  stampa3d/.venv/bin/python stampa3d/lotto.py --modello B_targhetta --quanti 10 --omino 0
  stampa3d/.venv/bin/python stampa3d/lotto.py --modello Q_quadrato --quanti 5 --solo-adesivi
"""
import argparse
import datetime as dt
import json
import os
import secrets
import subprocess
import sys
from pathlib import Path

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent
sys.path.insert(0, str(QUI))
import genera  # noqa: E402

ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'   # niente 0/O e 1/I/L: si leggono anche a occhio
INDIRIZZO = 'https://flockets.site/#/q/{}'
LATO_QR = {'B_targhetta': 28.0, 'Q_quadrato': 28.0}   # mm, come sui modelli


def nuovo_codice():
    return ''.join(secrets.choice(ALFABETO) for _ in range(6))


def registra(codici, lotto):
    """Inserisce i codici nel database; restituisce quelli inseriti davvero (un doppione viene scartato)."""
    valori = ','.join(f"('{c}', '{lotto}')" for c in codici)
    sql = f"insert into public.qr (codice, lotto) values {valori} on conflict (codice) do nothing returning codice"
    env = dict(os.environ)
    segreti = RADICE / 'web/.env.supabase'
    if segreti.exists():
        for riga in segreti.read_text().splitlines():
            if '=' in riga:
                k, v = riga.split('=', 1)
                env.setdefault(k.strip(), v.strip())
    r = subprocess.run(['supabase', 'db', 'query', '--remote', '--yes', sql], cwd=RADICE, env=env,
                       stdin=subprocess.DEVNULL, capture_output=True, text=True)
    testo = r.stdout[r.stdout.find('{'):] if '{' in r.stdout else ''
    if r.returncode or not testo:
        sys.exit('Non riesco a registrare i codici nel database:\n' + (r.stderr or r.stdout))
    righe = json.loads(testo).get('rows') or []
    return [x['codice'] for x in righe]


def adesivi(codici, lato_mm, uscita):
    """Foglio A4 a 300 dpi con i QR alla misura del portachiavi e il codice sotto, da ritagliare."""
    import qrcode
    from PIL import Image, ImageDraw, ImageFont
    dpi = 300
    px = lambda mm: round(mm / 25.4 * dpi)
    W, H = px(210), px(297)
    margine, passo_x, passo_y = px(12), px(lato_mm + 8), px(lato_mm + 14)
    colonne = max(1, (W - 2 * margine) // passo_x)
    righe = max(1, (H - 2 * margine) // passo_y)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', px(3.2))
    except OSError:
        font = ImageFont.load_default()
    fogli = []
    for i, c in enumerate(codici):
        if i % (colonne * righe) == 0:
            fogli.append(Image.new('RGB', (W, H), 'white'))
        k = i % (colonne * righe)
        x, y = margine + (k % colonne) * passo_x, margine + (k // colonne) * passo_y
        q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, border=2, box_size=10)
        q.add_data(INDIRIZZO.format(c))
        q.make(fit=True)
        img = q.make_image(fill_color='black', back_color='white').convert('RGB').resize((px(lato_mm), px(lato_mm)), Image.NEAREST)
        f = fogli[-1]
        f.paste(img, (x, y))
        d = ImageDraw.Draw(f)
        d.rectangle([x - 1, y - 1, x + px(lato_mm), y + px(lato_mm)], outline=(200, 200, 200))   # linea di taglio
        d.text((x + px(lato_mm) // 2, y + px(lato_mm) + px(1.5)), c, fill='black', font=font, anchor='mt')
    for n, f in enumerate(fogli):
        nome = 'adesivi.png' if len(fogli) == 1 else f'adesivi_{n + 1}.png'
        f.save(uscita / nome, dpi=(dpi, dpi))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--modello', choices=list(genera.MODELLI), required=True)
    p.add_argument('--quanti', type=int, required=True)
    p.add_argument('--omino', type=int, default=0)
    p.add_argument('--nome', default='FLOCKETS')
    p.add_argument('--solo-adesivi', action='store_true', help='niente 3MF/STL: solo codici e foglio di adesivi')
    a = p.parse_args()
    if not 1 <= a.quanti <= 500:
        sys.exit('--quanti tra 1 e 500')

    oggi = dt.date.today().isoformat()
    lotto = f'{a.modello} {oggi}'
    codici = []
    while len(codici) < a.quanti:
        prova = list({nuovo_codice() for _ in range(a.quanti - len(codici))})
        codici += registra(prova, lotto)
    uscita = QUI / 'modelli' / 'lotti' / f'{oggi}_{a.modello}_{codici[0]}'
    uscita.mkdir(parents=True, exist_ok=True)
    (uscita / 'codici.txt').write_text('\n'.join(f'{c}  {INDIRIZZO.format(c)}' for c in codici) + '\n')
    print(f'{len(codici)} codici registrati (lotto «{lotto}») in {uscita.relative_to(RADICE)}')

    adesivi(codici, LATO_QR[a.modello], uscita)
    if not a.solo_adesivi:
        for c in codici:
            args = argparse.Namespace(omino=a.omino, nome=a.nome, qr=INDIRIZZO.format(c))
            corpo, qr = genera.MODELLI[a.modello](args)
            genera.salva(f'{a.modello}_{c}', corpo, qr, uscita)


if __name__ == '__main__':
    main()
