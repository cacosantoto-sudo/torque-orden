// Tres cajas de dinero: ingresos, egresos y saldo de cada una, discriminado por medio de pago.
var MEDIOS=[["efectivo","Efectivo"],["transferencia","Transferencia bancaria"],["cheque","Cheque"],["tarjeta","Tarjeta de crédito"]];
// Bancos y billeteras más comunes (se puede escribir cualquier otro)
var BANCOS=["Mercado Pago","Ualá","Naranja X","Brubank","Personal Pay","Cuenta DNI","MODO","Lemon","Prex","Banco Nación","Banco Provincia","Banco Ciudad","Banco Galicia","Banco Santander","BBVA","Banco Macro","ICBC","Banco Credicoop","Banco Patagonia","Banco Supervielle","HSBC","Banco Hipotecario","Banco Comafi","Banco Itaú","Banco Industrial","Banco Columbia","Banco del Sol","Banco de Córdoba","Banco Santa Fe","Banco Entre Ríos","Banco San Juan","Banco Nación (BNA+)"];
function usaBanco(medio){return medio==="transferencia"||medio==="tarjeta"}
function medioTxt(v){var x=MEDIOS.filter(function(m){return m[0]===v})[0];return x?x[1]:"Efectivo"}
function ahoraLocal(){var d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function fechaMov(x){return x.fecha||x.creado}
// Importe escrito a la argentina: "1.500,50", "1500,5", "1.500" o "1500.5"
function numAR(v){v=String(v==null?"":v).trim().replace(/[\s$]/g,"");if(v.indexOf(",")>=0)v=v.replace(/\./g,"").replace(",",".");else if(/^\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,"");return Number(v)}

async function renderCaja(){
  m.innerHTML="<h1>Cajas</h1><div id='box'>"+skel()+"</div>";
  var rc=await sb.from("cajas").select("*").order("orden");
  if(!rc.error&&!(rc.data||[]).length){
   await sb.from("cajas").insert([1,2,3].map(function(n){return {taller_id:S.taller.id,nombre:"Caja "+n,orden:n}}));
   rc=await sb.from("cajas").select("*").order("orden");
  }
  S.cajas=rc.error?null:(rc.data||[]);
  try{S.movs=await traerTodo("movimientos_caja","*, ordenes(numero)")}catch(e){document.getElementById("box").innerHTML=esc(e.message);return}
  S.movs.sort(function(a,b){return String(fechaMov(b)).localeCompare(String(fechaMov(a)))});
  if(S.cajas&&S.cajas.length&&!S.cajas.some(function(c){return c.id===S.cajaSel})&&S.cajaSel!=="todas")S.cajaSel=S.cajas[0].id;
  pintarCaja();
}
function saldosPorMedio(movs){
  var r={};MEDIOS.forEach(function(md){r[md[0]]={ing:0,egr:0}});
  movs.forEach(function(x){var k=r[x.medio_pago]?x.medio_pago:"efectivo";r[k][x.tipo==="egreso"?"egr":"ing"]+=Number(x.monto)||0});
  return r;
}
function pintarCaja(){
  var box=document.getElementById("box");if(!box)return;
  var cajas=S.cajas,sel=S.cajaSel||"todas",h="";
  if(!cajas){h+="<div class='status err'>Falta correr el SQL nuevo en Supabase (sql/2026-10-06_5_cajas.sql) para usar las 3 cajas y los medios de pago.</div>"}
  else h+="<div class='tabs' role='tablist' style='flex-wrap:wrap'>"+cajas.map(function(c){return "<button role='tab' data-caja='"+c.id+"' aria-selected='"+(sel===c.id)+"'>"+esc(c.nombre)+"</button>"}).join("")+"<button role='tab' data-caja='todas' aria-selected='"+(sel==="todas")+"'>Todas</button></div>";
  var movsCaja=S.movs.filter(function(x){return sel==="todas"||!cajas||x.caja_id===sel});
  var sm=saldosPorMedio(movsCaja),ing=0,egr=0;MEDIOS.forEach(function(md){ing+=sm[md[0]].ing;egr+=sm[md[0]].egr});
  var cajaObj=cajas&&cajas.filter(function(c){return c.id===sel})[0];
  // resumen
  h+="<div class='card'><div class='lr'><h2 style='margin:0'>"+(cajaObj?esc(cajaObj.nombre):"Todas las cajas")+"</h2>"+(cajaObj?"<button class='btn o' id='renCaja' style='padding:6px 12px;min-height:0'>"+ic("pencil")+" Nombre</button>":"")+"</div>"+
   "<div class='lr' style='margin-top:10px;font-size:1.35rem;font-weight:700'><span>Saldo</span><span style='font-family:var(--f-mono);color:"+(ing-egr<0?"var(--bad)":"var(--ink)")+"'>"+money(ing-egr)+"</span></div>"+
   "<div class='lr'><span class='muted'>Ingresos</span><b style='color:var(--ok)'>"+money(ing)+"</b></div><div class='lr'><span class='muted'>Egresos</span><b style='color:var(--bad)'>"+money(egr)+"</b></div>"+
   "<table class='t' style='margin-top:12px'><tr><th>Medio de pago</th><th>Ingresos</th><th>Egresos</th><th>Saldo</th></tr>"+MEDIOS.map(function(md){var v=sm[md[0]];
    return "<tr><td style='font-family:var(--f-body)'>"+md[1]+"</td><td>"+money(v.ing)+"</td><td>"+money(v.egr)+"</td><td><b>"+money(v.ing-v.egr)+"</b></td></tr>"}).join("")+"</table>";
  var porBanco={},fac={si:0,no:0},hayCol=movsCaja.some(function(x){return "facturado" in x});
  movsCaja.forEach(function(x){if(x.tipo==="egreso")return;var v=Number(x.monto)||0;
   if(x.medio_pago==="transferencia"){var b=x.banco||"Sin indicar";porBanco[b]=(porBanco[b]||0)+v}
   fac[x.facturado?"si":"no"]+=v});
  var bks=Object.keys(porBanco).sort(function(a,b){return porBanco[b]-porBanco[a]});
  if(bks.length)h+="<table class='t' style='margin-top:12px'><tr><th>Transferencias recibidas de</th><th>Importe</th></tr>"+bks.map(function(b){return "<tr><td style='font-family:var(--f-body)'>"+esc(b)+"</td><td>"+money(porBanco[b])+"</td></tr>"}).join("")+"</table>";
  if(hayCol)h+="<div class='lr' style='margin-top:12px'><span class='muted'>Ingresos facturados</span><b>"+money(fac.si)+"</b></div><div class='lr'><span class='muted'>Ingresos sin facturar</span><b style='color:"+(fac.no?"var(--br)":"var(--ink)")+"'>"+money(fac.no)+"</b></div>";
  if(sel==="todas"&&cajas&&cajas.length)h+="<div class='tiles' style='margin:12px 0 0'>"+cajas.map(function(c){var ms=S.movs.filter(function(x){return x.caja_id===c.id}),s=ms.reduce(function(a,x){return a+(x.tipo==="egreso"?-1:1)*(Number(x.monto)||0)},0);
    return "<div class='tile' style='background:var(--card2)'><span>"+esc(c.nombre)+"</span><b>"+money(s)+"</b></div>"}).join("")+"</div>";
  h+="</div>";
  // nuevo movimiento
  h+="<div class='card'><h2>Nuevo movimiento</h2>"+
   (cajas?"<label for='mcaja'>Caja</label><select id='mcaja'>"+cajas.map(function(c){return "<option value='"+c.id+"'"+(c.id===(cajaObj?cajaObj.id:cajas[0].id)?" selected":"")+">"+esc(c.nombre)+"</option>"}).join("")+"</select>":"")+
   "<div class='g2'><div><label for='mtipo'>Tipo</label><select id='mtipo'><option value='ingreso'>Ingreso</option><option value='egreso'>Egreso</option></select></div>"+
   (cajas?"<div><label for='mmedio'>Medio de pago</label><select id='mmedio'>"+MEDIOS.map(function(md){return "<option value='"+md[0]+"'>"+md[1]+"</option>"}).join("")+"</select></div>":"<div></div>")+"</div>"+
   (cajas?"<div id='mbancoBox' class='hide'><label for='mbanco'>Banco o billetera de la transferencia</label><input id='mbanco' list='bancosLista' placeholder='Mercado Pago, Galicia, Ualá…' autocomplete='off'><datalist id='bancosLista'>"+BANCOS.map(function(b){return "<option value=\""+esc(b)+"\">"}).join("")+"</datalist></div>"+
    "<label class='lr' style='justify-content:flex-start;gap:10px;margin-top:14px;text-transform:none;letter-spacing:0;font-family:var(--f-body);font-size:1rem;color:var(--ink)'><input type='checkbox' id='mfact' style='width:24px;min-height:24px'> <span><b>Facturado</b><br><span class='muted' style='font-size:.88rem'>Marcalo si emitiste (o te dieron) factura por este movimiento</span></span></label>":"")+
   (cajas?"<label for='mfecha'>Fecha y hora</label><input id='mfecha' type='datetime-local' value='"+ahoraLocal()+"'>":"")+
   "<label for='mconcepto'>Concepto / descripción</label><input id='mconcepto' placeholder='Pago OT 000123, compra de repuestos, etc.'>"+
   "<label for='mmonto'>Importe</label><input id='mmonto' inputmode='decimal'>"+
   "<div id='stc' class='status hide'></div>"+
   "<div class='btns'><button class='btn' id='magregar'>Registrar</button></div></div>";
  // movimientos
  var per=S.cajaPer||"mes",fm=S.cajaMedio||"",ff=S.cajaFact||"";
  h+="<h2 style='margin-top:20px'>Movimientos</h2><div class='g2' style='margin-bottom:12px'><select id='mper' aria-label='Período'>"+[["mes","Este mes"],["mesant","Mes pasado"],["3m","Últimos 3 meses"],["anio","Este año"],["todo","Todo"]].map(function(x){return "<option value='"+x[0]+"'"+(x[0]===per?" selected":"")+">"+x[1]+"</option>"}).join("")+"</select>"+
   "<select id='mfmedio' aria-label='Medio de pago'><option value=''>Todos los medios</option>"+MEDIOS.map(function(md){return "<option value='"+md[0]+"'"+(md[0]===fm?" selected":"")+">"+md[1]+"</option>"}).join("")+"</select>"+
   "<select id='mffact' aria-label='Facturado' style='grid-column:1/-1'><option value=''>Facturado y sin facturar</option><option value='si'"+(ff==="si"?" selected":"")+">Solo facturados</option><option value='no'"+(ff==="no"?" selected":"")+">Solo sin facturar</option></select></div>";
  var g=per==="todo"?null:rangoPeriodo(per);
  var lista=movsCaja.filter(function(x){var d=new Date(fechaMov(x));return (!g||(d>=g.desde&&d<g.hasta))&&(!fm||(x.medio_pago||"efectivo")===fm)&&(!ff||(x.facturado?"si":"no")===ff)});
  var pi=lista.reduce(function(a,x){return a+(x.tipo==="egreso"?0:Number(x.monto)||0)},0),pe=lista.reduce(function(a,x){return a+(x.tipo==="egreso"?Number(x.monto)||0:0)},0);
  if(lista.length)h+="<p class='muted' style='margin:0 0 10px'>"+lista.length+" movimientos · ingresos "+money(pi)+" · egresos "+money(pe)+"</p>";
  var nomCaja={};(cajas||[]).forEach(function(c){nomCaja[c.id]=c.nombre});
  h+=lista.map(function(x){
   return "<div class='card' style='padding:10px 16px'><div class='lr'><span>"+esc(x.concepto)+(x.ordenes&&x.ordenes.numero?" · OT "+String(x.ordenes.numero).padStart(6,"0"):"")+"<br><span class='muted' style='font-size:.85rem'>"+new Date(fechaMov(x)).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})+"</span>"+
    "<br><span class='tag' style='margin-top:4px;display:inline-block'>"+medioTxt(x.medio_pago)+"</span>"+
    (usaBanco(x.medio_pago)&&"banco" in x?" <button class='tag' data-banco='"+x.id+"' style='display:inline-block;cursor:pointer' title='Cambiar banco o billetera'>"+(x.banco?esc(x.banco):"¿Qué banco?")+"</button>":"")+
    ("facturado" in x?" <button class='tag "+(x.facturado?"g":"w")+"' data-fact='"+x.id+"' style='display:inline-block;cursor:pointer' title='Tocá para cambiar'>"+(x.facturado?"Facturado":"Sin facturar")+"</button>":"")+(sel==="todas"&&nomCaja[x.caja_id]?" <span class='tag' style='display:inline-block'>"+esc(nomCaja[x.caja_id])+"</span>":"")+"</span>"+
    "<span class='lr' style='gap:10px'><b style='color:"+(x.tipo==="ingreso"?"var(--ok)":"var(--bad)")+";white-space:nowrap'>"+(x.tipo==="ingreso"?"+":"−")+money(x.monto)+"</b><button class='btn o icon del' data-del-mov='"+x.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar' title='Eliminar'>"+ic("trash")+"</button></span></div></div>"
  }).join("")||vacio("wallet","No hay movimientos","No hay movimientos en este período"+(fm?" con ese medio de pago":"")+".");
  box.innerHTML=h;
  m.querySelectorAll("[data-caja]").forEach(function(b){b.onclick=function(){S.cajaSel=b.dataset.caja;pintarCaja()}});
  document.getElementById("mper").onchange=function(){S.cajaPer=this.value;pintarCaja()};
  document.getElementById("mfmedio").onchange=function(){S.cajaMedio=this.value;pintarCaja()};
  document.getElementById("mffact").onchange=function(){S.cajaFact=this.value;pintarCaja()};
  document.getElementById("magregar").onclick=agregarMovimiento;
  var mm=document.getElementById("mmedio");if(mm){mm.onchange=function(){document.getElementById("mbancoBox").classList.toggle("hide",!usaBanco(mm.value))};mm.onchange()}
  m.querySelectorAll("[data-fact]").forEach(function(b){b.onclick=async function(){
   var x=S.movs.filter(function(y){return y.id===b.dataset.fact})[0];if(!x)return;
   b.disabled=true;var r=await sb.from("movimientos_caja").update({facturado:!x.facturado}).eq("id",x.id);b.disabled=false;
   if(r.error){alert(r.error.message);return}x.facturado=!x.facturado;pintarCaja()}});
  m.querySelectorAll("[data-banco]").forEach(function(b){b.onclick=async function(){
   var x=S.movs.filter(function(y){return y.id===b.dataset.banco})[0];if(!x)return;
   var n=prompt("¿De qué banco o billetera es la transferencia? (Mercado Pago, Galicia, Ualá…)",x.banco||"");if(n==null)return;
   var r=await sb.from("movimientos_caja").update({banco:n.trim()||null}).eq("id",x.id);
   if(r.error){alert(r.error.message);return}x.banco=n.trim()||null;pintarCaja()}});
  var rn=document.getElementById("renCaja");if(rn)rn.onclick=async function(){
   var n=prompt("Nombre de la caja:",cajaObj.nombre);if(!n||!n.trim())return;
   var r=await sb.from("cajas").update({nombre:n.trim()}).eq("id",cajaObj.id);if(r.error){alert(r.error.message);return}
   cajaObj.nombre=n.trim();pintarCaja()};
  m.querySelectorAll("[data-del-mov]").forEach(function(b){b.onclick=function(){eliminarMovimiento(b.dataset.delMov)}});
}
function eliminarMovimiento(id){
  borrarConDeshacer("Movimiento eliminado",tarjetaDe("[data-del-mov='"+id+"']"),function(){return sb.from("movimientos_caja").delete().eq("id",id)},renderCaja);
}
async function agregarMovimiento(){
  var concepto=document.getElementById("mconcepto").value.trim();
  var monto=numAR(document.getElementById("mmonto").value);
  if(!concepto||!(monto>0)){say("stc","Completá el concepto y un importe mayor a 0.",true);return}
  var data={taller_id:S.taller.id,tipo:document.getElementById("mtipo").value,concepto:concepto,monto:monto};
  var cj=document.getElementById("mcaja");
  if(cj){var f=document.getElementById("mfecha").value;Object.assign(data,{caja_id:cj.value,medio_pago:document.getElementById("mmedio").value,fecha:f?new Date(f).toISOString():new Date().toISOString()});
   var bn=document.getElementById("mbanco").value.trim();if(usaBanco(data.medio_pago)&&bn)data.banco=bn;
   if(document.getElementById("mfact").checked)data.facturado=true}
  var btn=document.getElementById("magregar");btn.disabled=true;
  var r=await sb.from("movimientos_caja").insert(data);
  if(r.error&&/banco|facturado/.test(r.error.message)){btn.disabled=false;say("stc","Para guardar el banco y si está facturado falta correr el SQL nuevo en Supabase (sql/2026-10-08_modificaciones.sql).",true);return}
  btn.disabled=false;
  if(r.error){say("stc",r.error.message,true);return}
  if(cj&&S.cajaSel!=="todas")S.cajaSel=cj.value;
  renderCaja();
}
