// Órdenes y presupuestos: sector del taller, facturado sí/no, PDF de la factura electrónica,
// estados del presupuesto y lista de presupuestos con repuestos / mano de obra / total.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.presupuestos=renderPresupuestos;GRUPOS.presupuestos="ordenes";

var SECTORES=["Servicio","Mecánica liviana","Mecánica pesada","Neumáticos – Alineación","Neumáticos – Balanceo","Neumáticos – Montaje","Lavado"];
var ESTADOS_PRESU=["Pendiente","Aprobado","Parcialmente aprobado","Rechazado","Realizado"];
function clsEstadoPresu(e){return {"Aprobado":"g","Realizado":"g","Parcialmente aprobado":"w","Rechazado":"bad"}[e]||""}
function estadoPresu(p){return p?(p.estado||(p.aprobado?"Aprobado":"Pendiente")):""}
// PostgREST devuelve el presupuesto de la orden como objeto o como lista según el esquema
function presuDe(o){var p=o&&o.presupuestos;return Array.isArray(p)?p[0]||null:p||null}
function itemsReales(items){return (items||[]).filter(function(it){return it&&it.tipo!=="meta"&&(String(it.descripcion||"").trim()||Number(it.precio))})}
function metaDe(items){return (items||[]).filter(function(it){return it&&it.tipo==="meta"})[0]||{}}
function subtotalesPresu(p){
  var its=itemsReales(p&&p.items),meta=metaDe(p&&p.items),r=0,mo=0;
  its.forEach(function(it){var s=(Number(it.cantidad)||0)*(Number(it.precio)||0);if(it.tipo==="mano")mo+=s;else r+=s});
  if(meta.materiales_cliente)r=0;
  return {repuestos:r,mano:mo,total:Number(p&&p.total)||r+mo,items:its};
}
function tabsOrdenes(activa){
  return "<div class='tabs' role='tablist'><button role='tab' data-tab='ordenes' aria-selected='"+(activa==="ordenes")+"'>"+ic("clipboard")+" Órdenes</button>"+
   "<button role='tab' data-tab='presupuestos' aria-selected='"+(activa==="presupuestos")+"'>"+ic("receipt")+" Presupuestos</button></div>"}
function sectorTag(s){return s?"<span class='tag' style='border-color:rgba(255,106,19,.45);color:var(--ac2)'>"+esc(s)+"</span>":""}
function facturadoTag(o){return o.facturado?"<span class='tag g'>Facturado</span>":(o.estado==="Listo"||o.estado==="Entregado")?"<span class='tag w'>Sin facturar</span>":""}

