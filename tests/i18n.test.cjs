const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),acorn=require('acorn');
const {catalog,languages,translate}=require('../src/ui/i18n.js');
const {Store}=require('../src/core/store.cjs');
test('six languages cover every static UI label and server message',()=>{
  assert.deepEqual(languages.map(x=>x[0]),['ru','en','ko','fr','ja','zh']);
  const keys=new Set();
  for(const file of ['src/ui/app.js','src/main.cjs','src/core/calendar.cjs','src/core/caldav.cjs','src/core/store.cjs']){
    const tree=acorn.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{ecmaVersion:'latest'});
    const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='Literal'&&typeof node.value==='string'&&/[А-Яа-яЁё]/.test(node.value))keys.add(node.value.trim());for(const v of Object.values(node)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};walk(tree);
  }
  for(const key of keys){assert.ok(catalog[key],`Missing ${key}`);for(const [lang]of languages.filter(x=>x[0]!=='ru')){assert.ok(catalog[key][lang],`${lang}: ${key}`);assert.equal(/[А-Яа-яЁё]/.test(catalog[key][lang]),false,`${lang}: ${key}`);}}
  assert.equal(translate('Каждые {n} мин.','en',{n:5}),'Every 5 min');
});
test('language setting defaults to Russian for existing profiles and survives restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-u-language-'));
  try{const store=new Store(dir);assert.equal(store.data.settings.language,'ru');store.data.settings.language='ja';store.save();assert.equal(new Store(dir).data.settings.language,'ja');delete store.data.settings.language;store.save();assert.equal(new Store(dir).data.settings.language,'ru');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
