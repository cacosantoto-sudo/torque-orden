// Verificación pre compra (solo talleres de autos): datos fijos, cálculos,
// esquema de la carrocería y los PDF del informe y del contrato.
// Lo usan la app (js/precompra.js) y la página pública del QR (precompra.html),
// así que no depende de nada de index.html (solo de recortarLogo de js/logo.js).

/* ---------- datos fijos ---------- */
var PC_CATS=[
 {k:"motor",n:"Motor y mecánica",max:25},
 {k:"trans",n:"Transmisión",max:15},
 {k:"tren",n:"Tren delantero y suspensión",max:15},
 {k:"elec",n:"Electrónica y escaneo",max:15},
 {k:"carro",n:"Carrocería y pintura",max:15},
 {k:"inter",n:"Interior y desgaste",max:5},
 {k:"neufre",n:"Neumáticos y frenos",max:10}];
var PC_SECTORES=[["capot","Capot"],["gdi","Guardabarro Del. Izq."],["gdd","Guardabarro Del. Der."],["pdi","Puerta Del. Izq."],["pdd","Puerta Del. Der."],
 ["pti","Puerta Tras. Izq."],["ptd","Puerta Tras. Der."],["techo","Techo"],["baul","Baúl"],["pgd","Paragolpes Del."],["pgt","Paragolpes Tras."]];
var PC_ESTADOS=[["original","Original",[46,160,67],"#2ea043"],["repintado","Repintado",[242,169,0],"#f2a900"],["masilla","Reparado / Masilla",[215,25,32],"#d71920"]];
var PC_NEU=[["di","Delantero Izquierdo"],["dd","Delantero Derecho"],["ti","Trasero Izquierdo"],["td","Trasero Derecho"]];
var PC_RANGOS=[{min:90,txt:"Excelente"},{min:80,txt:"Muy recomendable"},{min:70,txt:"Recomendable"},{min:60,txt:"Requiere atención"},{min:0,txt:"No recomendable"}];
var PC_RANGO_COL=[[46,160,67],[46,160,67],[242,169,0],[245,124,0],[215,25,32]];
var PC_RECOM=[["recomendable","COMPRAR RECOMENDABLE"],["negociando","COMPRAR NEGOCIANDO PRECIO"],["no","NO RECOMENDABLE"]];
var PC_RIESGO=[["bajo","Riesgo bajo"],["moderado","Riesgo moderado"],["alto","Riesgo alto"]];
var PC_ESCANEO=[["motor","Motor"],["abs","ABS"],["airbag","Airbag"],["trans","Transmisión"],["confort","Confort"]];
var PC_MANEJO=[["arranque","Arranque en frío","OK"],["acel","Aceleración","Normal"],["cambios","Cambios de marcha","OK"],["ruidos","Ruidos / Vibraciones","No"],["frenado","Frenado","Correcto"],["direccion","Dirección","Precisa"]];
var PC_INTERIOR=[["tapizados","Tapizados","Buen estado"],["volante","Volante","Desgaste leve"],["pedales","Pedales","Acorde al km"],["comandos","Comandos","OK"],["aire","Aire acondicionado","OK"]];
// Campos propios de cada categoría (además del comentario)
var PC_CAT_CAMPOS={
 motor:[["estado","Estado general","Buen estado general"],["ruidos","Ruidos","Sin ruidos anormales"],["perdidas","Pérdidas","Sin pérdidas"],["fluidos","Fluidos","Fluidos en nivel y color correctos"]],
 trans:[["suavidad","Suavidad de cambios","Cambios suaves y precisos"],["patina","Patinamiento","Sin patinamiento"],["vibra","Vibraciones","Sin vibraciones"]],
 tren:[["bujes","Desgaste de bujes y rótulas","Bujes y rótulas con desgaste leve"],["amort","Vida útil de amortiguadores (%)","70","%"]]};