/* ---------- lista de presupuestos ---------- */
async function renderPresupuestos(){
  m.innerHTML="<h1>Presupuestos</h1>"+tabsOrdenes("presupuestos")+"<div id='box'>"+skel()+"</div>";
  conectarTabs();
  var r=await sb.from("presupuestos").select("*,ordenes(id,numero,creado,estado,trabajos,diagnostico,motivo,clientes(nombre),equipos(nombre,marca,modelo,matricula_patente))").order("creado",{ascending:false});
  if(r.error){document.getElementById("box").innerHTML=esc(r.error.message);return}
  var lista=(r.data||[]).filter(function(p){return p.ordenes});
  var h=buscadorHtml("Buscar por N°, cliente, "+equipoLabel().toLowerCase()+" o trabajo",S.qPresu)+
   "<select id='fpresu' aria-label='Filtrar por estado' style='margin-bottom:12px'><option value=''>Todos los estados</option>"+ESTADOS_PRESU.map(function(e){return "<option"+(e===S.fPresu?" selected":"")+">"+e+"</option>"}).join("")+"</select>";
  var tot={};
  h+=lista.map(function(p){
   var o=p.ordenes,st=subtotalesPresu(p),est=estadoPresu(p),eq=o.equipos,meta=metaDe(p.items);
   tot[est]=(tot[est]||0)+st.total;
   var trabajos=st.items.filter(function(it){return it.tipo==="mano"}).map(function(it){return it.descripcion}).filter(Boolean);
   if(!trabajos.length&&meta.trabajo)trabajos=[meta.trabajo];
   if(!trabajos.length)trabajos=[String(o.trabajos||o.diagnostico||o.motivo||"").slice(0,90)].filter(Boolean);
   var q=norm(["OT "+String(o.numero).padStart(6,"0"),o.numero,o.clientes&&o.clientes.nombre,eq&&vehTitulo(eq),eq&&eq.matricula_patente,eq&&normPatente(eq.matricula_patente)].concat(st.items.map(function(it){return it.descripcion})).join(" "));
   return "<div class='card' data-q=\""+esc(q)+"\" data-estado=\""+esc(est)+"\"><button class='item' data-presu-o='"+o.id+"'><span><b>N° "+String(o.numero).padStart(6,"0")+"</b> · "+fechaAR(p.creado||o.creado)+"<br>"+
    "<span>"+esc(o.clientes?o.clientes.nombre:"Sin cliente")+"</span>"+(eq?" · <span class='muted'>"+esc(vehTitulo(eq))+(eq.matricula_patente?" "+esc(eq.matricula_patente):"")+"</span>":"")+"</span><span class='tag "+clsEstadoPresu(est)+"'>"+esc(est)+"</span></button>"+
    (trabajos.length?"<div class='muted' style='margin-top:6px;font-size:.92rem'>"+esc(trabajos.join(" · "))+"</div>":"")+
    "<div class='g3' style='margin-top:8px;font-size:.88rem'><div><span class='muted'>Repuestos</span><br><b>"+plata(st.repuestos)+"</b></div><div><span class='muted'>Mano de obra</span><br><b>"+plata(st.mano)+"</b></div><div><span class='muted'>Total</span><br><b style='color:var(--ac)'>"+plata(st.total)+"</b></div></div></div>"}).join("")||vacio("receipt","Todavía no hay presupuestos","Se arman desde cada orden con el botón Presupuesto.");
  h+="<p id='sinres' class='muted hide'>No hay presupuestos que coincidan.</p>";
  var resumen=ESTADOS_PRESU.filter(function(e){return tot[e]}).map(function(e){return "<div class='tile'><span>"+e+"</span><b>"+pesos(tot[e])+"</b></div>"}).join("");
  if(resumen)h="<div class='tiles'>"+resumen+"</div>"+h;
  document.getElementById("box").outerHTML=h;
  var bp=document.getElementById("buscar"),fp=document.getElementById("fpresu");
  function aplicar(){S.qPresu=bp.value;S.fPresu=fp.value;filtrarLista(bp.value,fp.value?function(el){return el.dataset.estado===fp.value}:null)}
  bp.oninput=aplicar;fp.onchange=aplicar;aplicar();
  m.querySelectorAll("[data-presu-o]").forEach(function(b){b.onclick=function(){S.volverPresu="presupuestos";abrirPresupuesto(b.dataset.presuO)}});
}

