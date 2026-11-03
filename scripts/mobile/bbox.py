# usage: bbox.py image.png  -> fraction of width/height covered by non-background pixels (background = median colour of the corners)
import sys, json
from PIL import Image
import numpy as np
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
M = int(sys.argv[2]) if len(sys.argv) > 2 else 0
if M: im = im[M:-M, M:-M]
h, w, _ = im.shape
corners = np.concatenate([im[:6, :6].reshape(-1, 3), im[:6, -6:].reshape(-1, 3), im[-6:, :6].reshape(-1, 3), im[-6:, -6:].reshape(-1, 3)])
bg = np.median(corners, axis=0)
T = int(sys.argv[3]) if len(sys.argv) > 3 else 40
mask = (np.abs(im - bg).sum(axis=2) > T)
ys, xs = np.where(mask)
if len(xs) == 0: print(json.dumps({'ring': None})); sys.exit()
print(json.dumps({'img': [w, h], 'ring_bbox_px': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], 'width_frac': round((xs.max() - xs.min()) / w, 3), 'height_frac': round((ys.max() - ys.min()) / h, 3), 'area_frac': round(mask.mean(), 3)}))
