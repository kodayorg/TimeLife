const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../src/core/store.cjs');
test('existing profiles default to no blur and blur switch survives restart and migrates old slider values',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timelife-blur-'));
 try{const store=new Store(dir);assert.equal(store.data.settings.blur,false);store.data.settings.blur=70;store.save();assert.equal(new Store(dir).data.settings.blur,true);delete store.data.settings.blur;store.save();assert.equal(new Store(dir).data.settings.blur,false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
