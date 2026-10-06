// Logo del taller sin los bordes blancos (o transparentes) que suelen traer las imágenes.
// Devuelve {src (PNG en data URL), w, h, transp (tiene fondo transparente), oscuro (dibujo oscuro)} o null.
function recortarLogo(url,maxLado){return new Promise(function(res){if(!url){res(null);return}
  var listo=false;function fin(v){if(!listo){listo=true;res(v)}}
  var im=new Image();im.crossOrigin="anonymous";
  im.onload=function(){try{
   var k=Math.min(1,(maxLado||600)/Math.max(im.width,im.height)),W=Math.max(1,Math.round(im.width*k)),H=Math.max(1,Math.round(im.height*k));
   var c=document.createElement("canvas");c.width=W;c.height=H;var g=c.getContext("2d");g.drawImage(im,0,0,W,H);
   var d=g.getImageData(0,0,W,H).data,transp=false,suma=0,n=0;
   // un píxel es "borde" si es casi transparente o casi blanco
   function vacio(i){return d[i+3]<16||(d[i]>235&&d[i+1]>235&&d[i+2]>235)}
   var x0=W,y0=H,x1=-1,y1=-1;
   for(var y=0;y<H;y++)for(var x=0;x<W;x++){var i=(y*W+x)*4;if(d[i+3]<250)transp=true;
    if(!vacio(i)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;suma+=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000;n++}}
   if(x1<0){fin({src:c.toDataURL("image/png"),w:W,h:H,transp:transp,oscuro:false});return}
   var m=transp?Math.round(Math.max(x1-x0,y1-y0)*0.02):0;x0=Math.max(0,x0-m);y0=Math.max(0,y0-m);x1=Math.min(W-1,x1+m);y1=Math.min(H-1,y1+m);
   var w=x1-x0+1,h=y1-y0+1,c2=document.createElement("canvas");c2.width=w;c2.height=h;c2.getContext("2d").drawImage(c,x0,y0,w,h,0,0,w,h);
   fin({src:c2.toDataURL("image/png"),w:w,h:h,transp:transp,oscuro:n>0&&suma/n<90});
  }catch(e){fin(null)}};
  im.onerror=function(){fin(null)};im.src=url;setTimeout(function(){fin(null)},5000)})}
// "11 5555-1234 / 11 4444-0000" -> ["11 5555-1234","11 4444-0000"]
function telefonosDe(t){return String(t||"").split(/\s*[\/;,|]\s*|\s+y\s+/).map(function(x){return x.trim()}).filter(Boolean)}
function instagramDe(i){i=String(i||"").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i,"").replace(/[\/?].*$/,"").replace(/^@/,"");return i}
// Cambia cada <img data-recortar> por su versión sin bordes blancos (si se puede leer la imagen)
function recortarImagenes(raiz){(raiz||document).querySelectorAll("img[data-recortar]").forEach(function(im){
  recortarLogo(im.getAttribute("src"),600).then(function(r){if(!r)return;im.src=r.src;if(r.transp&&r.oscuro)im.classList.add("logo-claro")})})}