/* ---------- cálculos ---------- */
function pcNum(v){var n=Number(String(v==null?"":v).replace(",","."));return isFinite(n)?n:0}
function pcTxt(v){return String(v==null?"":v).trim()}
function pcPuntos(D,k){var c=PC_CATS.filter(function(x){return x.k===k})[0],v=pcNum(D&&D.cats&&D.cats[k]&&D.cats[k].pts);return Math.max(0,Math.min(c.max,Math.round(v)))}
function pcTotal(D){return PC_CATS.reduce(function(s,c){return s+pcPuntos(D,c.k)},0)}
function pcRangos(cfg){var r=cfg&&cfg.rangos;return Array.isArray(r)&&r.length===5?r:PC_RANGOS}
function pcRangoIdx(total,cfg){var r=pcRangos(cfg);for(var i=0;i<r.length;i++){if(total>=pcNum(r[i].min))return i}return r.length-1}
function pcCalif(total,cfg){var i=pcRangoIdx(total,cfg);return {txt:pcRangos(cfg)[i].txt,col:PC_RANGO_COL[i],idx:i}}
function pcRgb(c){return "rgb("+c.join(",")+")"}
// Color de una barra según el porcentaje logrado
function pcColPct(p){return p>=.8?[46,160,67]:p>=.6?[242,169,0]:[215,25,32]}
function pcRiesgo(D,total){var r=D&&D.riesgo;if(r&&r!=="auto")return r;return total>=80?"bajo":total>=60?"moderado":"alto"}
function pcRecom(D,total){var r=D&&D.recom;if(r&&r!=="auto")return r;return total>=80?"recomendable":total>=60?"negociando":"no"}
function pcRecomTxt(v){return (PC_RECOM.filter(function(x){return x[0]===v})[0]||PC_RECOM[1])[1]}
function pcRecomCol(v){return v==="recomendable"?[46,160,67]:v==="no"?[215,25,32]:[46,160,67]}
function pcGastosTotal(D){return ((D&&D.gastos)||[]).reduce(function(s,g){return s+pcNum(g.costo)},0)}
function pcPlata(n){n=Math.round(Number(n)||0);return "$ "+n.toLocaleString("es-AR")}
function pcFecha(f){var m=String(f||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+" / "+m[2]+" / "+m[1]:""}
// ¿El texto cargado indica que está bien? (para la tilde verde o la cruz roja)
function pcOk(v,clave){v=pcTxt(v);if(!v)return true;
  if(clave==="ruidos")return /^(no|sin|ninguno|ok)\b/i.test(v);
  return !/\b(mal|malo|mala|falla|fallas|roto|rota|revisar|irregular|deficiente|no funciona|no ok|ruidos?|vibra\w*|alto|fuerte)\b/i.test(v)}
function pcSector(k){return (PC_SECTORES.filter(function(s){return s[0]===k})[0]||[k,k])[1]}
function pcEstado(v){return PC_ESTADOS.filter(function(e){return e[0]===v})[0]||PC_ESTADOS[0]}
function pcSecDe(D,k){return (D&&D.carroceria&&D.carroceria[k])||{}}
function pcNeuDe(D,k){return (D&&D.neumaticos&&D.neumaticos[k])||{}}
// Promedio de vida útil de un eje ("d" delantero, "t" trasero)
function pcVidaEje(D,eje){var v=[eje+"i",eje+"d"].map(function(k){return pcTxt(pcNeuDe(D,k).vida)}).filter(Boolean).map(pcNum);return v.length?Math.round(v.reduce(function(a,b){return a+b},0)/v.length):null}

// Comentario breve de cada categoría: el escrito, o uno armado con los datos cargados
function pcComentario(D,k){
  var c=(D&&D.cats&&D.cats[k])||{};if(pcTxt(c.obs))return pcTxt(c.obs);
  return pcComentarioAuto(D,k);
}
function pcFrase(t){t=pcTxt(t);return t?t.charAt(0).toUpperCase()+t.slice(1)+(/[.!?]$/.test(t)?"":"."):""}
function pcComentarioAuto(D,k){
  D=D||{};var c=(D.cats&&D.cats[k])||{},out=[];
  if(k==="motor"||k==="trans")(PC_CAT_CAMPOS[k]).forEach(function(f){if(pcTxt(c[f[0]]))out.push(pcFrase(c[f[0]]))});
  if(k==="tren"){if(pcTxt(c.bujes))out.push(pcFrase(c.bujes));if(pcTxt(c.amort))out.push("Amortiguadores con "+pcNum(c.amort)+"% de vida útil.")}
  if(k==="elec"){var e=D.escaneo||{},mal=PC_ESCANEO.filter(function(x){return e[x[0]]===false});
   if(pcTxt(e.fallas))out.push(pcFrase(e.fallas));
   if(mal.length)out.push("Revisar módulo"+(mal.length>1?"s":"")+": "+mal.map(function(x){return x[1]}).join(", ")+".");
   else if(PC_ESCANEO.some(function(x){return e[x[0]]===true})&&!/m[oó]dulos/i.test(pcTxt(e.fallas)))out.push("Todos los módulos responden correctamente.")}
  if(k==="carro"){var rep=[],mas=[];PC_SECTORES.forEach(function(s){var e=pcSecDe(D,s[0]).estado;if(e==="repintado")rep.push(s[1]);if(e==="masilla")mas.push(s[1])});
   if(rep.length)out.push("Repintado: "+rep.join(", ")+".");if(mas.length)out.push("Con masilla: "+mas.join(", ")+".");
   if(!rep.length&&!mas.length&&PC_SECTORES.some(function(s){return pcSecDe(D,s[0]).estado}))out.push("Sin piezas repintadas ni con masilla.")}
  if(k==="inter"){if(pcTxt(c.acorde))out.push(pcFrase(c.acorde));
   var it=D.interior||{},obs=PC_INTERIOR.filter(function(x){return pcTxt(it[x[0]])}).map(function(x){return x[1]+": "+pcTxt(it[x[0]])});
   if(!out.length&&obs.length)out.push(obs.slice(0,2).join(". ")+".")}
  if(k==="neufre"){var vd=pcVidaEje(D,"d"),vt=pcVidaEje(D,"t"),f=D.frenos||{};
   if(vd!=null)out.push("Neumáticos delanteros "+vd+"% de vida útil.");else if(vt!=null)out.push("Neumáticos traseros "+vt+"% de vida útil.");
   if(pcTxt(f.pd))out.push("Pastillas delanteras "+pcNum(f.pd)+"%.")}
  return out.join(" ").replace(/\.\./g,".");
}
// Alertas que surgen de lo cargado (para sugerir; el mecánico decide cuáles quedan)
function pcAlertasSugeridas(D){
  D=D||{};var out=[];
  PC_SECTORES.forEach(function(s){var e=pcSecDe(D,s[0]).estado;if(e==="repintado")out.push(s[1]+" repintado.");if(e==="masilla")out.push(s[1]+" con masilla detectada.")});
  var vd=pcVidaEje(D,"d"),vt=pcVidaEje(D,"t");
  if(vd!=null&&vd<=50)out.push("Neumáticos delanteros próximos al reemplazo.");
  if(vt!=null&&vt<=50)out.push("Neumáticos traseros próximos al reemplazo.");
  var f=D.frenos||{};
  if(pcTxt(f.pd)&&pcNum(f.pd)<=40)out.push("Pastillas de freno delanteras al "+pcNum(f.pd)+"%.");
  if(pcTxt(f.pt)&&pcNum(f.pt)<=40)out.push("Pastillas de freno traseras al "+pcNum(f.pt)+"%.");
  var am=D.cats&&D.cats.tren&&D.cats.tren.amort;if(pcTxt(am)&&pcNum(am)<=50)out.push("Amortiguadores con "+pcNum(am)+"% de vida útil.");
  var e=D.escaneo||{};PC_ESCANEO.forEach(function(x){if(e[x[0]]===false)out.push("Falla en el módulo "+x[1]+".")});
  if(pcTxt(e.fallas)&&!/^sin fallas/i.test(pcTxt(e.fallas)))out.push("Fallas activas: "+pcTxt(e.fallas).replace(/\.$/,"")+".");
  return out;
}

/* ---------- esquema de la carrocería (vista de arriba, el frente arriba) ---------- */
// [sector, x, y, ancho, alto] en una caja de 36 x 76
var PC_ESQUEMA=[["pgd",4,0,28,5],["capot",6,6,24,16],["gdi",0,6,5,16],["gdd",31,6,5,16],["pdi",0,24,5,14],["pdd",31,24,5,14],
 ["techo",7,30,22,20],["pti",0,39,5,14],["ptd",31,39,5,14],["baul",6,57,24,13],["pgt",4,71,28,5]];
function pcColorSector(D,k){var e=pcSecDe(D,k).estado;return e?pcEstado(e)[3]:"#c9ccd1"}
function pcCarroSvg(D,ancho){
  var s="<svg viewBox='-3 -2 42 80' width='"+(ancho||120)+"' role='img' aria-label='Esquema de la carrocería' style='display:block'>";
  s+="<rect x='-1.5' y='8' width='3' height='10' rx='1' fill='#333'/><rect x='34.5' y='8' width='3' height='10' rx='1' fill='#333'/><rect x='-1.5' y='56' width='3' height='10' rx='1' fill='#333'/><rect x='34.5' y='56' width='3' height='10' rx='1' fill='#333'/>";
  s+="<rect x='7' y='23' width='22' height='6' rx='1.5' fill='#5b6670'/><rect x='7' y='51' width='22' height='5' rx='1.5' fill='#5b6670'/>";
  PC_ESQUEMA.forEach(function(p){s+="<rect x='"+p[1]+"' y='"+p[2]+"' width='"+p[3]+"' height='"+p[4]+"' rx='1.6' fill='"+pcColorSector(D,p[0])+"' stroke='#fff' stroke-width='.5'><title>"+pcSector(p[0])+": "+pcEstado(pcSecDe(D,p[0]).estado)[1]+"</title></rect>"});
  return s+"</svg>";
}
function pcUrlFoto(ruta){if(!ruta)return "";var C=window.SCOTTO_CONFIG||{};return C.SUPABASE_URL+"/storage/v1/object/public/precompra/"+String(ruta).split("/").map(encodeURIComponent).join("/")}
function pcUrlInforme(token){return location.origin+location.pathname.replace(/[^/]*$/,"")+"precompra.html?t="+token}

/* ---------- imágenes para el PDF ---------- */
// Foto recortada para llenar un recuadro de proporción "asp" (ancho/alto), en JPEG
function pcImg(url,asp,maxLado){return new Promise(function(res){if(!url){res(null);return}
  var listo=false;function fin(v){if(!listo){listo=true;res(v)}}
  var im=new Image();im.crossOrigin="anonymous";
  im.onload=function(){try{
   var w=im.width,h=im.height,sx=0,sy=0,sw=w,sh=h;
   if(asp){if(w/h>asp){sw=h*asp;sx=(w-sw)/2}else{sh=w/asp;sy=(h-sh)/2}}
   var k=Math.min(1,(maxLado||900)/Math.max(sw,sh)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(sw*k));c.height=Math.max(1,Math.round(sh*k));
   var g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(im,sx,sy,sw,sh,0,0,c.width,c.height);
   fin({src:c.toDataURL("image/jpeg",.82),w:c.width,h:c.height});
  }catch(e){fin(null)}};
  im.onerror=function(){fin(null)};im.src=url;setTimeout(function(){fin(null)},12000)})}
function pcPng(url){return new Promise(function(res){if(!url){res(null);return}
  var listo=false;function fin(v){if(!listo){listo=true;res(v)}}
  var im=new Image();im.crossOrigin="anonymous";
  im.onload=function(){try{var c=document.createElement("canvas");c.width=im.width;c.height=im.height;c.getContext("2d").drawImage(im,0,0);fin({src:c.toDataURL("image/png"),w:im.width,h:im.height})}catch(e){fin(null)}};
  im.onerror=function(){fin(null)};im.src=url;setTimeout(function(){fin(null)},8000)})}

/* ---------- piezas de dibujo ---------- */
var PCC={NEGRO:[18,18,18],ROJO:[215,25,32],GRIS:[95,95,95],GRIS2:[150,150,150],CLARO:[244,244,244],LINEA:[222,222,222],BLANCO:[255,255,255],VERDE:[46,160,67],AMBAR:[242,169,0]};
function pcF(doc,c){doc.setFillColor(c[0],c[1],c[2])}
function pcD(doc,c){doc.setDrawColor(c[0],c[1],c[2])}
function pcT(doc,c){doc.setTextColor(c[0],c[1],c[2])}
function pcFont(doc,est,tam,col){doc.setFont("helvetica",est||"normal");doc.setFontSize(tam);if(col)pcT(doc,col)}
// Texto cortado a "max" líneas (la última con "…" si no entra)
function pcLineas(doc,txt,ancho,max){var l=doc.splitTextToSize(String(txt||""),ancho);if(max&&l.length>max){l=l.slice(0,max);l[max-1]=l[max-1].replace(/\s*\S*$/,"")+"…"}return l}
function pcArco(doc,cx,cy,r,a0,a1,col,grosor){
  pcD(doc,col);doc.setLineWidth(grosor);doc.setLineCap("round");
  var n=Math.max(2,Math.ceil(Math.abs(a1-a0)/4)),pa=null;
  for(var i=0;i<=n;i++){var a=(a0+(a1-a0)*i/n)*Math.PI/180,p=[cx+r*Math.cos(a),cy+r*Math.sin(a)];if(pa)doc.line(pa[0],pa[1],p[0],p[1]);pa=p}
  doc.setLineCap("butt");doc.setLineWidth(.2);
}
function pcTilde(doc,x,y,r,ok){pcF(doc,ok?PCC.VERDE:PCC.ROJO);doc.circle(x,y,r,"F");pcD(doc,PCC.BLANCO);doc.setLineWidth(r*.32);doc.setLineCap("round");
  if(ok){doc.line(x-r*.45,y+r*.02,x-r*.1,y+r*.38);doc.line(x-r*.1,y+r*.38,x+r*.48,y-r*.35)}else{doc.line(x-r*.38,y-r*.38,x+r*.38,y+r*.38);doc.line(x-r*.38,y+r*.38,x+r*.38,y-r*.38)}
  doc.setLineCap("butt");doc.setLineWidth(.2)}
function pcAviso(doc,x,y,s){pcF(doc,PCC.ROJO);doc.triangle(x,y+s,x+s/2,y,x+s,y+s,"F");pcFont(doc,"bold",s*2.2,PCC.BLANCO);doc.text("!",x+s/2,y+s*.9,{align:"center"})}
function pcIcono(doc,x,y,s){pcF(doc,PCC.ROJO);doc.roundedRect(x,y,s,s,1,1,"F");pcF(doc,PCC.BLANCO);doc.rect(x+s*.28,y+s*.3,s*.44,s*.08,"F");doc.rect(x+s*.28,y+s*.48,s*.44,s*.08,"F");doc.rect(x+s*.28,y+s*.66,s*.3,s*.08,"F")}
function pcTitulo(doc,txt,x,y,tam){pcIcono(doc,x,y-3.6,4.6);pcFont(doc,"bold",tam||10.5,PCC.NEGRO);doc.text(txt,x+6.6,y)}
function pcSubtitulo(doc,txt,x,y){pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text(txt,x,y)}
function pcCaja(doc,x,y,w,h,fondo){pcF(doc,fondo||PCC.BLANCO);pcD(doc,PCC.LINEA);doc.setLineWidth(.25);doc.roundedRect(x,y,w,h,1.5,1.5,"FD");doc.setLineWidth(.2)}
function pcFoto(doc,img,x,y,w,h){if(img&&img.src){doc.addImage(img.src,"JPEG",x,y,w,h,undefined,"FAST")}else{pcF(doc,[232,232,232]);doc.rect(x,y,w,h,"F");pcFont(doc,"normal",6,PCC.GRIS2);doc.text("Sin foto",x+w/2,y+h/2+1,{align:"center"})}}
function pcQr(doc,texto,x,y,lado){
  if(!window.qrcode)return;try{var q=qrcode(0,"M");q.addData(texto);q.make();var n=q.getModuleCount(),c=lado/n;
   pcF(doc,PCC.BLANCO);doc.rect(x-1,y-1,lado+2,lado+2,"F");pcF(doc,PCC.NEGRO);
   for(var r=0;r<n;r++)for(var k=0;k<n;k++)if(q.isDark(r,k))doc.rect(x+k*c,y+r*c,c+.02,c+.02,"F")}catch(e){}}
// Texto con partes en negrita o en color, cortado a lo ancho
function pcRico(doc,partes,x,y,ancho,tam,interlinea){
  var cx=x;doc.setFontSize(tam);
  partes.forEach(function(p){String(p.t).split(/(\s+)/).forEach(function(w){if(!w)return;
   doc.setFont("helvetica",p.b?"bold":"normal");pcT(doc,p.c||PCC.NEGRO);
   var an=doc.getTextWidth(w);
   if(/^\s+$/.test(w)){if(cx>x)cx+=an;return}
   if(cx+an>x+ancho&&cx>x){y+=interlinea;cx=x}
   doc.text(w,cx,y);cx+=an})});
  return y;
}
// Encabezado negro con el logo del taller y la franja roja inclinada
async function pcEncabezado(doc,taller,alto,logo){
  pcF(doc,PCC.NEGRO);doc.rect(0,0,210,alto,"F");
  pcF(doc,PCC.ROJO);var x1=74,x2=80;doc.triangle(x1,alto,x2,alto,x2+alto*.55,0,"F");doc.triangle(x1,alto,x2+alto*.55,0,x1+alto*.55,0,"F");
  pcF(doc,[48,48,48]);doc.triangle(x2+1.5,alto,x2+3,alto,x2+3+alto*.55,0,"F");doc.triangle(x2+1.5,alto,x2+3+alto*.55,0,x2+1.5+alto*.55,0,"F");
  var maxW=60,maxH=alto-10;
  if(logo){var k=Math.min(maxW/logo.w,maxH/logo.h),lw=logo.w*k,lh=logo.h*k,ly=(alto-lh)/2;
   if(logo.transp&&logo.oscuro){doc.setFillColor(255,255,255);doc.roundedRect(9,ly-1.5,lw+4,lh+3,1.5,1.5,"F")}
   doc.addImage(logo.src,"PNG",11,ly,lw,lh);
  }else{pcFont(doc,"bolditalic",17,PCC.BLANCO);var l=pcLineas(doc,String(taller.nombre||"").toUpperCase(),60,2);doc.text(l,11,alto/2+(l.length>1?-1.5:2.5))}
}
function pcPieBarra(doc,y,items){
  pcF(doc,PCC.NEGRO);doc.rect(0,y,210,297-y,"F");
  var an=210/items.length;
  items.forEach(function(it,i){var x=i*an+12;
   pcF(doc,PCC.ROJO);doc.circle(x+3.5,y+7,3.6,"F");pcD(doc,PCC.BLANCO);doc.setLineWidth(.6);doc.setLineCap("round");doc.line(x+1.9,y+7.1,x+3.1,y+8.4);doc.line(x+3.1,y+8.4,x+5.2,y+5.7);doc.setLineCap("butt");doc.setLineWidth(.2);
   pcFont(doc,"bold",7.5,PCC.BLANCO);doc.text(it[0],x+9,y+6.2);pcFont(doc,"normal",6.3,[200,200,200]);doc.text(it[1],x+9,y+9.8)});
}
function pcContactoTaller(t){var tel=String(t.telefono||"").trim(),ig=String(t.instagram||"").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i,"").replace(/[\/?].*$/,"").replace(/^@/,"");
  return [t.nombre,t.direccion,tel?"Tel. "+tel:"",ig?"@"+ig:""].filter(function(x){return String(x||"").trim()}).join("  ·  ")}

