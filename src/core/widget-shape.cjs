// Electron's native window region clips the system-drawn Acrylic background too.
function roundedWidgetRegion(width,height,radius=20) {
 const r=Math.min(radius,Math.floor(width/2),Math.floor(height/2));
 const rects=[{x:0,y:r,width,height:height-2*r}];
 for(let y=0;y<r;y++) {
  const inset=Math.ceil(r-Math.sqrt(r*r-(r-y-.5)**2));
  rects.push({x:inset,y,width:width-2*inset,height:1},{x:inset,y:height-1-y,width:width-2*inset,height:1});
 }
 return rects;
}
module.exports={roundedWidgetRegion};
