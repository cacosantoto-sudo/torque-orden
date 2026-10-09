// Módulo de artículos: familia, código, descripción y precio de venta.
// No toca el stock: sirve para no escribir dos veces lo mismo. Al escribir un ítem del
// presupuesto aparecen sugerencias, y lo nuevo que se presupuesta se guarda solo en la base.
// Es la misma base que usan las Listas de precio (js/listas.js): todo artículo que se carga
// acá figura en las listas, aunque todavía no tenga precio de ningún proveedor.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.articulos=renderArticulos;GRUPOS.articulos="ordenes";
var FALTA_SQL_ART="Falta correr el SQL nuevo en Supabase (sql/2026-10-08_modificaciones.sql) para usar la base de artículos.";
var FALTA_SQL_FAM="Para usar familias y listas de precio falta correr en Supabase el SQL sql/2026-10-08_2_articulos_listas_turnos.sql.";
var MAX_LISTA=200; // cuántas tarjetas se dibujan juntas (con el buscador se encuentra el resto)

// Supabase devuelve como mucho 1000 filas por pedido: esto trae todas, de a 1000
async function traerFilas(tabla,sel,orden){
  var out=[],desde=0;
  for(;;){
   var r=await sb.from(tabla).select(sel||"*").order(orden||"id").range(desde,desde+999);
   if(r.error)return {error:r.error};
   out=out.concat(r.data||[]);
   if(!r.data||r.data.length<1000)return {data:out};
   desde+=1000;
  }
}
// Inserta muchas filas en tandas para no pasarse del tamaño de un pedido
async function insertarEnTandas(tabla,filas,upsert){
  var out=[];
  for(var i=0;i<filas.length;i+=400){
   var q=sb.from(tabla),parte=filas.slice(i,i+400);
   var r=upsert?await q.upsert(parte,{onConflict:upsert}).select():await q.insert(parte).select();
   if(r.error)return {error:r.error,data:out};
   out=out.concat(r.data||[]);
  }
  return {data:out};
}

async function cargarArticulos(){
  var r=await traerFilas("articulos","*","descripcion");
  S.articulos=r.error?null:r.data;
  return S.articulos;
}
async function cargarFamilias(){
  var r=await sb.from("familias").select("*").order("orden").order("nombre");
  S.familias=r.error?null:(r.data||[]);
  return S.familias;
}
function familiaNombre(id){var f=(S.familias||[]).filter(function(x){return x.id===id})[0];return f?f.nombre:""}
function familiaPorNombre(n){var k=norm(n).trim();if(!k)return null;return (S.familias||[]).filter(function(f){return norm(f.nombre).trim()===k})[0]||null}
function opcionesFamilia(sel,vacio){
  return "<option value=''>"+(vacio||"Sin familia")+"</option>"+(S.familias||[]).map(function(f){return "<option value='"+f.id+"'"+(f.id===sel?" selected":"")+">"+esc(f.nombre)+"</option>"}).join("");
}
function familiaTag(id){var n=familiaNombre(id);return n?"<span class='tag' style='border-color:rgba(255,106,19,.45);color:var(--ac2)'>"+esc(n)+"</span> ":""}

function buscarArticulos(q,max){
  var pal=norm(q).trim().split(/\s+/).filter(Boolean);if(!pal.length||!S.articulos)return [];
  var lista=S.articulos.filter(function(a){var t=norm((a.codigo||"")+" "+a.descripcion);return pal.every(function(p){return t.indexOf(p)>=0})});
  var nq=normCodigo(q);
  lista.sort(function(a,b){var ca=nq&&normCodigo(a.codigo).indexOf(nq)===0?0:1,cb=nq&&normCodigo(b.codigo).indexOf(nq)===0?0:1;return ca-cb||String(a.descripcion).localeCompare(String(b.descripcion))});
  return lista.slice(0,max||6);
}
function articuloIgual(it){
  var cod=normCodigo(it.codigo),d=norm(it.descripcion).trim();
  return (S.articulos||[]).filter(function(a){return (cod&&normCodigo(a.codigo)===cod)||norm(a.descripcion).trim()===d})[0]||null;
}

