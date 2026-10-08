// Base de artículos para presupuestos: código, descripción y precio.
// No toca el stock: sirve para no escribir dos veces lo mismo. Al escribir un ítem del
// presupuesto aparecen sugerencias, y lo nuevo que se presupuesta se guarda solo en la base.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.articulos=renderArticulos;GRUPOS.articulos="ordenes";
var FALTA_SQL_ART="Falta correr el SQL nuevo en Supabase (sql/2026-10-08_modificaciones.sql) para usar la base de artículos.";

async function cargarArticulos(){
  var r=await sb.from("articulos").select("*").order("descripcion");
  S.articulos=r.error?null:(r.data||[]);
  return S.articulos;
}
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
async function renderArticulos(){
  m.innerHTML="<h1>Artículos</h1>"+tabsOrdenes("articulos")+"<div id='box'>"+skel()+"</div>";
  conectarTabs();
  await cargarArticulos();
  var box=document.getElementById("box");
  if(!S.articulos){box.innerHTML="<div class='status err'>"+FALTA_SQL_ART+"</div>";return}
  var h="<p class='muted' style='margin-top:0'>Repuestos y trabajos que presupuestás seguido, con su precio. Cuando escribís un ítem en un presupuesto aparecen como sugerencia. No cambia el stock.</p>"+
   "<div class='card'><h2>Nuevo artículo</h2><div class='g2'><div><label for='arCod'>Código</label><input id='arCod' placeholder='Opcional'></div><div><label for='arPre'>Precio</label><input id='arPre' inputmode='decimal'></div></div>"+
   "<label for='arDes'>Descripción</label><input id='arDes' placeholder='Ej.: Filtro de aceite Mann W712'>"+
   "<div id='arSt' class='status hide'></div><div class='btns'><button class='btn' id='arAgregar'>Agregar</button></div></div>"+
   buscadorHtml("Buscar por código o descripción",S.qArt)+
   "<p class='muted' style='margin:0 0 10px'>"+S.articulos.length+" artículo"+(S.articulos.length===1?"":"s")+"</p>";
  h+=S.articulos.map(function(a){
   return "<div class='card' style='padding:10px 16px' data-q=\""+esc(norm((a.codigo||"")+" "+a.descripcion))+"\" data-art-card='"+a.id+"'><div class='lr'><span>"+(a.codigo?"<span class='tag'>"+esc(a.codigo)+"</span> ":"")+esc(a.descripcion)+"</span>"+
    "<span class='lr' style='gap:8px'><b style='white-space:nowrap'>"+money(a.precio)+"</b><button class='btn o icon' data-art-edit='"+a.id+"' style='padding:4px 10px;min-height:0' aria-label='Editar' title='Editar'>"+ic("pencil")+"</button>"+
    "<button class='btn o icon del' data-art-del='"+a.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar' title='Eliminar'>"+ic("trash")+"</button></span></div></div>"}).join("")||vacio("package","Todavía no hay artículos","Cargalos acá o se van sumando solos cuando guardás un presupuesto.");
  h+="<p id='sinres' class='muted hide'>No hay artículos que coincidan.</p>";
  box.outerHTML=h;
  var bs=document.getElementById("buscar");bs.oninput=function(){S.qArt=bs.value;filtrarLista(bs.value)};filtrarLista(bs.value);
  document.getElementById("arAgregar").onclick=async function(){
   var d=document.getElementById("arDes").value.trim(),p=numAR(document.getElementById("arPre").value),c=document.getElementById("arCod").value.trim();
   if(!d){say("arSt","Escribí la descripción.",true);return}
   if(!(p>=0)){say("arSt","Revisá el precio.",true);return}
   if(articuloIgual({codigo:c,descripcion:d})){say("arSt","Ya hay un artículo con ese código o esa descripción.",true);return}
   this.disabled=true;var r=await sb.from("articulos").insert({taller_id:S.taller.id,codigo:c||null,descripcion:d,precio:p||0});this.disabled=false;
   if(r.error){say("arSt",r.error.message,true);return}
   renderArticulos();
  };
  m.querySelectorAll("[data-art-del]").forEach(function(b){b.onclick=function(){var id=b.dataset.artDel;
   borrarConDeshacer("Artículo eliminado",tarjetaDe("[data-art-del='"+id+"']"),function(){return sb.from("articulos").delete().eq("id",id)},renderArticulos)}});
  m.querySelectorAll("[data-art-edit]").forEach(function(b){b.onclick=function(){
   var a=S.articulos.filter(function(x){return x.id===b.dataset.artEdit})[0],card=m.querySelector("[data-art-card='"+a.id+"']");
   card.innerHTML="<div class='g2'><div><label for='ae_c'>Código</label><input id='ae_c' value=\""+esc(a.codigo)+"\"></div><div><label for='ae_p'>Precio</label><input id='ae_p' inputmode='decimal' value=\""+esc(String(a.precio).replace(".",","))+"\"></div></div>"+
    "<label for='ae_d'>Descripción</label><input id='ae_d' value=\""+esc(a.descripcion)+"\"><div id='aeSt' class='status hide'></div>"+
    "<div class='btns'><button class='btn' id='ae_g'>Guardar</button><button class='btn o' id='ae_x'>Cancelar</button></div>";
   document.getElementById("ae_x").onclick=renderArticulos;
   document.getElementById("ae_g").onclick=async function(){
    var d=document.getElementById("ae_d").value.trim(),p=numAR(document.getElementById("ae_p").value);
    if(!d||!(p>=0)){say("aeSt","Revisá la descripción y el precio.",true);return}
    var r=await sb.from("articulos").update({codigo:document.getElementById("ae_c").value.trim()||null,descripcion:d,precio:p||0}).eq("id",a.id);
    if(r.error){say("aeSt",r.error.message,true);return}
    renderArticulos()};
  }});
}