/* ---------- sector, facturación y factura en la orden ---------- */
function ordenExtrasHtml(o){
  var h="<div class='card'><h2>Taller y facturación</h2>"+
   "<label for='f_sector'>Sector donde está el "+equipoLabel().toLowerCase()+"</label><select id='f_sector'><option value=''>— sin asignar —</option>"+SECTORES.map(function(s){return "<option"+(o.sector===s?" selected":"")+">"+s+"</option>"}).join("")+
   (o.sector&&SECTORES.indexOf(o.sector)<0?"<option selected>"+esc(o.sector)+"</option>":"")+"</select>"+
   "<label class='lr' style='justify-content:flex-start;gap:10px;margin-top:16px;text-transform:none;letter-spacing:0;font-family:var(--f-body);font-size:1rem;color:var(--ink)'><input type='checkbox' id='f_facturado'"+(o.facturado?" checked":"")+" style='width:24px;min-height:24px'> <span><b>Facturado</b><br><span class='muted' style='font-size:.88rem'>Marcalo cuando emitiste el comprobante</span></span></label>"+
   "<label for='f_factura_numero'>N° de factura (opcional)</label><input id='f_factura_numero' value=\""+esc(o.factura_numero||"")+"\" placeholder='0001-00001234'>"+
   "<div id='facBox' style='margin-top:14px'>"+(o.id?"":"<p class='muted' style='margin:0'>Guardá la orden para adjuntar el PDF de la factura.</p>")+"</div></div>";
  return h;
}
function datosExtrasOrden(){
  var d={},s=document.getElementById("f_sector");if(!s)return d;
  d.sector=s.value||null;d.facturado=document.getElementById("f_facturado").checked;d.factura_numero=document.getElementById("f_factura_numero").value.trim()||null;
  return d;
}
function pintarFactura(o){
  var box=document.getElementById("facBox");if(!box||!o.id)return;
  if(o.factura_ruta){
   box.innerHTML="<div class='lr' style='flex-wrap:wrap'><span>"+ic("receipt")+" <b>"+esc(o.factura_nombre||"Factura.pdf")+"</b>"+(o.factura_fecha?"<br><span class='muted' style='font-size:.85rem'>Subida el "+fechaAR(o.factura_fecha)+"</span>":"")+"</span></div>"+
    "<div class='btns' style='margin-top:8px'><button class='btn o' id='facVer' style='padding:6px 12px;min-height:0'>Ver</button><button class='btn o' id='facBajar' style='padding:6px 12px;min-height:0'>"+ic("download")+" Descargar</button><button class='btn o' id='facCambiar' style='padding:6px 12px;min-height:0'>Reemplazar</button><button class='btn d' id='facQuitar' style='padding:6px 12px;min-height:0'>Quitar</button></div>"+
    "<input type='file' id='facFile' accept='application/pdf,image/*' class='hide'><div id='facSt' class='status hide'></div>";
   document.getElementById("facVer").onclick=function(){abrirDocumento(o.factura_ruta)};
   document.getElementById("facBajar").onclick=function(){abrirDocumento(o.factura_ruta,o.factura_nombre||"factura.pdf")};
   document.getElementById("facCambiar").onclick=function(){document.getElementById("facFile").click()};
   document.getElementById("facQuitar").onclick=async function(){
    if(!confirm("¿Quitar el PDF de la factura de esta orden?"))return;
    var r=await sb.from("ordenes").update({factura_ruta:null,factura_nombre:null,factura_fecha:null}).eq("id",o.id);
    if(r.error){say("facSt",r.error.message,true);return}
    sb.storage.from("documentos").remove([o.factura_ruta]);o.factura_ruta=null;pintarFactura(o)};
  }else{
   box.innerHTML="<button class='btn o' id='facCambiar' style='width:100%'>"+ic("receipt")+" Adjuntar PDF de la factura electrónica</button><input type='file' id='facFile' accept='application/pdf,image/*' class='hide'><div id='facSt' class='status hide'></div>";
   document.getElementById("facCambiar").onclick=function(){document.getElementById("facFile").click()};
  }
  document.getElementById("facFile").onchange=async function(e){var f=e.target.files[0];e.target.value="";if(f)await subirFactura(o,f)};
}
function nombreSeguro(n){return norm(n).replace(/[^a-z0-9.]+/g,"-").replace(/^-+|-+$/g,"").slice(-60)||"archivo"}
async function subirFactura(o,f){
  if(f.size>10*1024*1024){say("facSt","El archivo pesa más de 10 MB.",true);return}
  say("facSt","Subiendo la factura…");
  var ruta=S.taller.id+"/facturas/"+o.id+"/"+Date.now()+"_"+nombreSeguro(f.name);
  var up=await sb.storage.from("documentos").upload(ruta,f,{contentType:f.type||"application/pdf"});
  if(up.error){say("facSt",/bucket/i.test(up.error.message)?"Falta correr el SQL nuevo en Supabase (crea la carpeta de documentos).":"No se pudo subir: "+up.error.message,true);return}
  var datos={factura_ruta:ruta,factura_nombre:f.name,factura_fecha:new Date().toISOString(),facturado:true};
  var r=await sb.from("ordenes").update(datos).eq("id",o.id);
  if(r.error){say("facSt",r.error.message,true);return}
  if(o.factura_ruta)sb.storage.from("documentos").remove([o.factura_ruta]);
  Object.assign(o,datos);var cb=document.getElementById("f_facturado");if(cb)cb.checked=true;
  pintarFactura(o);say("facSt","Factura guardada y la orden quedó como facturada.");
}
async function abrirDocumento(ruta,descargar){
  var w=descargar?null:window.open("","_blank");
  var r=await sb.storage.from("documentos").createSignedUrl(ruta,600,descargar?{download:descargar}:undefined);
  if(r.error||!r.data){if(w)w.close();alert("No se pudo abrir el archivo"+(r.error?": "+r.error.message:"."));return}
  if(w)w.location=r.data.signedUrl;else location.href=r.data.signedUrl;
}
// Cuando la orden queda Lista o Entregada, el presupuesto aprobado pasa a "Realizado"
async function marcarPresuRealizado(ordenId,estado){
  if(estado!=="Listo"&&estado!=="Entregado")return;
  await sb.from("presupuestos").update({estado:"Realizado"}).eq("orden_id",ordenId).in("estado",["Aprobado","Parcialmente aprobado"]);
}

