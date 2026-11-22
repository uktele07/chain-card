# 戦闘背景の画像を、ゲームの背景と同じ考え方で加工する: 16:9 に合わせ、弱くぼかし、彩度と明るさを落とし、敵の周りだけ明るく、縁を暗く
import sys
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
im=Image.open(sys.argv[1]).convert('RGB'); out=sys.argv[2]
W0,H0=im.size; th=int(W0*9/16)
if th<=H0: im=im.crop((0,(H0-th)//2,W0,(H0-th)//2+th))
else: tw=int(H0*16/9); im=im.crop(((W0-tw)//2,0,(W0-tw)//2+tw,H0))
im=im.resize((1920,1080),Image.LANCZOS)
p=im.filter(ImageFilter.GaussianBlur(float(sys.argv[3]) if len(sys.argv)>3 else 3))
p=ImageEnhance.Color(p).enhance(0.8); p=ImageEnhance.Brightness(p).enhance(0.55)
a=np.asarray(p).astype(float); H,W=a.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
d=np.sqrt((xx-1600)**2+(yy-652)**2); light=np.clip(1-d/520,0,1)**1.5
a=a*(1+0.6*light[...,None])+np.array([255,150,70])*0.12*light[...,None]
v=np.sqrt(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2); a*=np.clip(1.15-0.45*v,0.4,1)[...,None]
Image.fromarray(np.clip(a,0,255).astype('uint8')).save(out)