/* ---------- PDF del informe ---------- */
// inf: fila de "precompras" (o la del QR), taller: {nombre, logo_url, ...}, cfg: ajustes (rangos, firma_ruta)
async function pcPdfInforme(inf,taller,cfg,fotosUrl){
  var J=window.jspdf.jsPDF,doc=new J({unit:"mm",format:"a4"}),D=inf.datos||{},F=inf.fotos||{},url=fotosUrl||pcUrlFoto;
  var total=pcTotal(D),cal=pcCalif(total,cfg),riesgo=pcRiesgo(D,total),recom=pcRecom(D,total);
  // imágenes en paralelo
  var gal=(F.galeria||[]).slice(0,3),gal2=(F.galeria||[]).slice(3,9);
  var pedidos=[recortarLogo(taller.logo_url||taller.logo,500),pcImg(url(F.principal),63/44),pcPng(url(D.firma_ruta||(cfg&&cfg.firma_ruta)))]
   .concat(gal.map(function(r){return pcImg(url(r),20.3/22)}))
   .concat(PC_NEU.map(function(n){return pcImg(url(F["neu_"+n[0]]),45/24)}))
   .concat(["frenos","escaneo","manejo","interior"].map(function(k){return pcImg(url(F[k]),20/26)}))
   .concat(gal2.map(function(r){return pcImg(url(r),30/22)}));
  var im=await Promise.all(pedidos),logo=im[0],principal=im[1],firma=im[2],thumbs=im.slice(3,3+gal.length),
   neuImg=im.slice(3+gal.length,7+gal.length),subImg=im.slice(7+gal.length,11+gal.length),extraImg=im.slice(11+gal.length);
  var codigo=inf.codigo||"BORRADOR",fecha=pcFecha(inf.fecha);

  /* ===== página 1 ===== */
  await pcEncabezado(doc,taller,32,logo);
  pcFont(doc,"normal",10,PCC.BLANCO);doc.text("INFORME DE VERIFICACIÓN",130,11,{align:"center"});
  pcFont(doc,"bolditalic",15.5);var a1=doc.getTextWidth("PRECOMPRA "),a2=doc.getTextWidth("PREMIUM"),xi=130-(a1+a2)/2;
  pcT(doc,PCC.BLANCO);doc.text("PRECOMPRA ",xi,20.5);pcT(doc,PCC.ROJO);doc.text("PREMIUM",xi+a1,20.5);
  pcFont(doc,"normal",8,PCC.BLANCO);doc.text("INSPECCIÓN TÉCNICA PROFESIONAL",130,27,{align:"center"});
  pcD(doc,[120,120,120]);doc.setLineWidth(.3);doc.roundedRect(163,4.5,41,23,1.5,1.5,"S");doc.line(165,16,202,16);doc.setLineWidth(.2);
  pcFont(doc,"normal",6,PCC.BLANCO);doc.text("N° DE INFORME",183.5,8.6,{align:"center"});
  pcFont(doc,"bold",11,PCC.ROJO);doc.text(codigo,183.5,13.8,{align:"center"});
  pcFont(doc,"normal",6,PCC.BLANCO);doc.text("FECHA DE INSPECCIÓN",183.5,19.8,{align:"center"});
  pcFont(doc,"bold",9.5,PCC.BLANCO);doc.text(fecha||"-",183.5,25,{align:"center"});

  // datos del vehículo
  var y=36;
  pcTitulo(doc,"DATOS DEL VEHÍCULO",8,y+4,9.5);
  var filas=[["MARCA / MODELO",[inf.marca,inf.modelo].filter(Boolean).join(" ")],["AÑO",inf.anio],["DOMINIO",inf.patente],["KILOMETRAJE INDICADO",inf.km!=null&&inf.km!==""?Number(inf.km).toLocaleString("es-AR")+" km":""],
   ["MOTOR",inf.motor],["COMBUSTIBLE",inf.combustible],["TRANSMISIÓN",inf.transmision],["COLOR",inf.color],["N° DE CHASIS (VIN)",inf.vin],["CLIENTE",inf.cliente&&inf.cliente.nombre],["LUGAR DE INSPECCIÓN",inf.lugar]];
  var fy=45;
  filas.forEach(function(f){pcFont(doc,"normal",6,PCC.GRIS);doc.text(f[0],8,fy);pcFont(doc,"bold",7,PCC.NEGRO);doc.text(pcLineas(doc,f[1]==null||f[1]===""?"-":String(f[1]),37,1),36,fy);
   pcD(doc,PCC.LINEA);doc.line(8,fy+1.9,73,fy+1.9);fy+=5.3});
  // fotos
  pcFoto(doc,principal,76,36,63,44);
  for(var t=0;t<3;t++){var tx=76+t*21.35;if(thumbs[t])pcFoto(doc,thumbs[t],tx,82,20.3,22);else{pcF(doc,PCC.CLARO);doc.rect(tx,82,20.3,22,"F")}}
  // puntaje general
  pcF(doc,PCC.NEGRO);doc.roundedRect(142,36,62,46,1.5,1.5,"F");
  pcFont(doc,"bold",7.8,PCC.BLANCO);doc.text("PUNTAJE GENERAL DEL VEHÍCULO",173,41.5,{align:"center"});
  pcArco(doc,173,57,11,0,360,[60,60,60],2.6);if(total>0)pcArco(doc,173,57,11,-90,-90+360*total/100,cal.col,2.6);
  pcFont(doc,"bold",20,PCC.BLANCO);doc.text(String(total),173,58.5,{align:"center"});pcFont(doc,"normal",7);doc.text("/100",173,63,{align:"center"});
  pcF(doc,cal.col);doc.roundedRect(150,72,46,7,1,1,"F");pcFont(doc,"bold",8.5,PCC.BLANCO);doc.text(String(cal.txt).toUpperCase(),173,76.9,{align:"center"});
  pcCaja(doc,142,82,62,22,PCC.CLARO);pcFont(doc,"bold",7.5,PCC.NEGRO);doc.text("RESUMEN EJECUTIVO",145,86.5);
  pcFont(doc,"normal",6.4,[40,40,40]);doc.text(pcLineas(doc,D.resumen||"-",56,5),145,90.3,{lineHeightFactor:1.25});

  // categorías
  y=109;pcTitulo(doc,"PUNTUACIÓN POR CATEGORÍAS",8,y+3,9.5);
  pcD(doc,PCC.LINEA);doc.line(8,107,139,107);
  var cw=64.5,ch=23,gy=115;
  PC_CATS.forEach(function(c,i){var col=i%2,fila=Math.floor(i/2),x=8+col*(cw+2),yy=gy+fila*(ch+2),p=pcPuntos(D,c.k),pct=p/c.max,cc=pcColPct(pct);
   pcCaja(doc,x,yy,cw,ch);
   pcFont(doc,"bold",7.2,PCC.NEGRO);doc.text(pcLineas(doc,(i+1)+". "+c.n.toUpperCase(),46,1),x+3,yy+5);
   pcFont(doc,"bold",6.2,PCC.ROJO);doc.text(c.max+" PTS",x+cw-3,yy+5,{align:"right"});
   pcFont(doc,"bold",13,cc);doc.text(String(p),x+3,yy+12.3);var wn=doc.getTextWidth(String(p));pcFont(doc,"bold",8);doc.text("/"+c.max,x+3+wn+.5,yy+12.3);
   pcF(doc,[228,228,228]);doc.roundedRect(x+22,yy+9.6,cw-26,2.2,1.1,1.1,"F");if(pct>0){pcF(doc,cc);doc.roundedRect(x+22,yy+9.6,Math.max(2.2,(cw-26)*pct),2.2,1.1,1.1,"F")}
   pcFont(doc,"normal",6,[60,60,60]);doc.text(pcLineas(doc,pcComentario(D,c.k)||"-",cw-6,3),x+3,yy+16,{lineHeightFactor:1.2})});
  // puntaje total
  var px=8+cw+2,py=gy+3*(ch+2);pcF(doc,PCC.NEGRO);doc.roundedRect(px,py,cw,ch,1.5,1.5,"F");
  pcFont(doc,"bold",8,PCC.BLANCO);doc.text("PUNTAJE TOTAL",px+4,py+7);pcFont(doc,"bold",19);doc.text(String(total),px+4,py+17.5);
  var wt=doc.getTextWidth(String(total));pcFont(doc,"bold",9);doc.text("/100",px+5+wt,py+17.5);
  pcD(doc,[90,90,90]);doc.line(px+30,py+3,px+30,py+ch-3);
  pcRangos(cfg).forEach(function(r,i){var ly=py+4.3+i*3.7;pcF(doc,PC_RANGO_COL[i]);doc.circle(px+33,ly-.8,1,"F");
   pcFont(doc,"bold",5.4,PCC.BLANCO);var hasta=i===0?"100":String(pcNum(pcRangos(cfg)[i-1].min)-1);doc.text(i===4?"< "+pcNum(pcRangos(cfg)[3].min):pcNum(r.min)+"-"+hasta,px+35,ly);
   pcFont(doc,"normal",5.4);doc.text(pcLineas(doc,r.txt,18,1),px+45,ly)});

  // observaciones generales y responsable
  var oy=gy+4*(ch+2)+1;
  pcCaja(doc,8,oy,131,25);pcIcono(doc,11,oy+3,4.6);pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text("OBSERVACIONES GENERALES",17.6,oy+6.6);
  pcFont(doc,"normal",6.6,[40,40,40]);doc.text(pcLineas(doc,D.observaciones||"-",124,5),11.5,oy+11.5,{lineHeightFactor:1.25});
  var ry=oy+27,R=D.responsable||{};
  pcCaja(doc,8,ry,94,29);pcFont(doc,"bold",8.5,PCC.NEGRO);pcIcono(doc,11,ry+3,4.6);doc.text("RESPONSABLE DE LA INSPECCIÓN",17.6,ry+6.6);
  pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text(pcLineas(doc,R.nombre||"-",42,1),11.5,ry+14);
  pcFont(doc,"normal",7,PCC.GRIS);doc.text("Mecánico matriculado",11.5,ry+18.5);if(pcTxt(R.matricula))doc.text("MP: "+pcTxt(R.matricula),11.5,ry+22.5);
  if(firma){var fk=Math.min(38/firma.w,12/firma.h);doc.addImage(firma.src,"PNG",77-firma.w*fk/2,ry+21.8-firma.h*fk,firma.w*fk,firma.h*fk)}
  pcD(doc,PCC.GRIS2);doc.line(55,ry+22.5,99,ry+22.5);pcFont(doc,"normal",6.3,PCC.GRIS);doc.text(pcLineas(doc,taller.nombre||"",44,1),77,ry+26,{align:"center"});
  pcCaja(doc,104,ry,35,29);
  if(inf.qr_token){pcQr(doc,pcUrlInforme(inf.qr_token),106.5,ry+3,17);pcFont(doc,"normal",5.3,PCC.GRIS);doc.text(["Escaneá para","ver todas","las fotos y el","informe","digital"],125,ry+7.5,{lineHeightFactor:1.25})}
  else{pcFont(doc,"normal",6,PCC.GRIS);doc.text(["El QR aparece","al guardar","el informe"],121.5,ry+12,{align:"center"})}

  // columna derecha: alertas, gastos, recomendación y riesgo
  var x0=142,w0=62,yr=107;
  var alertas=(D.alertas||[]).map(pcTxt).filter(Boolean);
  pcFont(doc,"normal",6.5);
  var lineasAl=[],maxL=14;alertas.forEach(function(a){var l=doc.splitTextToSize(a,w0-10);lineasAl.push(l)});
  var usadas=0,mostrar=[];lineasAl.forEach(function(l){if(usadas+l.length<=maxL){mostrar.push(l);usadas+=l.length}});
  var hAl=10+Math.max(1,usadas)*3+(mostrar.length<lineasAl.length?3.5:0)+3;
  pcCaja(doc,x0,yr,w0,hAl);pcF(doc,PCC.ROJO);doc.roundedRect(x0,yr,w0,7.5,1.5,1.5,"F");doc.rect(x0,yr+4,w0,3.5,"F");
  pcAviso(doc,x0+3,yr+1.8,4);pcFont(doc,"bold",8.5,PCC.BLANCO);doc.text("ALERTAS IMPORTANTES",x0+9.5,yr+5.4);
  var ay=yr+11.5;pcFont(doc,"normal",6.5,[40,40,40]);
  if(!mostrar.length){doc.text("Sin alertas importantes.",x0+3,ay)}
  mostrar.forEach(function(l){pcAviso(doc,x0+3,ay-2.3,2.6);pcFont(doc,"normal",6.5,[40,40,40]);doc.text(l,x0+7.5,ay,{lineHeightFactor:1.3});ay+=l.length*3});
  if(mostrar.length<lineasAl.length){pcFont(doc,"italic",6,PCC.GRIS);doc.text("+"+(lineasAl.length-mostrar.length)+" más en el informe digital",x0+3,ay)}
  yr+=hAl+2;
  var gastos=(D.gastos||[]).filter(function(g){return pcTxt(g.desc)||pcNum(g.costo)}),gm=gastos.slice(0,7),hG=19+Math.max(1,gm.length)*4.4+(gastos.length>gm.length?3:0);
  pcCaja(doc,x0,yr,w0,hG);pcIcono(doc,x0+3,yr+2.5,4.6);pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text("ESTIMACIÓN DE GASTOS",x0+9.5,yr+6.2);
  pcFont(doc,"bold",5.6,PCC.NEGRO);doc.text("REPARACIÓN / SERVICIO",x0+3,yr+11.5);doc.text("COSTO ESTIMADO",x0+w0-3,yr+11.5,{align:"right"});pcD(doc,PCC.LINEA);doc.line(x0+2,yr+13,x0+w0-2,yr+13);
  var gy2=yr+16.8;
  if(!gm.length){pcFont(doc,"normal",6.5,PCC.GRIS);doc.text("Sin gastos estimados.",x0+3,gy2)}
  gm.forEach(function(g){pcFont(doc,"normal",6.5,[40,40,40]);doc.text(pcLineas(doc,pcTxt(g.desc)||"-",36,1),x0+3,gy2);doc.text(pcPlata(g.costo),x0+w0-3,gy2,{align:"right"});pcD(doc,[236,236,236]);doc.line(x0+2,gy2+1.4,x0+w0-2,gy2+1.4);gy2+=4.4});
  if(gastos.length>gm.length){pcFont(doc,"italic",5.8,PCC.GRIS);doc.text("+"+(gastos.length-gm.length)+" ítems más en el informe digital",x0+3,gy2-1.2);gy2+=3}
  pcFont(doc,"bold",7.5,PCC.ROJO);doc.text("TOTAL ESTIMADO",x0+3,gy2+.6);doc.text(pcPlata(pcGastosTotal(D)),x0+w0-3,gy2+.6,{align:"right"});
  yr+=hG+2;
  var rtxt=pcLineas(doc,D.recom_txt||"",50,4),hR=Math.max(30,22+rtxt.length*2.9+4);
  pcFont(doc,"bold",11.5);var rl=pcLineas(doc,pcRecomTxt(recom),48,2);hR=Math.max(hR,14+rl.length*5+rtxt.length*2.9+6);
  pcCaja(doc,x0,yr,w0,hR,PCC.CLARO);pcTilde(doc,x0+6,yr+7,3.6,recom!=="no");
  pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text("RECOMENDACIÓN FINAL",x0+12,yr+8);
  pcFont(doc,"bold",11.5,pcRecomCol(recom));doc.text(rl,x0+12,yr+14.5,{lineHeightFactor:1.1});
  pcFont(doc,"normal",6.4,[40,40,40]);doc.text(pcLineas(doc,D.recom_txt||"",48,4),x0+12,yr+15.5+rl.length*5,{lineHeightFactor:1.3});
  yr+=hR+2;
  var hRi=Math.min(36,276-yr);
  if(hRi>=26){pcCaja(doc,x0,yr,w0,hRi);pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text("RIESGO DE COMPRA",x0+3,yr+6);
   var cx=x0+w0/2,cy=yr+hRi-9,rr=11;
   pcArco(doc,cx,cy,rr,180,240,PCC.VERDE,3.4);pcArco(doc,cx,cy,rr,242,298,PCC.AMBAR,3.4);pcArco(doc,cx,cy,rr,300,360,PCC.ROJO,3.4);
   var ang=(riesgo==="bajo"?210:riesgo==="moderado"?270:330)*Math.PI/180;
   pcD(doc,PCC.NEGRO);doc.setLineWidth(.9);doc.line(cx,cy,cx+(rr-3)*Math.cos(ang),cy+(rr-3)*Math.sin(ang));doc.setLineWidth(.2);pcF(doc,PCC.NEGRO);doc.circle(cx,cy,1.4,"F");
   var rc=riesgo==="bajo"?PCC.VERDE:riesgo==="moderado"?[220,140,0]:PCC.ROJO;
   pcFont(doc,"bold",9.5,rc);doc.text(("Riesgo "+riesgo).toUpperCase(),cx,cy+6,{align:"center"})}
  pcFont(doc,"normal",6,PCC.GRIS);doc.text(pcLineas(doc,pcContactoTaller(taller),194,1),105,279.5,{align:"center"});
  pcPieBarra(doc,282,[["INSPECCIÓN PROFESIONAL","Equipamiento de diagnóstico avanzado"],["INFORME DETALLADO","Con fotos y observaciones reales"],["TRANSPARENCIA TOTAL","Información clara para tu decisión"]]);

  /* ===== página 2 ===== */
  doc.addPage();
  await pcEncabezado(doc,taller,22,logo);
  pcFont(doc,"bolditalic",13,PCC.BLANCO);doc.text("INFORME PRECOMPRA",204,10,{align:"right"});
  pcFont(doc,"normal",8,[200,200,200]);doc.text([codigo,[inf.marca,inf.modelo,inf.anio].filter(Boolean).join(" "),inf.patente].filter(Boolean).join("  ·  "),204,16.5,{align:"right"});
  // carrocería
  y=27;pcCaja(doc,8,y,196,88);pcFont(doc,"bold",9.5,PCC.NEGRO);doc.text("CARROCERÍA Y PINTURA - DETALLE",12,y+6);
  var ex=19,ey=y+10,k=.74;
  pcF(doc,[51,51,51]);[[ -1.5,8],[34.5,8],[-1.5,56],[34.5,56]].forEach(function(r){doc.roundedRect(ex+r[0]*k,ey+r[1]*k,3*k,10*k,.8,.8,"F")});
  pcF(doc,[91,102,112]);doc.roundedRect(ex+7*k,ey+23*k,22*k,6*k,1.2,1.2,"F");doc.roundedRect(ex+7*k,ey+51*k,22*k,5*k,1.2,1.2,"F");
  PC_ESQUEMA.forEach(function(p){var e=pcSecDe(D,p[0]).estado,c=e?pcEstado(e)[2]:[201,204,209];pcF(doc,c);pcD(doc,PCC.BLANCO);doc.setLineWidth(.35);doc.roundedRect(ex+p[1]*k,ey+p[2]*k,p[3]*k,p[4]*k,1.1,1.1,"FD")});
  doc.setLineWidth(.2);
  PC_ESTADOS.forEach(function(e,i){pcF(doc,e[2]);doc.rect(12,y+71+i*4.5,3,3,"F");pcFont(doc,"normal",6.3,[40,40,40]);doc.text(e[1],16.5,y+73.4+i*4.5)});
  var tx0=58,cols=[tx0,tx0+40,tx0+66,202];
  pcF(doc,PCC.NEGRO);doc.rect(tx0-2,y+9,148,6,"F");pcFont(doc,"bold",6.2,PCC.BLANCO);
  doc.text("SECTOR",cols[0],y+13);doc.text("ESTADO",cols[1],y+13);doc.text("OBSERVACIONES",cols[2],y+13);doc.text("ESPESOR (µm)",cols[3],y+13,{align:"right"});
  var sy=y+20;
  PC_SECTORES.forEach(function(s,i){var d=pcSecDe(D,s[0]),e=pcEstado(d.estado);if(i%2){pcF(doc,[248,248,248]);doc.rect(tx0-2,sy-4,148,5.6,"F")}
   pcFont(doc,"normal",6.6,[30,30,30]);doc.text(s[1],cols[0],sy);
   pcFont(doc,"bold",6.6,d.estado?(d.estado==="original"?PCC.VERDE:d.estado==="repintado"?[200,130,0]:PCC.ROJO):PCC.GRIS2);doc.text(d.estado?e[1]:"-",cols[1],sy);
   pcFont(doc,"normal",6.4,[60,60,60]);doc.text(pcLineas(doc,pcTxt(d.obs)||"—",64,1),cols[2],sy);doc.text(pcTxt(d.um)||"—",cols[3],sy,{align:"right"});sy+=5.6});
  pcFont(doc,"italic",5.8,PCC.GRIS);doc.text("*Espesores medidos con medidor de pintura digital.",tx0-2,y+85);
  // neumáticos
  y=119;pcCaja(doc,8,y,196,49);pcFont(doc,"bold",9.5,PCC.NEGRO);doc.text("NEUMÁTICOS - DETALLE Y VIDA ÚTIL",12,y+6);
  PC_NEU.forEach(function(n,i){var x=12+i*47.5,d=pcNeuDe(D,n[0]),v=pcTxt(d.vida)?pcNum(d.vida):null;
   pcFoto(doc,neuImg[i],x,y+9,45,24);
   pcFont(doc,"bold",7,PCC.NEGRO);doc.text(n[1],x,y+37);
   pcFont(doc,"normal",6.4,[60,60,60]);doc.text("DOT: "+(pcTxt(d.dot)||"-")+"   ·   "+(pcTxt(d.mm)?pcTxt(d.mm).replace(".",",")+" mm":"- mm"),x,y+40.6);
   pcF(doc,[228,228,228]);doc.roundedRect(x,y+42.6,45,2,1,1,"F");if(v){pcF(doc,pcColPct(v/100));doc.roundedRect(x,y+42.6,Math.max(2,45*Math.min(100,v)/100),2,1,1,"F")}
   pcFont(doc,"bold",6.2,v==null?PCC.GRIS2:pcColPct(v/100));doc.text(v==null?"Vida útil: -":v+"% de vida útil",x+45,y+40.6,{align:"right"})});
  // submódulos
  y=172;var subs=[["FRENOS",function(x,yy){var f=D.frenos||{};
     pcFont(doc,"bold",6.6,PCC.NEGRO);doc.text("Delanteros",x,yy);pcFont(doc,"normal",6.2,[60,60,60]);doc.text(["Pastillas: "+(pcTxt(f.pd)?pcNum(f.pd)+"%":"-"),"Discos: "+(pcTxt(f.dd)||"-")],x,yy+3.3,{lineHeightFactor:1.3});
     pcFont(doc,"bold",6.6,PCC.NEGRO);doc.text("Traseros",x,yy+11);pcFont(doc,"normal",6.2,[60,60,60]);doc.text(["Pastillas: "+(pcTxt(f.pt)?pcNum(f.pt)+"%":"-"),"Discos: "+(pcTxt(f.dt)||"-")],x,yy+14.3,{lineHeightFactor:1.3});
     if(f.parejo!=null){pcTilde(doc,x+1.3,yy+23,1.4,!!f.parejo);pcFont(doc,"normal",6.2,[40,40,40]);doc.text(f.parejo?"Frenado parejo y eficiente":"Frenado a revisar",x+3.8,yy+24)}}],
   ["ESCANEO ELECTRÓNICO",function(x,yy){var e=D.escaneo||{};pcFont(doc,"normal",6.2,[60,60,60]);var l=pcLineas(doc,pcTxt(e.fallas)||"Sin fallas activas.",43,2);doc.text(l,x,yy,{lineHeightFactor:1.25});
     var ly=yy+l.length*2.8+2.5;PC_ESCANEO.forEach(function(m){if(e[m[0]]==null)return;pcTilde(doc,x+1.3,ly-.9,1.4,!!e[m[0]]);pcFont(doc,"normal",6.4,[40,40,40]);doc.text(m[1]+(e[m[0]]?" OK":" con falla"),x+3.8,ly);ly+=3.6})}],
   ["PRUEBA DE MANEJO",function(x,yy){var p=D.manejo||{};PC_MANEJO.forEach(function(m,i){var v=pcTxt(p[m[0]]);var ok=pcOk(v,m[0]);
     if(!v){pcFont(doc,"normal",6.2,PCC.GRIS2);doc.text(m[1]+": -",x+3.8,yy+i*3.8)}else{pcTilde(doc,x+1.3,yy+i*3.8-.9,1.4,ok);pcFont(doc,"normal",6.2,[40,40,40]);doc.text(pcLineas(doc,m[1]+": "+v,40,1),x+3.8,yy+i*3.8)}})}],
   ["INTERIOR",function(x,yy){var p=D.interior||{};PC_INTERIOR.forEach(function(m,i){var v=pcTxt(p[m[0]]);
     if(!v){pcFont(doc,"normal",6.2,PCC.GRIS2);doc.text(m[1]+": -",x+3.8,yy+i*3.8)}else{pcTilde(doc,x+1.3,yy+i*3.8-.9,1.4,pcOk(v,m[0]));pcFont(doc,"normal",6.2,[40,40,40]);doc.text(pcLineas(doc,m[1]+": "+v,40,1),x+3.8,yy+i*3.8)}})}]];
  subs.forEach(function(s,i){var x=8+i*49.5;pcCaja(doc,x,y,47.5,64);pcFont(doc,"bold",8,PCC.NEGRO);doc.text(s[0],x+3,y+6);
   pcFoto(doc,subImg[i],x+3,y+8.5,41.5,24);s[1](x+3,y+37)});
  // fotos adicionales
  y=240;
  if(extraImg.length){pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text("FOTOS ADICIONALES",8,y+3);extraImg.forEach(function(im2,i){pcFoto(doc,im2,8+i*33,y+5.5,31,22.7)})}
  else{pcCaja(doc,8,y,196,30,PCC.CLARO);pcFont(doc,"normal",7,PCC.GRIS);doc.text(doc.splitTextToSize("El presente informe refleja únicamente el estado observable del vehículo al momento de la inspección, sin desarme. No reemplaza verificaciones legales, policiales, registrales ni administrativas. La decisión final de compra es exclusiva responsabilidad del cliente.",188),12,y+8,{lineHeightFactor:1.4})}
  pcFont(doc,"normal",6,PCC.GRIS);doc.text(pcLineas(doc,pcContactoTaller(taller),194,1),105,279.5,{align:"center"});
  pcPieBarra(doc,282,[["INSPECCIÓN PROFESIONAL","Equipamiento de diagnóstico avanzado"],["INFORME DETALLADO","Con fotos y observaciones reales"],["TRANSPARENCIA TOTAL","Información clara para tu decisión"]]);
  return {doc:doc,nombre:"Informe_precompra_"+String(codigo).replace(/[^A-Za-z0-9-]+/g,"")+(inf.patente?"_"+inf.patente:"")+".pdf"};
}

