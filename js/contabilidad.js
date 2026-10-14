// Contabilidad: reportes de compras y ventas, posición de IVA (facturas A), gráfico de torta
// de gastos por categoría, reportes en PDF y planilla de impuestos editable.
// Los datos salen de la Caja (ingresos y egresos con su categoría) y de las facturas de compra de Proveedores.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.contabilidad=renderContabilidad;GRUPOS.contabilidad="mas";

var FALTA_SQL_CONTABLE="Para usar la contabilidad completa falta correr en Supabase el SQL nuevo (sql/2026-10-14_2_contabilidad_venta_autos.sql).";
var PERIODOS_CONTA=[["mes","Este mes"],["mesant","Mes pasado"],["3m","Últimos 3 meses"],["anio","Este año"],["todo","Todo"]];

async function renderContabilidad(){
  S.contaPer=S.contaPer||"mes";S.contaTab=S.contaTab||"resumen";
  m.innerHTML="<h1>Contabilidad</h1><div id='box'>"+skel()+"</div>";
  var res=await Promise.all([
   traerTodo("movimientos_caja","*").catch(function(e){return {error:e}}),
   traerTodo("compras","*, proveedores(nombre,cuit)").catch(function(){return []}),
   traerTodo("pagos_proveedor","movimiento_id").catch(function(){return []}),
   sb.from("impuestos").select("*").order("vencimiento",{ascending:true,nullsFirst:false}).order("creado")
  ]);
  if(res[0]&&res[0].error){document.getElementById("box").innerHTML="<div class='status err'>"+esc(res[0].error.message)+"</div>";return}
  S.conta={movs:res[0],compras:res[1],pagosMov:{},faltaSql:!res[0].some(function(x){return "categoria" in x})&&res[0].length>0};
  res[2].forEach(function(p){if(p.movimiento_id)S.conta.pagosMov[p.movimiento_id]=1});
  S.imps=res[3].error?null:(res[3].data||[]);
  if(res[3].error)S.conta.faltaSql=true;
  pintarContabilidad();
}
function enPeriodo(fecha,g){if(!g)return true;var d=String(fecha).length===10?new Date(fecha+"T12:00:00"):new Date(fecha);return d>=g.desde&&d<g.hasta}
function rangoConta(){return S.contaPer==="todo"?null:rangoPeriodo(S.contaPer)}
function txtPeriodo(){var g=rangoConta();return g?g.txt:"todo el historial"}
// Filas del período: ventas (ingresos de caja), compras (facturas de proveedores + egresos de caja facturados
// que no son pagos a proveedores, para no contar dos veces) y gastos (todos los egresos de caja)
function datosConta(){
  var c=S.conta,g=rangoConta();
  var movs=c.movs.filter(function(x){return enPeriodo(fechaMov(x),g)});
  var ventas=movs.filter(function(x){return x.tipo!=="egreso"}).map(function(x){return {fecha:fechaMov(x),quien:x.concepto,detalle:medioTxt(x.medio_pago),tipo:x.tipo_factura||(x.facturado?"Fact.":""),total:Number(x.monto)||0,iva:Number(x.iva)||0,facturado:!!x.facturado,cat:x.categoria}});
  var compras=c.compras.filter(function(x){return enPeriodo(x.fecha,g)}).map(function(x){return {fecha:x.fecha,quien:x.proveedores?x.proveedores.nombre:"Proveedor",detalle:x.numero||"",tipo:x.tipo_factura||"",total:Number(x.total)||0,iva:Number(x.iva)||0,facturado:true,cat:x.categoria||"repuestos"}});
  movs.forEach(function(x){if(x.tipo==="egreso"&&x.facturado&&!c.pagosMov[x.id])compras.push({fecha:fechaMov(x),quien:x.concepto,detalle:"Caja · "+medioTxt(x.medio_pago),tipo:x.tipo_factura||"Fact.",total:Number(x.monto)||0,iva:Number(x.iva)||0,facturado:true,cat:x.categoria})});
  var orden=function(a,b){return String(b.fecha).localeCompare(String(a.fecha))};ventas.sort(orden);compras.sort(orden);
  var gastos=movs.filter(function(x){return x.tipo==="egreso"});
  return {movs:movs,ventas:ventas,compras:compras,gastos:gastos};
}
function sumar(l,k){return l.reduce(function(a,x){return a+(Number(x[k])||0)},0)}
function soloA(l){return l.filter(function(x){return x.tipo==="A"})}
function gastosPorCategoria(gastos){
  var t={};gastos.forEach(function(x){var k=catDe(x.categoria)[0];t[k]=(t[k]||0)+(Number(x.monto)||0)});
  return CATEGORIAS.concat([SIN_CAT]).filter(function(c){return t[c[0]]>0}).map(function(c){return {key:c[0],nombre:c[1],color:c[2],valor:t[c[0]]}});
}

