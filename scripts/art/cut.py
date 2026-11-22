# 背景（紙の灰色。明るさにむらがある）を、ふちのマスから二次の面で推し量り、端から塗りつぶして切り抜く
import sys
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
src=Image.open(sys.argv[1]).convert('RGB'); out_path=sys.argv[2]; th=float(sys.argv[3]) if len(sys.argv)>3 else 22
W,H=src.size
bl=np.asarray(src.filter(ImageFilter.GaussianBlur(3))).astype(float)
yy,xx=np.mgrid[0:H,0:W]; b=25
band=np.zeros((H,W),bool); band[:b]=band[-b:]=True; band[:,:b]=band[:,-b:]=True
X=xx[band]/W; Y=yy[band]/H
A=np.stack([np.ones_like(X),X,Y,X*X,Y*Y,X*Y],1)
Af=np.stack([np.ones(H*W),(xx/W).ravel(),(yy/H).ravel(),(xx/W).ravel()**2,(yy/H).ravel()**2,((xx/W)*(yy/H)).ravel()],1)
bg=np.zeros((H,W,3))
for c in range(3):
  coef,*_=np.linalg.lstsq(A,bl[...,c][band],rcond=None); bg[...,c]=(Af@coef).reshape(H,W)
dist=np.sqrt(((bl-bg)**2).sum(-1))
m=Image.fromarray(((dist<th)*255).astype('uint8'),'L').copy()   # fromarray のままだと塗りつぶしが効かない
for x in range(0,W,6):
  for y in (0,H-1):
    if m.getpixel((x,y))==255: ImageDraw.floodfill(m,(x,y),128)
for y in range(0,H,6):
  for x in (0,W-1):
    if m.getpixel((x,y))==255: ImageDraw.floodfill(m,(x,y),128)
reach=np.asarray(m)==128
# 紙のむらで残った小さな島を消す: 体の中の1点からつながる部分だけを残す
body=Image.fromarray(np.where(reach,0,255).astype('uint8'),'L').copy()
sx,sy=int(W*0.45),int(H*0.5)
ImageDraw.floodfill(body,(sx,sy),200)
reach=np.asarray(body)!=200
# 囲まれた紙（脚のあいだ、翼と首のあいだなど）: 背景に近い色のかたまりで、大きいものは消す
from collections import deque
cand=(~reach)&(dist<th)
seen=np.zeros_like(cand); H2,W2=cand.shape
ys,xs=np.nonzero(cand)
for y0,x0 in zip(ys,xs):
  if seen[y0,x0]: continue
  q=deque([(y0,x0)]); seen[y0,x0]=True; comp=[]
  while q:
    y,x=q.popleft(); comp.append((y,x))
    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
      ny,nx=y+dy,x+dx
      if 0<=ny<H2 and 0<=nx<W2 and cand[ny,nx] and not seen[ny,nx]: seen[ny,nx]=True; q.append((ny,nx))
  if len(comp)>W*H*0.002:
    cy,cx=zip(*comp); reach[np.array(cy),np.array(cx)]=True
# 縁はやわらかく: 背景に近い色ほど薄くする（にじみや光のぼかしを、紙の灰色ごと残さないため）
# ただし内側（縁から 8px より内）は不透明のまま（明るい部分が透けないように）
soft=np.clip((dist-6)/22,0,1)
hard=Image.fromarray(np.where(reach,0,255).astype('uint8'))
inner=np.asarray(hard.filter(ImageFilter.MinFilter(17)))>0
alpha=np.where(reach,0,np.where(inner,255,soft*255))
al=Image.fromarray(alpha.astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
o=src.copy(); o.putalpha(al); o.save(out_path)
chk=Image.new('RGBA',src.size,(60,10,10,255)); chk.alpha_composite(o); chk.convert('RGB').resize((W//2,H//2)).save(out_path.replace('.png','-check.png'))
print('bg removed', reach.mean())
