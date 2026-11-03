import {describe,it,expect,beforeAll} from 'vitest';
import {computeRingPose,smoothPose,landmarkToPx,norm,type Landmark} from '../lib/hand-pose';
import {pickArMetal,readRingDeepLink,buildRingShareUrl,hexToLinearRgba,arGlbUrl,arUsdzUrl,supportsQuickLook} from '../lib/ar-assets';
const W=1000,H=1000;
// synthetic hand, 5 px per real mm, y-down image coords in px -> normalized
function hand():Landmark[]{
  const px:[number,number][]=Array(21).fill([500,500]);
  px[0]=[500,900];px[5]=[680,600];px[17]=[320,600];px[9]=[500,410];px[13]=[430,420];px[14]=[430,205];
  return px.map(([x,y])=>({x:x/W,y:y/H,z:0}));
}
describe('hand-pose',()=>{
  it('null when <21 landmarks',()=>{expect(computeRingPose(hand().slice(0,20),W,H,'Left')).toBeNull();expect(computeRingPose([] as any,W,H,'Left')).toBeNull()});
  it('null when ring proximal segment degenerate',()=>{const l=hand();l[14]={...l[13]};expect(computeRingPose(l,W,H,'Left')).toBeNull()});
  it('landmarkToPx maps centre to origin, y up',()=>{expect(landmarkToPx({x:.5,y:.5,z:0},W,H)).toEqual([0,-0,-0]);expect(landmarkToPx({x:1,y:0,z:0.1},W,H)[0]).toBe(500);expect(landmarkToPx({x:0,y:0,z:0},W,H)[1]).toBe(500)});
  it('position is 42% from MCP towards PIP',()=>{const p=computeRingPose(hand(),W,H,'Right')!;const m=landmarkToPx(hand()[13],W,H),q=landmarkToPx(hand()[14],W,H);for(let i=0;i<3;i++)expect(p.position[i]).toBeCloseTo(m[i]+(q[i]-m[i])*0.42,6)});
  it('axis is unit and points MCP->PIP (up in image => +y)',()=>{const p=computeRingPose(hand(),W,H,'Right')!;expect(Math.hypot(...p.axis)).toBeCloseTo(1,9);expect(p.axis[1]).toBeGreaterThan(0.99);expect(p.fingerAngleDeg).toBeCloseTo(90,5)});
  it('pxPerMm == 5 for 5px/mm hand',()=>{expect(computeRingPose(hand(),W,H,'Right')!.pxPerMm).toBeCloseTo(5,6)});
  it('pxPerMm scales with hand size',()=>{const l=hand().map(p=>({...p,x:.5+(p.x-.5)*2,y:.5+(p.y-.5)*0.5+0}));const a=computeRingPose(hand(),W,H,'Right')!.pxPerMm;const big=hand().map(p=>({x:.5+(p.x-.5)*.5,y:.5+(p.y-.5)*.5,z:0}));expect(computeRingPose(big,W,H,'Right')!.pxPerMm).toBeCloseTo(a/2,6)});
  it('dorsal is unit and perpendicular to axis',()=>{for(const h of ['Left','Right',undefined]){const p=computeRingPose(hand(),W,H,h)!;expect(Math.hypot(...p.dorsal)).toBeCloseTo(1,9);expect(p.axis[0]*p.dorsal[0]+p.axis[1]*p.dorsal[1]+p.axis[2]*p.dorsal[2]).toBeCloseTo(0,9)}});
  // tasks-vision >= 0.10.5 labels the hand as it LOOKS in the (unmirrored) frame: 'Right' == real right hand (measured on victory.jpg).
  // This layout (index image-right, pinky image-left, fingers up) is a right hand seen palm-first, or a left hand seen back-first.
  it("label 'Left' (real LEFT hand, back to camera in this layout) => dorsal faces camera (+z)",()=>{expect(computeRingPose(hand(),W,H,'Left')!.dorsal[2]).toBeGreaterThan(0.99)});
  it("label 'Right' (real RIGHT hand, palm to camera) => dorsal faces away (-z)",()=>{expect(computeRingPose(hand(),W,H,'Right')!.dorsal[2]).toBeLessThan(-0.99)});
  it("mirrored layout (index image-left) with label 'Right' = real right hand BACK to camera => dorsal +z",()=>{const l=hand().map(p=>({...p,x:1-p.x}));expect(computeRingPose(l,W,H,'Right')!.dorsal[2]).toBeGreaterThan(0.99);expect(computeRingPose(l,W,H,'Left')!.dorsal[2]).toBeLessThan(-0.99)});
  it('flat degenerate palm falls back to +z dorsal',()=>{const l=hand();l[5]={...l[0]};const p=computeRingPose(l,W,H,'Right')!;expect(Math.hypot(...p.dorsal)).toBeCloseTo(1,9)});
  it('z depth uses -z*width',()=>{expect(landmarkToPx({x:.5,y:.5,z:0.2},W,H)[2]).toBeCloseTo(-200,9)});
  it('smoothPose: null prev returns next; alpha 0 frozen; alpha 1 raw; midpoint',()=>{const a=computeRingPose(hand(),W,H,'Right')!;const l2=hand().map(p=>({...p,x:p.x+0.1}));const b=computeRingPose(l2,W,H,'Right')!;expect(smoothPose(null,b)).toBe(b);expect(smoothPose(a,b,0).position).toEqual(a.position);expect(smoothPose(a,b,1).position[0]).toBeCloseTo(b.position[0],9);expect(smoothPose(a,b,0.5).position[0]).toBeCloseTo((a.position[0]+b.position[0])/2,9);expect(smoothPose(a,b,0.45).pxPerMm).toBeCloseTo(a.pxPerMm+(b.pxPerMm-a.pxPerMm)*.45,9)});
  it('smoothPose keeps axis/dorsal unit',()=>{const a=computeRingPose(hand(),W,H,'Right')!;const l2=hand();l2[14]={...l2[14],x:.55};const b=computeRingPose(l2,W,H,'Right')!;const s=smoothPose(a,b,0.45);expect(Math.hypot(...s.axis)).toBeCloseTo(1,9);expect(Math.hypot(...s.dorsal)).toBeCloseTo(1,9)});
  it('norm of zero vec does not NaN',()=>{expect(norm([0,0,0]).every(Number.isFinite)).toBe(true)});
});
describe('ar-assets',()=>{
  it('exact ids pass through',()=>{for(const id of ['yellow-gold','white-gold','rose-gold','platinum'])expect(pickArMetal({id,color:'#000000'})).toBe(id)});
  it('nearest colour for unknown id',()=>{expect(pickArMetal({id:'x',color:'#d5b038'})).toBe('yellow-gold');expect(pickArMetal({id:'x',color:'#c8a08b'})).toBe('rose-gold');expect(pickArMetal({id:'x',color:'#ffffff'})).toBe('white-gold');expect(pickArMetal({id:'x',color:'#c0cad4'})).toBe('platinum')});
  it('3-digit hex and no-hash',()=>{expect(pickArMetal({id:'x',color:'#fff'})).toBe('white-gold');expect(pickArMetal({id:'x',color:'d4af37'})).toBe('yellow-gold')});
  it('empty colour defaults to yellow-gold',()=>{expect(pickArMetal({id:'x',color:''})).toBe('yellow-gold')});
  it('urls',()=>{expect(arGlbUrl('platinum')).toBe('/assets/ar/ring-platinum.glb');expect(arUsdzUrl('rose-gold')).toBe('/assets/ar/ring-rose-gold.usdz')});
  it('deep link parse',()=>{expect(readRingDeepLink('?ring=white-gold,ruby&ar=1')).toEqual({metalId:'white-gold',gemId:'ruby',openAr:true,openTryOn:false});expect(readRingDeepLink('?ring=a,b&tryon=1')).toMatchObject({openTryOn:true,openAr:false});expect(readRingDeepLink('')).toEqual({metalId:null,gemId:null,openAr:false,openTryOn:false});expect(readRingDeepLink('?ring=%20a%20,%20b%20').metalId).toBe('a');expect(readRingDeepLink('?ar=2').openAr).toBe(false)});
  it('deep link with only metal',()=>{expect(readRingDeepLink('?ring=platinum')).toMatchObject({metalId:'platinum',gemId:null})});
  it('share url builds & strips existing query/hash',()=>{(globalThis as any).window={location:{href:'https://x.test/p?utm=1&ring=old#h'}};expect(buildRingShareUrl('rose-gold','ruby','ar')).toBe('https://x.test/p?ring=rose-gold%2Cruby&ar=1');expect(buildRingShareUrl('a','b','tryon')).toBe('https://x.test/p?ring=a%2Cb&tryon=1');expect(buildRingShareUrl('a','b')).toBe('https://x.test/p?ring=a%2Cb')});
  it('hexToLinearRgba',()=>{expect(hexToLinearRgba('#ffffff')).toEqual([1,1,1,1]);expect(hexToLinearRgba('#000',0.5)).toEqual([0,0,0,0.5]);expect(hexToLinearRgba('#808080')[0]).toBeCloseTo(0.2158,3)});
  it('supportsQuickLook false without document',()=>{expect(supportsQuickLook()).toBe(false)});
});