/* ---------- gráfico de torta (anillo) ---------- */
function tortaHtml(datos,titulo){
  var total=datos.reduce(function(a,d){return a+d.valor},0);
  if(!total)return "<p class='muted' style='margin:0'>No hay egresos en "+esc(titulo)+".</p>";
  var R=80,r=50,cx=90,cy=90,ang=-Math.PI/2,svg="";
  var pt=function(rad,a){return (cx+rad*Math.cos(a)).toFixed(2)+" "+(cy+rad*Math.sin(a)).toFixed(2)};
  datos.forEach(function(d){
   var frac=d.valor/total,a2=ang+frac*2*Math.PI,pct=(frac*100).toLocaleString("es-AR",{maximumFractionDigits:1})+"%";
   var tip="<title>"+esc(d.nombre)+": "+money(d.valor)+" ("+pct+")</title>";
   if(frac>=0.9999)svg+="<g class='tz'><circle cx='"+cx+"' cy='"+cy+"' r='"+((R+r)/2)+"' fill='none' stroke='"+d.color+"' stroke-width='"+(R-r)+"'/>"+tip+"</g>";
   else{var big=a2-ang>Math.PI?1:0;
    svg+="<path class='tz' d='M"+pt(R,ang)+" A"+R+" "+R+" 0 "+big+" 1 "+pt(R,a2)+" L"+pt(r,a2)+" A"+r+" "+r+" 0 "+big+" 0 "+pt(r,ang)+" Z' fill='"+d.color+"' stroke='var(--card)' stroke-width='2' stroke-linejoin='round'>"+tip+"</path>"}
   ang=a2});
  svg+="<text x='"+cx+"' y='"+(cy-4)+"' text-anchor='middle' style='fill:var(--mute);font:600 10px var(--f-mono);letter-spacing:.06em'>EGRESOS</text>"+
   "<text x='"+cx+"' y='"+(cy+14)+"' text-anchor='middle' style='fill:var(--ink);font:700 13px var(--f-mono)'>"+esc(pesos(total))+"</text>";
  return "<div class='torta'><svg viewBox='0 0 180 180' role='img' aria-label='Gráfico de torta de egresos por categoría en "+esc(titulo)+"'>"+svg+"</svg>"+
   "<div class='torta-ley'>"+datos.map(function(d){var pct=(d.valor/total*100).toLocaleString("es-AR",{maximumFractionDigits:1});
    return "<div class='lr' style='gap:8px;padding:5px 0;border-bottom:1px solid var(--line)'><span style='display:flex;align-items:center;gap:8px'><i style='width:12px;height:12px;border-radius:3px;background:"+d.color+";flex:none'></i>"+esc(d.nombre)+"</span>"+
     "<span style='font-family:var(--f-mono);font-size:.85rem;white-space:nowrap'>"+money(d.valor)+" <span class='muted'>"+pct+"%</span></span></div>"}).join("")+"</div></div>";
}
// Tarjeta del Panel principal con la torta de gastos del mes
async function cargarTortaPanel(){
  var box=document.getElementById("tortaBox");if(!box)return;
  var g=rangoPeriodo("mes");
  var r=await sb.from("movimientos_caja").select("monto,categoria,fecha,creado").eq("tipo","egreso").gte("fecha",g.desde.toISOString()).lt("fecha",g.hasta.toISOString());
  if(!document.getElementById("tortaBox"))return;
  if(r.error){box.remove();return}
  box.innerHTML="<div class='lr'><h2 style='margin:0'>Gastos del mes por categoría</h2><button class='btn o' id='irConta' style='padding:6px 12px;min-height:0'>"+ic("chart")+" Contabilidad</button></div><div style='margin-top:10px'>"+tortaHtml(gastosPorCategoria(r.data||[]),"este mes")+"</div>";
  document.getElementById("irConta").onclick=function(){S.vista="contabilidad";route();window.scrollTo(0,0)};
}