/* ---------- texto predictivo en los ítems del presupuesto ---------- */
function conectarArticulos(box){
  if(!S.articulos)return;
  box.querySelectorAll("input[data-f='descripcion']").forEach(function(inp){
   var sug=document.createElement("div");sug.className="sugs hide";sug.setAttribute("role","listbox");inp.after(sug);
   inp.setAttribute("autocomplete","off");
   function pintar(){
    var res=inp.value.trim().length>=2?buscarArticulos(inp.value):[];
    if(!res.length){sug.classList.add("hide");sug.innerHTML="";return}
    sug.innerHTML=res.map(function(a){return "<button type='button' role='option' data-art='"+a.id+"'><span>"+(a.codigo?"<span class='muted'>"+esc(a.codigo)+"</span> · ":"")+esc(a.descripcion)+"</span><b>"+money(a.precio)+"</b></button>"}).join("");
    sug.classList.remove("hide");
    sug.querySelectorAll("[data-art]").forEach(function(b){b.onpointerdown=function(e){e.preventDefault();elegir(b.dataset.art)};b.onclick=function(){elegir(b.dataset.art)}});
   }
   function elegir(id){
    var a=S.articulos.filter(function(x){return x.id===id})[0],it=S.presu.items[Number(inp.dataset.i)];if(!a||!it)return;
    it.descripcion=a.descripcion;it.precio=Number(a.precio)||0;if(a.codigo)it.codigo=a.codigo;else delete it.codigo;
    if(!(Number(it.cantidad)>0))it.cantidad=1;
    pintarPresu();
   }
   inp.addEventListener("input",function(){var it=S.presu.items[Number(inp.dataset.i)];if(it&&it.codigo&&!articuloIgual(it))delete it.codigo;pintar()});
   inp.addEventListener("focus",pintar);
   inp.addEventListener("blur",function(){setTimeout(function(){sug.classList.add("hide")},150)});
  });
}
// Lo que se presupuesta y todavía no está en la base se guarda solo (no pisa precios ya cargados)
async function guardarArticulosNuevos(items){
  if(!S.articulos)return 0;
  var nuevos=[],vistos={};
  (items||[]).forEach(function(it){
   var d=String(it.descripcion||"").trim(),p=Number(it.precio);
   if(!d||!(p>0)||articuloIgual(it)||vistos[norm(d)])return;
   vistos[norm(d)]=1;nuevos.push({taller_id:S.taller.id,codigo:it.codigo||null,descripcion:d,precio:p});
  });
  if(!nuevos.length)return 0;
  var r=await sb.from("articulos").insert(nuevos).select();
  if(!r.error)S.articulos=S.articulos.concat(r.data||[]);
  return r.error?0:nuevos.length;
}

