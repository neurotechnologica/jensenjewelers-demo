// Build an AR-ready GLB from the EXISTING ring_webgi.glb (no new design): decode Draco, drop WEBGI-only extensions,
// real-world scale (ring outer diameter ~22 mm), stone-up/upright pose, plain PBR materials. Geometry is untouched.
const {NodeIO,Document}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {prune,dedup,draco}=require('@gltf-transform/functions');
const draco3d=require('draco3dgltf');
(async()=>{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
 const src=process.argv[2], out=process.argv[3]; const hex=(h)=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);const f=x=>x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);return c.map(f)}; const MH=process.argv[4]||'#d4af37', GH=process.argv[5]||'#f4fbff'; const pale=(()=>{const c=hex(MH);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]>0.62})();
 const doc=await io.read(src);
 const root=doc.getRoot();
 // strip unknown/unsupported material extensions (clearcoat/iridescence are zero-valued in source)
 for(const m of root.listMaterials()){
   for(const e of m.listExtensions()) m.setExtension(e.extensionName,null);
   m.setExtras({});
 }
 const metal=doc.createMaterial('RingMetal').setBaseColorFactor([...hex(MH),1]).setMetallicFactor(1).setRoughnessFactor(0.16);
 const accent=doc.createMaterial('RingAccent').setBaseColorFactor([...(pale?hex(MH):hex('#f3f1ec')),1]).setMetallicFactor(1).setRoughnessFactor(0.16);
 const gem=doc.createMaterial('RingGem').setBaseColorFactor([...hex(GH),1]).setMetallicFactor(0).setRoughnessFactor(0.03).setAlphaMode('BLEND');
 gem.setBaseColorFactor([...hex(GH),0.85]);
 for(const n of root.listNodes()){
   const mesh=n.getMesh(); if(!mesh) continue;
   const nm=n.getName().toLowerCase();
   const mat= nm.startsWith('diamond')?gem : nm.includes('gold')?metal : accent;
   mesh.listPrimitives().forEach(p=>p.setMaterial(mat));
 }
 for(const m of root.listMaterials()) if(!['RingMetal','RingAccent','RingGem'].includes(m.getName())) m.dispose();
 // Pose: source has band axis = Y, stones on +Z. Rotate -90deg about X so the band axis is Z and the stone points +Y (ring stands upright).
 // Scale: gold band outer diameter 2.47 source units * 1.0627 (Scene_1 scale) -> 22 mm.
 const scene=root.listScenes()[0];
 const s1=root.listNodes().find(n=>n.getName()==='Scene_1');
 s1.setRotation([0,0,0,1]); // source scene root carries a 51.6deg tilt about Z (WebGi camera framing); remove so the ring stands true
 const sc=s1.getScale()[0];           // 1.0627
 const k=0.022/(2.47*sc);
 const wrapper=doc.createNode('RingUpright');
 // move Scene_centered under wrapper
 const centered=root.listNodes().find(n=>n.getName()==='Scene-centered');
 scene.removeChild(centered); wrapper.addChild(centered); scene.addChild(wrapper);
 const c=Math.SQRT1_2; // quaternion for -90deg about X: (sin(-45), 0,0, cos(45))
 wrapper.setRotation([-c,0,0,c]);
 wrapper.setScale([k,k,k]);
 for(const e of root.listExtensionsUsed()) if(e.extensionName==='KHR_draco_mesh_compression') e.dispose();
 await doc.transform(prune(),dedup());
 await io.write(out,doc);
 if(process.argv[6]){ await doc.transform(draco({method:'edgebreaker',quantizePosition:16,quantizeNormal:10})); await io.write(process.argv[6],doc); console.log('draco',process.argv[6]); }
 console.log('wrote',out,'k=',k);
})();