/* ---------- pantalla ---------- */
function pintarContabilidad(){
  var box=document.getElementById("box");if(!box)return;
  var tab=S.contaTab,d=datosConta(),h="";
  if(S.conta.faltaSql)h+="<div class='status err'>"+FALTA_SQL_CONTABLE+"</div>";
  h+="<div class='tabs' role='tablist' style='flex-wrap:wrap'>"+[["resumen","Resumen"],["compras","Compras"],["ventas","Ventas"],["iva","IVA"],["impuestos","Impuestos"]].map(function(t){return "<button role='tab' data-ctab='"+t[0]+"' aria-selected='"+(tab===t[0])+"'>"+t[1]+"</button>"}).join("")+"</div>";
  if(tab!=="impuestos")h+="<select id='contaPer' aria-label='Período' style='margin-bottom:12px'>"+PERIODOS_CONTA.map(function(x){return "<option value='"+x[0]+"'"+(x[0]===S.contaPer?" selected":"")+">"+x[1]+"</option>"}).join("")+"</select>";
  if(tab==="resumen")h+=htmlResumenConta(d);
  else if(tab==="compras")h+=htmlListaConta("Compras",d.compras,"Facturas de proveedores y egresos de caja marcados como facturados. Los pagos a proveedores no se suman acá porque ya está su factura.");
  else if(tab==="ventas")h+=htmlListaConta("Ventas",d.ventas,"Todos los ingresos de las cajas y billeteras.");
  else if(tab==="iva")h+=htmlIva(d);
  else h+=htmlImpuestos();
  box.innerHTML=h;
  m.querySelectorAll("[data-ctab]").forEach(function(b){b.onclick=function(){S.contaTab=b.dataset.ctab;pintarContabilidad()}});
  var sp=document.getElementById("contaPer");if(sp)sp.onchange=function(){S.contaPer=this.value;pintarContabilidad()};
  var bp=document.getElementById("pdfCat");if(bp)bp.onclick=function(){pdfCategorias(document.getElementById("pdfCatSel").value,d)};
  var bl=document.getElementById("pdfLista");if(bl)bl.onclick=function(){pdfLista(tab,tab==="compras"?d.compras:d.ventas)};
  var bi=document.getElementById("pdfIva");if(bi)bi.onclick=function(){pdfIva(d)};
  if(tab==="impuestos")conectarImpuestos();
}
function htmlResumenConta(d){
  var tv=sumar(d.ventas,"total"),tc=sumar(d.compras,"total"),tg=sumar(d.gastos,"monto");
  var h="<div class='card'><h2>Gastos por categoría</h2>"+tortaHtml(gastosPorCategoria(d.gastos),txtPeriodo())+"</div>";
  h+="<div class='card'><h2>Compras y ventas</h2>"+
   "<div class='lr'><span class='muted'>Ventas (ingresos)</span><b style='color:var(--ok)'>"+money(tv)+"</b></div>"+
   "<div class='lr'><span class='muted'>Compras facturadas</span><b style='color:var(--bad)'>"+money(tc)+"</b></div>"+
   "<div class='lr' style='font-size:1.15rem;font-weight:700;margin-top:6px'><span>Saldo ventas − compras</span><span style='font-family:var(--f-mono);color:"+(tv-tc<0?"var(--bad)":"var(--ink)")+"'>"+money(tv-tc)+"</span></div>"+
   "<div class='lr' style='margin-top:10px'><span class='muted'>Total de egresos de caja</span><b>"+money(tg)+"</b></div>"+
   "<div class='lr'><span class='muted'>Resultado de caja (ingresos − egresos)</span><b style='color:"+(tv-tg<0?"var(--bad)":"var(--ink)")+"'>"+money(tv-tg)+"</b></div></div>";
  h+="<div class='card'><h2>Reporte en PDF por categoría</h2><p class='muted' style='margin-top:0'>Lista los movimientos de caja de "+esc(txtPeriodo())+" agrupados por categoría, con subtotales.</p>"+
   "<select id='pdfCatSel' aria-label='Categoría del reporte'><option value=''>Todas las categorías</option>"+CATEGORIAS.concat([["sin","Sin categoría"]]).map(function(c){return "<option value='"+c[0]+"'>"+c[1]+"</option>"}).join("")+"</select>"+
   "<div id='pdfSt' class='status hide'></div><div class='btns'><button class='btn' id='pdfCat'>"+ic("download")+" Descargar PDF</button></div></div>";
  return h;
}
function htmlListaConta(titulo,lista,nota){
  var tot=sumar(lista,"total"),a=soloA(lista),ivaA=sumar(a,"iva"),totA=sumar(a,"total"),fac=lista.filter(function(x){return x.facturado});
  var h="<div class='card'><h2>"+titulo+" de "+esc(txtPeriodo())+"</h2><p class='muted' style='margin-top:0;font-size:.9rem'>"+nota+"</p>"+
   "<div class='lr'><span class='muted'>Total</span><b>"+money(tot)+"</b></div>"+
   (titulo==="Ventas"?"<div class='lr'><span class='muted'>Facturadas</span><b>"+money(sumar(fac,"total"))+"</b></div><div class='lr'><span class='muted'>Sin facturar</span><b>"+money(tot-sumar(fac,"total"))+"</b></div>":"")+
   "<div class='lr'><span class='muted'>Facturas A: total</span><b>"+money(totA)+"</b></div>"+
   "<div class='lr'><span class='muted'>Facturas A: neto gravado</span><b>"+money(totA-ivaA)+"</b></div>"+
   "<div class='lr'><span class='muted'>Facturas A: IVA "+(titulo==="Ventas"?"débito fiscal":"crédito fiscal")+"</span><b>"+money(ivaA)+"</b></div>"+
   "<div class='btns'><button class='btn o' id='pdfLista'>"+ic("download")+" PDF de "+titulo.toLowerCase()+"</button></div></div>";
  h+=lista.length?"<div class='card' style='padding:6px 12px;overflow-x:auto'><table class='t'><tr><th>Fecha / detalle</th><th>Fact.</th><th>IVA</th><th>Total</th></tr>"+lista.map(function(x){
    return "<tr><td style='font-family:var(--f-body);font-size:.88rem'>"+esc(x.quien)+"<br><span class='muted' style='font-size:.78rem'>"+fechaAR(String(x.fecha).slice(0,10))+(x.detalle?" · "+esc(x.detalle):"")+"</span></td><td>"+esc(x.tipo||"—")+"</td><td>"+(x.iva?money(x.iva):"—")+"</td><td>"+money(x.total)+"</td></tr>"}).join("")+"</table></div>"
   :vacio("receipt","Sin "+titulo.toLowerCase(),"No hay "+titulo.toLowerCase()+" en este período.");
  return h;
}
function ivaDatos(d){
  var va=soloA(d.ventas),ca=soloA(d.compras);
  return {vTot:sumar(va,"total"),vIva:sumar(va,"iva"),cTot:sumar(ca,"total"),cIva:sumar(ca,"iva"),nV:va.length,nC:ca.length};
}
function htmlIva(d){
  var x=ivaDatos(d),saldo=x.vIva-x.cIva;
  return "<div class='card'><h2>Posición de IVA · "+esc(txtPeriodo())+"</h2><p class='muted' style='margin-top:0;font-size:.9rem'>Solo facturas A (las que discriminan IVA). Cargá el tipo de factura y el IVA en cada movimiento de caja y en cada factura de compra.</p>"+
   "<table class='t'><tr><th></th><th>Facturas</th><th>Neto</th><th>IVA</th><th>Total</th></tr>"+
   "<tr><td style='font-family:var(--f-body)'>Ventas A (débito)</td><td>"+x.nV+"</td><td>"+money(x.vTot-x.vIva)+"</td><td>"+money(x.vIva)+"</td><td>"+money(x.vTot)+"</td></tr>"+
   "<tr><td style='font-family:var(--f-body)'>Compras A (crédito)</td><td>"+x.nC+"</td><td>"+money(x.cTot-x.cIva)+"</td><td>"+money(x.cIva)+"</td><td>"+money(x.cTot)+"</td></tr>"+
   "<tr><td style='font-family:var(--f-body)'><b>Saldo</b></td><td></td><td><b>"+money((x.vTot-x.vIva)-(x.cTot-x.cIva))+"</b></td><td><b>"+money(saldo)+"</b></td><td><b>"+money(x.vTot-x.cTot)+"</b></td></tr></table>"+
   "<div class='lr' style='margin-top:14px;font-size:1.2rem;font-weight:700'><span>"+(saldo>=0?"IVA a pagar":"Saldo técnico a favor")+"</span><span style='font-family:var(--f-mono);color:"+(saldo>0?"var(--bad)":"var(--ok)")+"'>"+money(Math.abs(saldo))+"</span></div>"+
   "<p class='muted' style='font-size:.82rem;margin:8px 0 0'>Es una referencia para controlar con tu contador; no reemplaza la declaración jurada.</p>"+
   "<div class='btns'><button class='btn o' id='pdfIva'>"+ic("download")+" PDF posición de IVA</button></div></div>";
}

