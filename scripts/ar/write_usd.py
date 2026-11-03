"""Write an ARKit-compliant USDZ (UsdPreviewSurface, Y-up, metres, triangle meshes, per-vertex normals)
from baked geometry dumped from the AR glb. usage: write_usd.py geo.json out.usdz metal_hex gem_hex"""
import sys, json, os, tempfile, shutil
from pxr import Usd, UsdGeom, UsdShade, Sdf, Gf, Vt, UsdUtils
geo=json.load(open(sys.argv[1])); dst=sys.argv[2]; metal=sys.argv[3]; gem=sys.argv[4]
def rgb(h):
    h=h.lstrip('#'); return Gf.Vec3f(*[int(h[i:i+2],16)/255 for i in (0,2,4)])  # sRGB values (UsdPreviewSurface diffuseColor is sRGB-ish in Quick Look)
tmp=tempfile.mkdtemp(); usdc=os.path.join(tmp,'ring.usdc')
st=Usd.Stage.CreateNew(usdc)
UsdGeom.SetStageUpAxis(st,UsdGeom.Tokens.y); UsdGeom.SetStageMetersPerUnit(st,1.0)
root=UsdGeom.Xform.Define(st,'/Ring'); st.SetDefaultPrim(root.GetPrim())
Usd.ModelAPI(root.GetPrim()).SetKind('component')
mr=metal; lum=lambda c:0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
mc=rgb(metal)
lin=lambda c:[(x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4) for x in c]
pale=lum(lin(mc))>0.62
mats={}
def mk(name,col,metallic,rough,opacity=1.0,ior=1.5):
    m=UsdShade.Material.Define(st,f'/Ring/Materials/{name}')
    s=UsdShade.Shader.Define(st,f'/Ring/Materials/{name}/PBR'); s.CreateIdAttr('UsdPreviewSurface')
    s.CreateInput('diffuseColor',Sdf.ValueTypeNames.Color3f).Set(col)
    s.CreateInput('metallic',Sdf.ValueTypeNames.Float).Set(metallic)
    s.CreateInput('roughness',Sdf.ValueTypeNames.Float).Set(rough)
    s.CreateInput('opacity',Sdf.ValueTypeNames.Float).Set(opacity)
    s.CreateInput('ior',Sdf.ValueTypeNames.Float).Set(ior)
    s.CreateInput('clearcoat',Sdf.ValueTypeNames.Float).Set(1.0 if name=='Gem' else 0.0)
    s.CreateInput('clearcoatRoughness',Sdf.ValueTypeNames.Float).Set(0.03)
    s.CreateInput('useSpecularWorkflow',Sdf.ValueTypeNames.Int).Set(0)
    m.CreateSurfaceOutput().ConnectToSource(s.ConnectableAPI(),'surface'); return m
mats['Metal']=mk('Metal',mc,1.0,0.16)
mats['Accent']=mk('Accent',mc if pale else Gf.Vec3f(0.953,0.945,0.925),1.0,0.16)
mats['Gem']=mk('Gem',rgb(gem),0.0,0.03,0.88,2.4)
for g in geo:
    n=g['name'].lower(); key='Gem' if n.startswith('diamond') else 'Metal' if 'gold' in n else 'Accent'
    mesh=UsdGeom.Mesh.Define(st,f"/Ring/{g['name'].replace('-','_')}")
    pts=[Gf.Vec3f(*g['pos'][i:i+3]) for i in range(0,len(g['pos']),3)]
    nor=[Gf.Vec3f(*g['nor'][i:i+3]) for i in range(0,len(g['nor']),3)]
    mesh.CreatePointsAttr(Vt.Vec3fArray(pts)); mesh.CreateNormalsAttr(Vt.Vec3fArray(nor)); mesh.SetNormalsInterpolation('vertex')
    mesh.CreateFaceVertexIndicesAttr(Vt.IntArray(g['idx'])); mesh.CreateFaceVertexCountsAttr(Vt.IntArray([3]*(len(g['idx'])//3)))
    mesh.CreateSubdivisionSchemeAttr('none'); mesh.CreateDoubleSidedAttr(False)
    mesh.CreateExtentAttr(UsdGeom.Mesh.ComputeExtent(Vt.Vec3fArray(pts)))
    UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(mats[key])
st.GetRootLayer().Save()
if os.path.exists(dst): os.remove(dst)
ok=UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usdc),dst)
print('usdz',dst,ok,os.path.getsize(dst)); shutil.rmtree(tmp)
