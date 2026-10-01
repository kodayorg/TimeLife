const assert=require('node:assert/strict');
async function run({app,store,createWidget,getWidget}) {
 let count=0;
 let stage;
 if(process.argv.includes('--qa-visual-corners')){
   const {BrowserWindow}=require('electron');stage=new BrowserWindow({x:10,y:10,width:900,height:950,frame:false,alwaysOnTop:true,backgroundColor:'#ff00ff',show:true});
   await stage.loadURL('data:text/html,'+encodeURIComponent('<body style="margin:0;background:magenta"></body>'));
   store.data.settings.widgetPosition={x:50,y:50};store.data.settings.widgetTop=true;store.data.settings.theme='dark';store.data.settings.darkOpacity=45;require('electron').nativeTheme.themeSource='dark';
 }

 for(const blur of [false,true]) for(const [kind,width,height] of [['month',350,412],['horizontal',700,412],['vertical',350,840]]) {
  store.data.settings.widget=kind;store.data.settings.blur=blur;createWidget();const w=getWidget();
  if(w.webContents.isLoading())await new Promise(r=>w.webContents.once('did-finish-load',r));
  await w.widgetReady;
  const actual=await w.webContents.executeJavaScript("(async()=>{await refresh();return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,widgetWidth:document.querySelector('.widget').offsetWidth,widgetHeight:document.querySelector('.widget').offsetHeight,lastDayRight:document.querySelector('.widget-weekdays').lastElementChild.getBoundingClientRect().right,controlsRight:document.querySelector('.widget-controls').getBoundingClientRect().right}})()");
  assert.ok(actual.width>=width && actual.width<=width+2);assert.ok(actual.height>=height && actual.height<=height+2);assert.equal(actual.widgetWidth,blur?actual.width:width);assert.equal(actual.widgetHeight,blur?actual.height:height);assert.ok(actual.lastDayRight<=actual.width);assert.ok(actual.controlsRight<=actual.width);
  const handle=w.getNativeWindowHandle();const hwnd=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
  const checkRegion=()=>require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& { '+require('node:fs').readFileSync(require('node:path').join(__dirname,'check-window-region.ps1'),'utf8')+' } -Handle '+hwnd+(blur?' -NativeCorners':'')],{windowsHide:true}).toString();
  const initialRegion=checkRegion();
  for(const [x,y] of [[90,60],[150,90],[70,50]]){
    w.setPosition(x,y);await new Promise(r=>setTimeout(r,120));
    const moved=await w.webContents.executeJavaScript('({width:innerWidth,height:innerHeight,widgetWidth:document.querySelector(".widget").offsetWidth,widgetHeight:document.querySelector(".widget").offsetHeight})');
    console.log('Moved',kind,blur,moved);
    assert.ok(moved.width>=width);assert.ok(moved.height>=height);if(blur){assert.ok(moved.width<=width+2);assert.ok(moved.height<=height+2);assert.equal(moved.widgetWidth,moved.width);assert.equal(moved.widgetHeight,moved.height);}
  }
  assert.equal(checkRegion(),initialRegion,'native clipping region must stay unchanged after moving');
  if(stage && blur){
    w.show();await new Promise(r=>setTimeout(r,400));
    const fs=require('node:fs'),path=require('node:path');const script=fs.readFileSync(path.join(__dirname,'capture-widget.ps1'),'utf8');
    require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& { '+script+' } -Handle '+hwnd+' -OutputPath "'+path.join(__dirname,'../qa/production-corners-'+kind+'.png')+'"'],{windowsHide:true});
  }
  console.log(JSON.stringify({kind,blur,...actual}));count++;
 }
 if(stage)stage.destroy();
 console.log(`Native widget sizing passed: ${count} configurations`);app.exit(0);
}
module.exports={run};