/* ---------- planilla de impuestos ---------- */
function estadoImp(x){if(!x.vencimiento)return "";return x.vencimiento>=hoyISO()?"vigente":"vencido"}
function htmlImpuestos(){
  if(!S.imps)return "<div class='card'><h2>Planilla de impuestos</h2><p class='muted' style='margin:0'>"+FALTA_SQL_CONTABLE+"</p></div>";
  var vig=0,ven=0;S.imps.forEach(function(x){var e=estadoImp(x);if(e==="vigente")vig+=Number(x.importe)||0;else if(e==="vencido")ven+=Number(x.importe)||0});
  return "<div class='card'><div class='lr'><h2 style='margin:0'>Planilla de impuestos</h2><button class='btn o' id='impAdd' style='padding:6px 12px;min-height:0'>"+ic("plus")+" Renglón</button></div>"+
   "<p class='muted' style='font-size:.88rem'>Tocá cualquier celda para modificarla; se guarda sola. En <b style='color:var(--ok)'>verde</b> lo vigente y con letras <b style='color:var(--bad)'>rojas</b> lo vencido, según la fecha de vencimiento.</p>"+
   "<div style='overflow-x:auto;margin:0 -4px;position:relative'><table class='t imp'><tr><th>Descripción del impuesto</th><th>Vencimiento</th><th>Importe</th><th>Observaciones</th><th><span class='sr'>Borrar</span></th></tr>"+
   (S.imps.map(function(x){var e=estadoImp(x);
    return "<tr data-imp='"+x.id+"' class='"+e+"'><td><input data-k='descripcion' aria-label='Descripción' value=\""+esc(x.descripcion)+"\" placeholder='IIBB, monotributo, 931…'></td>"+
     "<td><input data-k='vencimiento' type='date' aria-label='Vencimiento' value='"+esc(x.vencimiento||"")+"'><span class='impEst'>"+(e==="vigente"?"Vigente":e==="vencido"?"Vencido":"")+"</span></td>"+
     "<td><input data-k='importe' inputmode='decimal' aria-label='Importe' value=\""+(x.importe!=null?esc(String(x.importe).replace(".",",")):"")+"\"></td>"+
     "<td><input data-k='observaciones' aria-label='Observaciones' value=\""+esc(x.observaciones)+"\"></td>"+
     "<td><button class='btn o icon del' data-imp-del='"+x.id+"' style='padding:4px 8px;min-height:0' aria-label='Borrar renglón' title='Borrar renglón'>"+ic("trash")+"</button></td></tr>"}).join("")||"<tr><td colspan='5' class='muted' style='font-family:var(--f-body);text-align:center;padding:14px'>Todavía no hay impuestos. Tocá <b>Renglón</b> para agregar el primero.</td></tr>")+
   "</table></div>"+
   "<div class='lr' style='margin-top:12px'><span class='muted'>Total vigente</span><b style='color:var(--ok)'>"+money(vig)+"</b></div>"+
   "<div class='lr'><span class='muted'>Total vencido</span><b style='color:var(--bad)'>"+money(ven)+"</b></div>"+
   "<div id='impSt' class='status hide'></div></div>";
}
function conectarImpuestos(){
  var add=document.getElementById("impAdd");
  if(add)add.onclick=async function(){add.disabled=true;
   var r=await sb.from("impuestos").insert({taller_id:S.taller.id,descripcion:""}).select().single();add.disabled=false;
   if(r.error){say("impSt",r.error.message,true);return}
   S.imps.push(r.data);pintarContabilidad();
   var f=m.querySelector("[data-imp='"+r.data.id+"'] input");if(f)f.focus()};
  m.querySelectorAll("[data-imp] input").forEach(function(inp){inp.onchange=async function(){
   var tr=inp.closest("[data-imp]"),x=S.imps.filter(function(y){return y.id===tr.dataset.imp})[0],k=inp.dataset.k,v=inp.value.trim();
   if(k==="importe"){v=v?numAR(v):null;if(v!=null&&isNaN(v)){say("impSt","Revisá el importe.",true);return}}
   else if(!v&&k!=="descripcion")v=null;
   var r=await sb.from("impuestos").update(Object.fromEntries([[k,v]])).eq("id",x.id);
   if(r.error){say("impSt",r.error.message,true);return}
   x[k]=v;
   if(k==="vencimiento"){var e=estadoImp(x);tr.className=e;tr.querySelector(".impEst").textContent=e==="vigente"?"Vigente":e==="vencido"?"Vencido":""}
   if(k==="importe"||k==="vencimiento"){var y=window.scrollY;pintarContabilidad();window.scrollTo(0,y)}}});
  m.querySelectorAll("[data-imp-del]").forEach(function(b){b.onclick=async function(){
   var x=S.imps.filter(function(y){return y.id===b.dataset.impDel})[0];
   if(!confirm("¿Borrar el renglón"+(x&&x.descripcion?" \""+x.descripcion+"\"":"")+"?"))return;
   var r=await sb.from("impuestos").delete().eq("id",b.dataset.impDel);if(r.error){say("impSt",r.error.message,true);return}
   S.imps=S.imps.filter(function(y){return y.id!==b.dataset.impDel});pintarContabilidad()}});
}

