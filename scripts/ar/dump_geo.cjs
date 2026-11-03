// dump baked (world-space, metres) geometry of an AR glb as JSON for the USD writer
const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const fs=require('fs');
(async()=>{const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const d=await io.read(process.argv[2]);const out=[];
for(const n of d.getRoot().listNodes()){const m=n.getMesh();if(!m)continue;
 const W=n.getWorldMatrix();
 const p=m.listPrimitives()[0];const pos=p.getAttribute('POSITION').getArray(),nor=p.getAttribute('NORMAL').getArray(),idx=p.getIndices().getArray();
 const P=[],N=[];
 for(let i=0;i<pos.length;i+=3){const x=pos[i],y=pos[i+1],z=pos[i+2];P.push(W[0]*x+W[4]*y+W[8]*z+W[12],W[1]*x+W[5]*y+W[9]*z+W[13],W[2]*x+W[6]*y+W[10]*z+W[14]);
  const a=nor[i],b=nor[i+1],c=nor[i+2];let nx=W[0]*a+W[4]*b+W[8]*c,ny=W[1]*a+W[5]*b+W[9]*c,nz=W[2]*a+W[6]*b+W[10]*c;const l=Math.hypot(nx,ny,nz)||1;N.push(nx/l,ny/l,nz/l)}
 const mat=p.getMaterial();out.push({name:n.getName(),mat:mat.getName(),pos:P,nor:N,idx:Array.from(idx)});}
fs.writeFileSync(process.argv[3],JSON.stringify(out));console.log('dumped',out.length);})();