/* ---------- panel: dónde está cada vehículo ---------- */
async function cargarSectoresPanel(){
  var box=document.getElementById("secBox");if(!box)return;
  var r=await sb.from("ordenes").select("*,clientes(nombre),equipos(nombre,marca,modelo,matricula_patente)").neq("estado","Entregado");
  if(!document.getElementById("secBox"))return;
  if(r.error||!(r.data||[]).some(function(o){return "sector" in o})){box.remove();return}
  var grupos={};(r.data||[]).forEach(function(o){var s=o.sector||"Sin sector asignado";(grupos[s]=grupos[s]||[]).push(o)});
  var orden=SECTORES.concat(Object.keys(grupos).filter(function(s){return SECTORES.indexOf(s)<0}));
  var h="<h2>Dónde está cada "+equipoLabel().toLowerCase()+"</h2>";
  var filas=orden.filter(function(s){return grupos[s]}).map(function(s){
   return "<div style='border-top:1px solid var(--line);padding:8px 0'><div class='lr'><b style='font-family:var(--f-head);text-transform:uppercase;letter-spacing:.05em'>"+esc(s)+"</b><span class='tag'>"+grupos[s].length+"</span></div>"+
    grupos[s].map(function(o){var e=o.equipos;return "<button class='item' data-ot='"+o.id+"' style='padding:4px 0;min-height:40px'><span>"+(e?esc(vehTitulo(e))+(e.matricula_patente?" "+plateHtml(e.matricula_patente,"sm"):""):"OT "+String(o.numero).padStart(6,"0"))+"<br><span class='muted' style='font-size:.88rem'>OT "+String(o.numero).padStart(6,"0")+" · "+esc(o.clientes?o.clientes.nombre:"")+" · "+esc(o.estado)+"</span></span><span class='muted'>›</span></button>"}).join("")+"</div>"}).join("");
  box.innerHTML=h+(filas||"<p class='muted' style='margin:0'>No hay "+equipoPlural()+" en el taller.</p>");
  box.querySelectorAll("[data-ot]").forEach(function(b){b.onclick=async function(){var x=await sb.from("ordenes").select("*").eq("id",b.dataset.ot).single();if(x.error){alert(x.error.message);return}S.orden=x.data;S.vista="ordenForm";route()}});
}
function equipoPlural(){var r=rubroTaller();return r==="nautica"?"embarcaciones":r==="motos"?"motos":"vehículos"}