/* ---------- PDF ---------- */
function pdfNuevo(titulo){
  if(!window.jspdf){alert("No se pudo cargar el generador de PDF. Revisá la conexión.");return null}
  var doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
  doc.setFillColor(17,17,17);doc.rect(0,0,210,28,"F");doc.setFillColor(255,106,19);doc.rect(0,28,210,1.2,"F");
  doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(15);doc.text(String(S.taller.nombre||"").toUpperCase(),14,13);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(200,200,195);doc.text(titulo,14,21);
  doc.text("Período: "+txtPeriodo()+" · Emitido "+new Date().toLocaleDateString("es-AR"),196,21,{align:"right"});
  return {doc:doc,y:38};
}
// cols: [[título, ancho, "r" si va a la derecha]]
function pdfTabla(p,cols,filas,opt){
  var doc=p.doc,x0=14;opt=opt||{};
  var cab=function(){doc.setFillColor(244,244,242);doc.rect(x0,p.y-4.5,182,6.5,"F");doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(90,90,85);
   var x=x0+1.5;cols.forEach(function(c){doc.text(c[0],c[2]?x+c[1]-3:x,p.y,c[2]?{align:"right"}:undefined);x+=c[1]});p.y+=6};
  cab();doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(17,17,17);
  filas.forEach(function(f){
   var lineas=cols.map(function(c,i){return doc.splitTextToSize(String(f[i]==null?"":f[i]),c[1]-3)}),alto=Math.max.apply(null,lineas.map(function(l){return l.length}))*3.8+1.8;
   if(p.y+alto>285){doc.addPage();p.y=18;cab();doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(17,17,17)}
   var x=x0+1.5;lineas.forEach(function(l,i){var c=cols[i];doc.text(l,c[2]?x+c[1]-3:x,p.y,c[2]?{align:"right"}:undefined);x+=c[1]});
   p.y+=alto-1.8;doc.setDrawColor(225,225,220);doc.line(x0,p.y-2.4,x0+182,p.y-2.4);p.y+=1.8});
  if(opt.total){doc.setFont("helvetica","bold");var x=x0+1.5;opt.total.forEach(function(v,i){var c=cols[i];if(v!=null&&v!=="")doc.text(String(v),c[2]?x+c[1]-3:x,p.y,c[2]?{align:"right"}:undefined);x+=c[1]});p.y+=7;doc.setFont("helvetica","normal")}
  p.y+=3;
}
function pdfTitulo(p,txt,color){
  if(p.y>265){p.doc.addPage();p.y=18}
  var doc=p.doc;if(color){var c=color.match(/\w\w/g).map(function(h){return parseInt(h,16)});doc.setFillColor(c[0],c[1],c[2]);doc.roundedRect(14,p.y-3.6,4,4,0.8,0.8,"F")}
  doc.setFont("helvetica","bold");doc.setFontSize(11.5);doc.setTextColor(17,17,17);doc.text(txt,color?20:14,p.y);p.y+=6;
}
function pdfGuardar(p,nombre){p.doc.save(nombre+"-"+(S.contaPer||"mes")+"-"+hoyISO()+".pdf")}
function pdfCategorias(sel,d){
  var p=pdfNuevo(sel?"Reporte de la categoría "+(sel==="sin"?"Sin categoría":catDe(sel)[1]):"Reporte por categorías");if(!p)return;
  var grupos=CATEGORIAS.concat([["sin","Sin categoría","#5c5c58"]]).filter(function(c){return !sel||c[0]===sel}),resumen=[];
  grupos.forEach(function(c){
   var l=d.movs.filter(function(x){return (x.categoria||"sin")===c[0]});if(!l.length)return;
   var ing=l.reduce(function(a,x){return a+(x.tipo==="egreso"?0:Number(x.monto)||0)},0),egr=l.reduce(function(a,x){return a+(x.tipo==="egreso"?Number(x.monto)||0:0)},0);
   resumen.push([c[1],money(ing),money(egr),money(ing-egr)]);
   pdfTitulo(p,c[1],c[2]);
   pdfTabla(p,[["Fecha",22],["Concepto",80],["Medio",30],["Ingreso",25,"r"],["Egreso",25,"r"]],
    l.slice().sort(function(a,b){return String(fechaMov(a)).localeCompare(String(fechaMov(b)))}).map(function(x){return [new Date(fechaMov(x)).toLocaleDateString("es-AR"),x.concepto+(x.tipo_factura?" (Fact. "+x.tipo_factura+")":""),medioTxt(x.medio_pago),x.tipo==="egreso"?"":money(x.monto),x.tipo==="egreso"?money(x.monto):""]}),
    {total:["","Subtotal "+c[1],"",money(ing),money(egr)]});
  });
  if(!resumen.length){p.doc.setFontSize(10);p.doc.text("No hay movimientos en este período.",14,p.y)}
  else if(!sel){pdfTitulo(p,"Resumen por categoría");pdfTabla(p,[["Categoría",87],["Ingresos",32,"r"],["Egresos",32,"r"],["Saldo",31,"r"]],resumen)}
  pdfGuardar(p,"reporte-categorias");
}
function pdfLista(tab,lista){
  var titulo=tab==="compras"?"Reporte de compras":"Reporte de ventas",p=pdfNuevo(titulo);if(!p)return;
  var a=soloA(lista);
  pdfTabla(p,[["Fecha",20],["Detalle",80],["Fact.",14],["IVA",32,"r"],["Total",36,"r"]],
   lista.map(function(x){return [fechaAR(String(x.fecha).slice(0,10)),x.quien+(x.detalle?" · "+x.detalle:"")+(x.cat?" · "+catDe(x.cat)[1]:""),x.tipo||"-",x.iva?money(x.iva):"",money(x.total)]}),
   {total:["","Total ("+lista.length+")","",money(sumar(lista,"iva")),money(sumar(lista,"total"))]});
  pdfTabla(p,[["Facturas A",86],["Neto",32,"r"],["IVA",32,"r"],["Total",32,"r"]],[[a.length+" comprobantes",money(sumar(a,"total")-sumar(a,"iva")),money(sumar(a,"iva")),money(sumar(a,"total"))]]);
  pdfGuardar(p,tab);
}
function pdfIva(d){
  var p=pdfNuevo("Posición de IVA (facturas A)");if(!p)return;var x=ivaDatos(d),saldo=x.vIva-x.cIva;
  pdfTabla(p,[["Concepto",62],["Facturas",20,"r"],["Neto",34,"r"],["IVA",32,"r"],["Total",34,"r"]],[
   ["Ventas A (débito fiscal)",x.nV,money(x.vTot-x.vIva),money(x.vIva),money(x.vTot)],
   ["Compras A (crédito fiscal)",x.nC,money(x.cTot-x.cIva),money(x.cIva),money(x.cTot)]],
   {total:["Saldo","",money((x.vTot-x.vIva)-(x.cTot-x.cIva)),money(saldo),money(x.vTot-x.cTot)]});
  p.doc.setFont("helvetica","bold");p.doc.setFontSize(12);p.doc.text((saldo>=0?"IVA a pagar: ":"Saldo técnico a favor: ")+money(Math.abs(saldo)),14,p.y+2);
  p.doc.setFont("helvetica","normal");p.doc.setFontSize(8);p.doc.setTextColor(110,110,105);p.doc.text("Referencia para controlar con el contador; no reemplaza la declaración jurada.",14,p.y+8);
  pdfGuardar(p,"posicion-iva");
}