/* ---------- PDF del contrato / consentimiento ---------- */
async function pcPdfContrato(inf,taller,cfg,firmaCliente,firmaTecUrl){
  var J=window.jspdf.jsPDF,doc=new J({unit:"mm",format:"a4"}),D=inf.datos||{},C=inf.cliente||{},nombre=String(taller.nombre||"El taller");
  var im=await Promise.all([recortarLogo(taller.logo_url||taller.logo,500),pcPng(firmaTecUrl),firmaCliente?pcPng(firmaCliente):Promise.resolve(null)]);
  var logo=im[0],firmaTec=im[1],firmaCli=im[2];
  await pcEncabezado(doc,taller,40,logo);
  pcFont(doc,"bold",12,PCC.BLANCO);doc.text(["CONTRATO / CONSENTIMIENTO","DE SERVICIO"],120,11,{lineHeightFactor:1.15});
  pcFont(doc,"bolditalic",17,PCC.BLANCO);doc.text("VERIFICACIÓN",120,27);pcT(doc,PCC.ROJO);doc.text("VEHICULAR PRECOMPRA",120,35);
  // fecha
  var f=String(inf.fecha||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
  pcFont(doc,"bold",9,PCC.NEGRO);doc.text("Fecha:",142,48);pcFont(doc,"normal",9);doc.text(f?f[3]+"  /  "+f[2]+"  /  "+f[1]:"______ / ______ / ________",156,48);
  pcD(doc,PCC.LINEA);doc.line(8,51.5,202,51.5);
  function campo(lbl,val,x,y,ancho){pcFont(doc,"normal",8,[40,40,40]);doc.text(lbl+":",x,y);var w=doc.getTextWidth(lbl+": ");
   pcD(doc,[120,120,120]);doc.setLineWidth(.2);doc.line(x+w,y+.8,x+ancho,y+.8);if(pcTxt(val)){pcFont(doc,"bold",8.2,PCC.NEGRO);doc.text(pcLineas(doc,pcTxt(val),ancho-w-1,1),x+w+.5,y-.3)}}
  var y=59;pcTitulo(doc,"DATOS DEL CLIENTE",8,y,10);pcTitulo(doc,"DATOS DEL VEHÍCULO INSPECCIONADO",110,y,10);
  pcD(doc,PCC.LINEA);doc.line(106,54,106,89);
  campo("Nombre y apellido",C.nombre,8,y+8,92);campo("DNI",C.dni,8,y+15,92);campo("Teléfono",C.telefono,8,y+22,92);campo("Correo electrónico",C.email,8,y+29,92);
  campo("Marca y modelo",[inf.marca,inf.modelo].filter(Boolean).join(" "),110,y+8,92);campo("Año",inf.anio,110,y+15,92);campo("Dominio / Patente",inf.patente,110,y+22,92);
  campo("Kilometraje indicado",inf.km!=null&&inf.km!==""?Number(inf.km).toLocaleString("es-AR")+" km":"",110,y+29,92);
  pcD(doc,PCC.LINEA);doc.line(8,92,202,92);
  pcF(doc,PCC.ROJO);doc.circle(10,97.3,1.6,"F");pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text("UBICACIÓN DE LA INSPECCIÓN:",13.5,98.5);
  var wu=doc.getTextWidth("UBICACIÓN DE LA INSPECCIÓN: ");pcD(doc,[120,120,120]);doc.line(13.5+wu,99.3,202,99.3);if(pcTxt(inf.lugar)){pcFont(doc,"bold",8.5,PCC.NEGRO);doc.text(pcTxt(inf.lugar),14+wu,98.3)}
  y=108;var rojoB={b:true,c:PCC.ROJO};
  pcTitulo(doc,"OBJETO DEL SERVICIO",8,y,10.5);
  y=pcRico(doc,[{t:"El cliente solicita a "},Object.assign({t:nombre},rojoB),{t:" la realización de una inspección técnica precompra del vehículo mencionado anteriormente, con el fin de obtener una evaluación general de su estado mecánico, estructural, electrónico y estético al momento de la inspección."}],8,y+5.5,194,8.2,4);
  pcD(doc,PCC.LINEA);doc.line(8,y+3,202,y+3);
  y+=10;pcTitulo(doc,"ALCANCE DEL SERVICIO",8,y,10.5);pcFont(doc,"normal",8,[40,40,40]);doc.text("La inspección podrá incluir, según el plan contratado:",13,y+5);
  var alc=[["Diagnóstico visual y electrónico","Escaneo computarizado","Revisión mecánica general","Verificación de pintura y estructura"],
   ["Evaluación de neumáticos, frenos y suspensión","Verificación de posibles indicios de reparación o siniestros"],
   ["Prueba de manejo (si las condiciones lo permiten)","Informe técnico profesional con fotos y observaciones"]];
  var ay=y+11;alc.forEach(function(col,ci){var cy=ay,cx=12+ci*64;col.forEach(function(t){pcF(doc,PCC.ROJO);doc.circle(cx,cy-1,.7,"F");pcFont(doc,"normal",7.8,[30,30,30]);var l=doc.splitTextToSize(t,56);doc.text(l,cx+3,cy,{lineHeightFactor:1.25});cy+=l.length*3.5+1.2})});
  y=ay+19;pcD(doc,PCC.LINEA);doc.line(8,y,202,y);
  y+=7;pcF(doc,PCC.ROJO);doc.triangle(8,y+.8,10.3,y-4,12.6,y+.8,"F");pcFont(doc,"bold",6.5,PCC.BLANCO);doc.text("!",10.3,y,{align:"center"});
  pcFont(doc,"bold",10.5,PCC.NEGRO);doc.text("LIMITACIONES",14.6,y);pcFont(doc,"normal",8,[40,40,40]);doc.text("El cliente acepta y comprende que:",8,y+5);
  var lim=["La inspección es realizada sin desarme completo del vehículo, salvo autorización expresa.","El informe emitido representa únicamente el estado observable del vehículo al momento de la revisión.",
   nombre+" no garantiza el funcionamiento futuro del vehículo ni puede detectar fallas ocultas, internas o intermitentes imposibles de verificar sin desmontaje.",
   "La decisión final de compra es exclusiva responsabilidad del cliente.","El servicio no reemplaza verificaciones legales, policiales, registrales, judiciales o administrativas.",
   "El kilometraje informado se analiza mediante indicios técnicos y electrónicos, sin poder garantizarse legalmente su autenticidad absoluta."];
  var ly=y+10;lim.forEach(function(t,i){pcFont(doc,"bold",8,PCC.ROJO);doc.text((i+1)+".",10,ly);pcFont(doc,"normal",8,[30,30,30]);var l=doc.splitTextToSize(t,185);doc.text(l,15,ly,{lineHeightFactor:1.3});ly+=l.length*3.7+.9});
  y=ly+1;pcD(doc,PCC.LINEA);doc.line(8,y,202,y);
  y+=7;pcTitulo(doc,"RESPONSABILIDAD",8,y,10.5);
  y=pcRico(doc,[Object.assign({t:nombre},rojoB),{t:" actuará con criterio técnico y profesional, pero no será responsable por daños futuros, fallas ocultas, vicios no detectables o decisiones comerciales tomadas por el cliente respecto a la compra del vehículo."}],8,y+5.5,194,8.2,4);
  pcD(doc,PCC.LINEA);doc.line(8,y+3,202,y+3);
  y+=10;pcTilde(doc,10.3,y-1.4,2.3,true);pcFont(doc,"bold",10.5,PCC.NEGRO);doc.text("CONFORMIDAD",14.6,y);
  pcFont(doc,"normal",8,[40,40,40]);doc.text("El cliente declara haber leído y comprendido las condiciones del presente servicio y acepta los términos aquí establecidos.",8,y+5.5);
  // firmas
  var fy=Math.min(y+11,244);
  pcFont(doc,"bold",8.5,PCC.ROJO);doc.text("FIRMA DEL CLIENTE",14,fy);doc.text("FIRMA DEL RESPONSABLE TÉCNICO",160,fy,{align:"center"});
  var co=D.contrato||{};
  if(firmaCli){var k=Math.min(60/firmaCli.w,12/firmaCli.h);doc.addImage(firmaCli.src,"PNG",14,fy+15.5-firmaCli.h*k,firmaCli.w*k,firmaCli.h*k)}
  pcD(doc,[60,60,60]);doc.setLineWidth(.3);doc.line(14,fy+16,86,fy+16);doc.setLineWidth(.2);
  pcFont(doc,"normal",8,[40,40,40]);doc.text("Aclaración:",14,fy+21);doc.line(30,fy+21.6,86,fy+21.6);doc.text("DNI:",14,fy+26);doc.line(21,fy+26.6,86,fy+26.6);
  var acl=pcTxt(co.aclaracion)||(firmaCli?pcTxt(C.nombre):""),dni=pcTxt(co.dni)||(firmaCli?pcTxt(C.dni):"");
  pcFont(doc,"bold",8.2,PCC.NEGRO);if(acl)doc.text(pcLineas(doc,acl,55,1),31,fy+20.7);if(dni)doc.text(dni,22,fy+25.7);
  if(firmaTec){var k2=Math.min(50/firmaTec.w,12/firmaTec.h);doc.addImage(firmaTec.src,"PNG",160-firmaTec.w*k2/2,fy+15.5-firmaTec.h*k2,firmaTec.w*k2,firmaTec.h*k2)}
  pcD(doc,[60,60,60]);doc.setLineWidth(.3);doc.line(124,fy+16,196,fy+16);doc.setLineWidth(.2);
  var R=D.responsable||{};pcFont(doc,"bold",8.2,PCC.NEGRO);doc.text(pcLineas(doc,pcTxt(R.nombre)||nombre,70,1),160,fy+20.5,{align:"center"});
  pcFont(doc,"normal",7.5,PCC.GRIS);doc.text(pcTxt(R.nombre)?nombre+(pcTxt(R.matricula)?"  ·  MP: "+pcTxt(R.matricula):""):"",160,fy+24.5,{align:"center"});
  // pie
  pcPieBarra(doc,273,[["SERVICIO PROFESIONAL","CONFIANZA · TRANSPARENCIA · COMPROMISO"],["INFORME TÉCNICO","REAL, CLARO Y DETALLADO"],["TU MEJOR DECISIÓN","ANTES DE COMPRAR"]]);
  pcF(doc,PCC.ROJO);doc.rect(0,289,210,8,"F");pcFont(doc,"normal",7.5,PCC.BLANCO);doc.text("El presente informe refleja únicamente el estado observable del vehículo al momento de la inspección.",105,294,{align:"center"});
  return {doc:doc,nombre:"Contrato_precompra_"+String(inf.codigo||"").replace(/[^A-Za-z0-9-]+/g,"")+(inf.patente?"_"+inf.patente:"")+".pdf"};
}