/* ---------- pantalla de artículos ---------- */
function irListas(){S.vista="listas";route();window.scrollTo(0,0)}
async function renderArticulos(){
  m.innerHTML="<h1>Artículos</h1>"+tabsOrdenes("articulos")+"<div id='box'>"+skel()+"</div>";
  conectarTabs();
  var res=await Promise.all([cargarArticulos(),cargarFamilias(),sb.from("proveedores").select("id,nombre").order("nombre")]);
  S.artProvs=res[2].error?[]:(res[2].data||[]);
  var hayListas=!!S.familias;
  var box=document.getElementById("box");
  if(!S.articulos){box.innerHTML="<div class='status err'>"+FALTA_SQL_ART+"</div>";return}
  var h="<p class='muted' style='margin-top:0'>Repuestos, insumos y trabajos con su familia y su precio de venta. Cuando escribís un ítem en un presupuesto aparecen como sugerencia. No cambia el stock. "+
   (hayListas?"Todo lo que cargues acá figura también en <b>Listas de precio</b>, aunque no tenga precio.":"")+"</p>"+
   (hayListas?"":"<div class='status'>"+FALTA_SQL_FAM+"</div>")+
   "<div class='card'><h2>Nuevo artículo</h2>"+
   (hayListas?"<label for='arFam'>Familia</label><select id='arFam'>"+opcionesFamilia(S.artFamDef||"")+"</select>":"")+
   "<div class='g2'><div><label for='arCod'>Código</label><input id='arCod' placeholder='Opcional'></div><div><label for='arPre'>Precio de venta</label><input id='arPre' inputmode='decimal' placeholder='Opcional'></div></div>"+
   "<label for='arDes'>Descripción</label><input id='arDes' placeholder='Ej.: Filtro de aceite Mann W712'>"+
   (hayListas&&S.artProvs.length?"<div class='g2'><div><label for='arProv'>Proveedor</label><select id='arProv'><option value=''>Ninguno</option>"+S.artProvs.map(function(p){return "<option value='"+p.id+"'>"+esc(p.nombre)+"</option>"}).join("")+"</select></div>"+
    "<div><label for='arCosto'>Precio del proveedor</label><input id='arCosto' inputmode='decimal' placeholder='Opcional'></div></div>":"")+
   "<div id='arSt' class='status hide'></div><div class='btns'><button class='btn' id='arAgregar'>Agregar</button>"+(hayListas?"<button class='btn o' id='arListas'>"+ic("tag")+" Listas de precio</button>":"")+"</div></div>"+
   (hayListas?"<select id='arFiltro' aria-label='Filtrar por familia' style='margin-bottom:12px'>"+opcionesFamilia(S.artFiltro||"","Todas las familias").replace("<option value=''>Todas las familias</option>","<option value=''>Todas las familias</option><option value='-'"+(S.artFiltro==="-"?" selected":"")+">Sin familia</option>")+"</select>":"")+
   buscadorHtml("Buscar por código o descripción",S.qArt)+
   "<div id='arLista'></div>";
  box.outerHTML=h;
  var bs=document.getElementById("buscar");bs.oninput=function(){S.qArt=bs.value;pintarListaArticulos()};
  var fl=document.getElementById("arFiltro");if(fl)fl.onchange=function(){S.artFiltro=fl.value;pintarListaArticulos()};
  var bl=document.getElementById("arListas");if(bl)bl.onclick=irListas;
  pintarListaArticulos();
  document.getElementById("arAgregar").onclick=async function(){
   var d=document.getElementById("arDes").value.trim(),pTxt=document.getElementById("arPre").value.trim(),p=pTxt?numAR(pTxt):0,c=document.getElementById("arCod").value.trim();
   var fam=document.getElementById("arFam"),prov=document.getElementById("arProv"),costoTxt=prov?document.getElementById("arCosto").value.trim():"";
   if(!d){say("arSt","Escribí la descripción.",true);return}
   if(!(p>=0)){say("arSt","Revisá el precio de venta.",true);return}
   var costo=costoTxt?numAR(costoTxt):null;
   if(costoTxt&&!(costo>=0)){say("arSt","Revisá el precio del proveedor.",true);return}
   if(articuloIgual({codigo:c,descripcion:d})){say("arSt","Ya hay un artículo con ese código o esa descripción.",true);return}
   var fila={taller_id:S.taller.id,codigo:c||null,descripcion:d,precio:p||0};
   if(fam){fila.familia_id=fam.value||null;S.artFamDef=fam.value}
   this.disabled=true;var r=await sb.from("articulos").insert(fila).select().single();
   if(!r.error&&prov&&prov.value)r=await sb.from("precios_proveedor").insert({taller_id:S.taller.id,articulo_id:r.data.id,proveedor_id:prov.value,codigo_proveedor:c||null,precio:costo});
   this.disabled=false;
   if(r.error){say("arSt",r.error.message,true);return}
   renderArticulos();
  };
}
function articulosFiltrados(qTxt,fam){
  var pal=norm(qTxt).trim().split(/\s+/).filter(Boolean);
  return (S.articulos||[]).filter(function(a){
   if(fam==="-"&&a.familia_id)return false;
   if(fam&&fam!=="-"&&a.familia_id!==fam)return false;
   var t=norm((a.codigo||"")+" "+a.descripcion+" "+familiaNombre(a.familia_id));
   return pal.every(function(p){return t.indexOf(p)>=0});
  });
}
function pintarListaArticulos(){
  var cont=document.getElementById("arLista");if(!cont)return;
  var lista=articulosFiltrados(S.qArt,S.familias?S.artFiltro:""),tot=S.articulos.length;
  var h="<p class='muted' style='margin:0 0 10px'>"+(lista.length===tot?tot+" artículo"+(tot===1?"":"s"):lista.length+" de "+tot+" artículos")+(lista.length>MAX_LISTA?" · se muestran los primeros "+MAX_LISTA+", usá el buscador":"")+"</p>";
  h+=lista.slice(0,MAX_LISTA).map(function(a){
   return "<div class='card' style='padding:10px 16px' data-art-card='"+a.id+"'><div class='lr'><span>"+familiaTag(a.familia_id)+(a.codigo?"<span class='tag'>"+esc(a.codigo)+"</span> ":"")+esc(a.descripcion)+"</span>"+
    "<span class='lr' style='gap:8px'><b style='white-space:nowrap'>"+(Number(a.precio)>0?money(a.precio):"<span class='muted' style='font-weight:400'>Sin precio</span>")+"</b><button class='btn o icon' data-art-edit='"+a.id+"' style='padding:4px 10px;min-height:0' aria-label='Editar' title='Editar'>"+ic("pencil")+"</button>"+
    "<button class='btn o icon del' data-art-del='"+a.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar' title='Eliminar'>"+ic("trash")+"</button></span></div></div>"}).join("")||
   (tot?"<p class='muted'>No hay artículos que coincidan.</p>":vacio("package","Todavía no hay artículos","Cargalos acá, leé una lista de precios de un proveedor, o se van sumando solos cuando guardás un presupuesto."));
  cont.innerHTML=h;
  cont.querySelectorAll("[data-art-del]").forEach(function(b){b.onclick=function(){var id=b.dataset.artDel;
   borrarConDeshacer("Artículo eliminado",tarjetaDe("[data-art-del='"+id+"']"),function(){return sb.from("articulos").delete().eq("id",id)},renderArticulos)}});
  cont.querySelectorAll("[data-art-edit]").forEach(function(b){b.onclick=function(){editarArticulo(b.dataset.artEdit,renderArticulos)}});
}
// Edición en el lugar (también la usa Listas de precio)
function editarArticulo(id,despues){
  var a=S.articulos.filter(function(x){return x.id===id})[0],card=m.querySelector("[data-art-card='"+id+"']");if(!a||!card)return;
  card.innerHTML=(S.familias?"<label for='ae_f'>Familia</label><select id='ae_f'>"+opcionesFamilia(a.familia_id||"")+"</select>":"")+
   "<div class='g2'><div><label for='ae_c'>Código</label><input id='ae_c' value=\""+esc(a.codigo)+"\"></div><div><label for='ae_p'>Precio de venta</label><input id='ae_p' inputmode='decimal' value=\""+esc(String(a.precio).replace(".",","))+"\"></div></div>"+
   "<label for='ae_d'>Descripción</label><input id='ae_d' value=\""+esc(a.descripcion)+"\"><div id='aeSt' class='status hide'></div>"+
   "<div class='btns'><button class='btn' id='ae_g'>Guardar</button><button class='btn o' id='ae_x'>Cancelar</button></div>";
  document.getElementById("ae_x").onclick=despues;
  document.getElementById("ae_g").onclick=async function(){
   var d=document.getElementById("ae_d").value.trim(),pTxt=document.getElementById("ae_p").value.trim(),p=pTxt?numAR(pTxt):0;
   if(!d||!(p>=0)){say("aeSt","Revisá la descripción y el precio.",true);return}
   var cambios={codigo:document.getElementById("ae_c").value.trim()||null,descripcion:d,precio:p||0},f=document.getElementById("ae_f");
   if(f)cambios.familia_id=f.value||null;
   var r=await sb.from("articulos").update(cambios).eq("id",a.id);
   if(r.error){say("aeSt",r.error.message,true);return}
   despues()};
}
