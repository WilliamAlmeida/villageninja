# Refaz a remoção do fundo das artes isométricas (docs/arte/iso) a partir da imagem CRUA do Codex (com o fundo
# branco), usando o remove-bg.py atual. A crua é achada no .codex.txt de cada arte (caminho em generated_images).
# A versão anterior vai para docs/arte/iso/_antes-rebg/. As torres (VAOS) usam --vaos.
# Uso: python scripts/rebg.py [nome ...]      depois: python scripts/prepare-art.py
import re
import shutil
import subprocess
import sys
from pathlib import Path


ISO = Path('docs/arte/iso')
BACKUP = ISO / '_antes-rebg'
GEN = Path.home() / '.codex' / 'generated_images'


def raw_of(png: Path):
    log = png.with_name(png.name + '.codex.txt')
    if not log.exists():
        return None
    m = re.findall(r'generated_images[\\/]+([0-9a-f-]+)[\\/]+(call_[A-Za-z0-9]+\.png)', log.read_text(encoding='utf8', errors='ignore'))
    for d, f in reversed(m):  # a última imagem citada é a que foi salva
        p = GEN / d / f
        if p.exists():
            return p
    return None


# artes com vãos fechados entre vigas/escadas (o branco de dentro também é fundo): --vaos
VAOS = {'tower', 'tower-2', 'tower-3', 'port', 'ruin'}


names = sys.argv[1:]
BACKUP.mkdir(exist_ok=True)
done, skipped = [], []
for png in sorted(ISO.glob('*.png')):
    if names and png.stem not in names:
        continue
    raw = raw_of(png)
    if not raw:
        skipped.append(png.stem)
        continue
    vaos = png.stem in VAOS
    if not (BACKUP / png.name).exists():
        shutil.copy2(png, BACKUP / png.name)
    cmd = [sys.executable, 'scripts/remove-bg.py', str(raw), str(png)] + (['--vaos'] if vaos else [])
    subprocess.run(cmd, check=True, capture_output=True)
    done.append(png.stem + (' (vãos)' if vaos else ''))
print('refeitas:', len(done), ', '.join(done))
print('sem crua registrada:', ', '.join(skipped))
