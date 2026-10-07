# Tira o chão de grama (e a terra) dos baús: fica só o baú, as moedas e o cadeado; a sombra o jogo desenha (renderer.drawSite).
# Uso: python scripts/strip-ground.py  → grava docs/arte/iso/<nome>-nograss.png, que o prepare-art usa no lugar da original.
import colorsys
from PIL import Image, ImageFilter
from collections import deque
for name in ['chest','chest-open']:
    im = Image.open(f'docs/arte/iso/{name}.png').convert('RGBA')
    px = im.load(); W,H = im.size
    for y in range(H):
        for x in range(W):
            r,g,b,a = px[x,y]
            if a == 0: continue
            h,l,sat = colorsys.rgb_to_hls(r/255,g/255,b/255)
            if 0.17 < h < 0.5 and sat > 0.05 and g >= r and l < 0.85:
                px[x,y] = (0,0,0,0)
            elif 0.02 < h < 0.12 and 0.15 < sat < 0.45 and 0.35 < l < 0.65:  # terra (a madeira é mais saturada)
                px[x,y] = (0,0,0,0)
    seen = [[False]*W for _ in range(H)]
    comps=[]
    for y in range(H):
        for x in range(W):
            if seen[y][x] or px[x,y][3] < 200: continue
            comp=[]; q=deque([(x,y)]); seen[y][x]=True
            while q:
                cx,cy=q.popleft(); comp.append((cx,cy))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=cx+dx,cy+dy
                    if 0<=nx<W and 0<=ny<H and not seen[ny][nx] and px[nx,ny][3]>=200:
                        seen[ny][nx]=True; q.append((nx,ny))
            comps.append(comp)
    big = max(comps, key=len)
    for comp in comps:
        if comp is big: continue
        n=len(comp); r=sum(px[x,y][0] for x,y in comp)/n; g=sum(px[x,y][1] for x,y in comp)/n; b=sum(px[x,y][2] for x,y in comp)/n
        h,l,sat = colorsys.rgb_to_hls(r/255,g/255,b/255)
        coin = r > 150 and g > 110 and b < 110 and n > 400 and sat > 0.5
        lock = sat < 0.25 and n > 1500 and 0.25 < l < 0.7 and abs(r-b) < 40
        if not (coin or lock):
            for x,y in comp: px[x,y]=(0,0,0,0)
        else:
            # terra embaixo do cadeado: tira o marrom
            for x,y in comp:
                rr,gg,bb,_ = px[x,y]
                hh,ll,ss = colorsys.rgb_to_hls(rr/255,gg/255,bb/255)
                if 0.1 < ss < 0.6 and hh < 0.11 and 0.3 < ll < 0.65: px[x,y]=(0,0,0,0)
    # fiapos da grama colados embaixo do baú: abertura morfológica (some o que é fino) só na metade de baixo
    ys=[y for _,y in big]; top,bot=min(ys),max(ys); cut=top+(bot-top)*0.55
    mask=Image.new('L',(W,H),0); mp=mask.load()
    for x,y in big: mp[x,y]=255
    opened=mask.filter(ImageFilter.MinFilter(17)).filter(ImageFilter.MaxFilter(17)); op=opened.load()
    for x,y in big:
        if y > cut and op[x,y]==0: px[x,y]=(0,0,0,0)
    # borda escura que sobrou colada embaixo do baú: pixels quase pretos esverdeados
    for y in range(H):
        for x in range(W):
            if 0 < px[x,y][3] < 200:
                if not any(0<=x+dx<W and 0<=y+dy<H and px[x+dx,y+dy][3]>=200 for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))): px[x,y]=(0,0,0,0)
    im.save(f'docs/arte/iso/{name}-nograss.png')
    print(name, len(comps))
