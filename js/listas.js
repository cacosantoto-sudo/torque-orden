// Listas de precio (plan Plata): el precio de cada artículo en cada proveedor, por familia.
// Usa la misma base que Artículos (js/articulos.js): todo artículo cargado figura acá,
// aunque no tenga precio. Las familias (LUBRICANTES, NEUMÁTICOS…) se administran acá.
// Lectura automática de listas de proveedores con IA (plan Oro): foto, PDF, Excel o CSV.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.listas=renderListas;VISTAS.listaIA=renderListaIA;GRUPOS.listas="proveedores";GRUPOS.listaIA="proveedores";

function fechaCorta(iso){if(!iso)return "";var d=new Date(iso);return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+String(d.getFullYear()).slice(2)}
async function cargarDatosListas(){
  var r=await Promise.all([cargarArticulos(),cargarFamilias(),traerFilas("precios_proveedor","*","id"),sb.from("proveedores").select("id,nombre,cuit").order("nombre")]);
  if(!S.articulos)return FALTA_SQL_ART;
  if(!S.familias||r[2].error)return FALTA_SQL_FAM;
  S.precios=r[2].data;S.lpProvs=r[3].error?[]:(r[3].data||[]);
  return null;
}
function provNombre(id){var p=(S.lpProvs||[]).filter(function(x){return x.id===id})[0];return p?p.nombre:"Proveedor"}

/* ---------- pantalla principal ---------- */
async function renderListas(){
  m.innerHTML="<h1>Listas de precio</h1><div id='box'>"+skel()+"</div>";
  var err=await cargarDatosListas(),box=document.getElementById("box");
  if(err){box.innerHTML="<div class='status err'>"+err+"</div>";return}
  var h=(S.avisoListas?"<div class='status'>"+esc(S.avisoListas)+"</div>":"")+
   "<p class='muted' style='margin-top:0'>Todos los artículos con su precio de venta y lo que cuestan en cada proveedor. Lo que cargás en <b>Artículos</b> aparece acá aunque todavía no tenga precio.</p>"+
   "<div class='btns' style='margin:0 0 12px'><button class='btn' id='lpIA'>"+ic("image")+" Leer lista con IA"+(esOro()?"":" <span class='tag'>ORO</span>")+"</button><button class='btn o' id='lpArt'>"+ic("plus")+" Artículo</button></div>";
  S.avisoListas=null;
  h+="<details class='card' id='lpFamBox'"+(S.lpFamAbierto?" open":"")+"><summary style='cursor:pointer;min-height:44px;display:flex;align-items:center'><h2 style='margin:0'>Familias ("+S.familias.length+")</h2></summary>"+
   "<div style='display:flex;flex-wrap:wrap;gap:6px;margin:10px 0'>"+S.familias.map(function(f){var n=S.articulos.filter(function(a){return a.familia_id===f.id}).length;
    return "<span class='tag' style='display:inline-flex;align-items:center;gap:6px;padding:2px 2px 2px 8px'>"+esc(f.nombre)+" · "+n+"<button class='btn o icon del' data-fam-del='"+f.id+"' style='padding:2px 8px;min-height:32px!important' aria-label='Eliminar familia "+esc(f.nombre)+"' title='Eliminar'>"+ic("trash")+"</button></span>"}).join("")+"</div>"+
   "<label for='lpFamNueva'>Nueva familia</label><div style='display:flex;gap:8px'><input id='lpFamNueva' placeholder='Ej.: ACCESORIOS'><button class='btn' id='lpFamAgregar'>Agregar</button></div><div id='lpFamSt' class='status hide'></div></details>";
  h+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px'>"+
   "<select id='lpFam' aria-label='Familia'><option value=''>Todas las familias</option>"+S.familias.map(function(f){return "<option value='"+f.id+"'"+(f.id===S.lpFam?" selected":"")+">"+esc(f.nombre)+"</option>"}).join("")+"<option value='-'"+(S.lpFam==="-"?" selected":"")+">Sin familia</option></select>"+
   "<select id='lpProv' aria-label='Proveedor'><option value=''>Todos los proveedores</option>"+S.lpProvs.map(function(p){return "<option value='"+p.id+"'"+(p.id===S.lpProv?" selected":"")+">"+esc(p.nombre)+"</option>"}).join("")+"<option value='-'"+(S.lpProv==="-"?" selected":"")+">Sin precio de proveedor</option></select></div>"+
   buscadorHtml("Buscar por código, descripción o proveedor",S.qLp)+"<div id='lpLista'></div>";
  box.innerHTML=h;
  document.getElementById("lpIA").onclick=function(){S.lpLectura=null;S.vista="listaIA";route();window.scrollTo(0,0)};
  document.getElementById("lpArt").onclick=function(){S.vista="articulos";route();window.scrollTo(0,0)};
  document.getElementById("lpFamBox").ontoggle=function(){S.lpFamAbierto=this.open};
  document.getElementById("lpFam").onchange=function(){S.lpFam=this.value;pintarListaPrecios()};
  document.getElementById("lpProv").onchange=function(){S.lpProv=this.value;pintarListaPrecios()};
  document.getElementById("buscar").oninput=function(){S.qLp=this.value;pintarListaPrecios()};
  document.getElementById("lpFamAgregar").onclick=async function(){
   var n=document.getElementById("lpFamNueva").value.trim().toUpperCase();
   if(!n){say("lpFamSt","Escribí el nombre de la familia.",true);return}
   if(familiaPorNombre(n)){say("lpFamSt","Esa familia ya existe.",true);return}
   var r=await sb.from("familias").insert({taller_id:S.taller.id,nombre:n,orden:99});
   if(r.error){say("lpFamSt",r.error.message,true);return}
   S.lpFamAbierto=true;renderListas();
  };
  m.querySelectorAll("[data-fam-del]").forEach(function(b){b.onclick=async function(){
   var f=S.familias.filter(function(x){return x.id===b.dataset.famDel})[0],n=S.articulos.filter(function(a){return a.familia_id===f.id}).length;
   if(!confirm("¿Eliminar la familia "+f.nombre+"?"+(n?" Sus "+n+" artículos quedan sin familia (no se borran).":"")))return;
   var r=await sb.from("familias").delete().eq("id",f.id);
   if(r.error){say("lpFamSt",r.error.message,true);return}
   S.lpFamAbierto=true;if(S.lpFam===f.id)S.lpFam="";renderListas();
  }});
  pintarListaPrecios();
}
function preciosDe(artId){return (S.precios||[]).filter(function(p){return p.articulo_id===artId})}
function pintarListaPrecios(){
  var cont=document.getElementById("lpLista");if(!cont)return;
  var porArt={};(S.precios||[]).forEach(function(p){(porArt[p.articulo_id]=porArt[p.articulo_id]||[]).push(p)});
  var pal=norm(S.qLp).trim().split(/\s+/).filter(Boolean);
  var lista=S.articulos.filter(function(a){
   var ps=porArt[a.id]||[];
   if(S.lpFam==="-"&&a.familia_id)return false;
   if(S.lpFam&&S.lpFam!=="-"&&a.familia_id!==S.lpFam)return false;
   if(S.lpProv==="-"&&ps.some(function(p){return p.precio!=null}))return false;
   if(S.lpProv&&S.lpProv!=="-"&&!ps.some(function(p){return p.proveedor_id===S.lpProv}))return false;
   var t=norm([a.codigo,a.descripcion,familiaNombre(a.familia_id)].concat(ps.map(function(p){return provNombre(p.proveedor_id)+" "+(p.codigo_proveedor||"")})).join(" "));
   return pal.every(function(p){return t.indexOf(p)>=0});
  });
  var tot=S.articulos.length;
  var h="<p class='muted' style='margin:0 0 10px'>"+(lista.length===tot?tot+" artículo"+(tot===1?"":"s"):lista.length+" de "+tot+" artículos")+(lista.length>MAX_LISTA?" · se muestran los primeros "+MAX_LISTA+", usá el buscador":"")+"</p>";
  h+=lista.slice(0,MAX_LISTA).map(function(a){
   var ps=(porArt[a.id]||[]).slice().sort(function(x,y){return (x.precio==null)-(y.precio==null)||(Number(x.precio)||0)-(Number(y.precio)||0)});
   return "<div class='card' style='padding:10px 16px' data-art-card='"+a.id+"'><div class='lr' style='align-items:flex-start'><span>"+familiaTag(a.familia_id)+(a.codigo?"<span class='tag'>"+esc(a.codigo)+"</span> ":"")+esc(a.descripcion)+"</span>"+
    "<span style='display:flex;gap:6px;align-items:center'><span style='text-align:right;white-space:nowrap'><span class='muted' style='font-size:.8rem'>Venta</span><br><b>"+(Number(a.precio)>0?money(a.precio):"<span class='muted' style='font-weight:400'>Sin precio</span>")+"</b></span>"+
    "<button class='btn o icon' data-lp-edit='"+a.id+"' style='padding:4px 10px;min-height:0' aria-label='Editar artículo' title='Editar artículo'>"+ic("pencil")+"</button></span></div>"+
    (ps.length?ps.map(function(p){return "<div class='lr' style='border-top:1px solid var(--line);margin-top:6px;padding-top:6px'><span class='muted'>"+esc(provNombre(p.proveedor_id))+(p.codigo_proveedor?" · "+esc(p.codigo_proveedor):"")+(p.actualizado?" · "+fechaCorta(p.actualizado):"")+"</span>"+
      "<span style='display:flex;gap:6px;align-items:center'><b style='white-space:nowrap'>"+(p.precio!=null?money(p.precio):"<span class='muted' style='font-weight:400'>Sin precio</span>")+"</b>"+
      "<button class='btn o icon' data-pp-edit='"+p.id+"' style='padding:4px 10px;min-height:0' aria-label='Cambiar precio de "+esc(provNombre(p.proveedor_id))+"' title='Cambiar precio'>"+ic("pencil")+"</button>"+
      "<button class='btn o icon del' data-pp-del='"+p.id+"' style='padding:4px 10px;min-height:0' aria-label='Quitar precio de "+esc(provNombre(p.proveedor_id))+"' title='Quitar'>"+ic("trash")+"</button></span></div>"}).join("")
     :"<p class='muted' style='margin:6px 0 0;font-size:.9rem'>Todavía sin precio de proveedor.</p>")+
    (S.lpProvs.length?"<button class='btn o' data-pp-nuevo='"+a.id+"' style='margin-top:8px;padding:6px 12px;min-height:0'>"+ic("plus")+" Precio de proveedor</button>":"")+"</div>"}).join("")||
   (tot?"<p class='muted'>No hay artículos que coincidan.</p>":vacio("tag","Todavía no hay artículos","Leé la lista de precios de un proveedor con IA, o cargá artículos a mano."));
  cont.innerHTML=h;
  cont.querySelectorAll("[data-lp-edit]").forEach(function(b){b.onclick=function(){editarArticulo(b.dataset.lpEdit,renderListas)}});
  cont.querySelectorAll("[data-pp-del]").forEach(function(b){b.onclick=function(){var id=b.dataset.ppDel,fila=b.closest(".lr");
   borrarConDeshacer("Precio quitado",fila,function(){return sb.from("precios_proveedor").delete().eq("id",id)},renderListas)}});
  cont.querySelectorAll("[data-pp-edit]").forEach(function(b){b.onclick=function(){var p=S.precios.filter(function(x){return x.id===b.dataset.ppEdit})[0];formPrecio(p.articulo_id,p)}});
  cont.querySelectorAll("[data-pp-nuevo]").forEach(function(b){b.onclick=function(){formPrecio(b.dataset.ppNuevo,null)}});
}
// Alta o cambio del precio de un artículo en un proveedor
function formPrecio(artId,p){
  var card=m.querySelector("[data-art-card='"+artId+"']"),a=S.articulos.filter(function(x){return x.id===artId})[0];if(!card||!a)return;
  var ya=preciosDe(artId).map(function(x){return x.proveedor_id});
  var provs=p?S.lpProvs.filter(function(x){return x.id===p.proveedor_id}):S.lpProvs.filter(function(x){return ya.indexOf(x.id)<0});
  if(!provs.length){alert("Este artículo ya tiene precio de todos tus proveedores.");return}
  card.innerHTML="<b>"+esc(a.descripcion)+"</b><label for='pp_p'>Proveedor</label><select id='pp_p'"+(p?" disabled":"")+">"+provs.map(function(x){return "<option value='"+x.id+"'"+(S.lpProv===x.id?" selected":"")+">"+esc(x.nombre)+"</option>"}).join("")+"</select>"+
   "<div class='g2'><div><label for='pp_c'>Código del proveedor</label><input id='pp_c' value=\""+esc(p?p.codigo_proveedor:a.codigo)+"\"></div><div><label for='pp_pr'>Precio</label><input id='pp_pr' inputmode='decimal' placeholder='Vacío = sin precio' value=\""+(p&&p.precio!=null?esc(String(p.precio).replace(".",",")):"")+"\"></div></div>"+
   "<div id='ppSt' class='status hide'></div><div class='btns'><button class='btn' id='pp_g'>Guardar</button><button class='btn o' id='pp_x'>Cancelar</button></div>";
  document.getElementById("pp_x").onclick=pintarListaPrecios;
  document.getElementById("pp_g").onclick=async function(){
   var txt=document.getElementById("pp_pr").value.trim(),precio=txt?numAR(txt):null;
   if(txt&&!(precio>=0)){say("ppSt","Revisá el precio.",true);return}
   var d={codigo_proveedor:document.getElementById("pp_c").value.trim()||null,precio:precio,actualizado:new Date().toISOString()};
   var r=p?await sb.from("precios_proveedor").update(d).eq("id",p.id):await sb.from("precios_proveedor").insert(Object.assign(d,{taller_id:S.taller.id,articulo_id:artId,proveedor_id:document.getElementById("pp_p").value}));
   if(r.error){say("ppSt",r.error.message,true);return}
   renderListas();
  };
}

/* ---------- lectura de listas con IA (plan Oro) ---------- */
async function renderListaIA(){
  m.innerHTML="<h1>Leer lista de precios</h1><div id='box'>"+skel()+"</div>";
  var box=document.getElementById("box");
  if(!esOro()){
   box.innerHTML="<div class='card'><p style='margin-top:0'>Subís la lista de precios que te manda el proveedor (foto, PDF o Excel) y la IA reconoce el proveedor, los códigos, las descripciones, los precios y la familia de cada artículo. Vos revisás todo antes de confirmar, y los artículos nuevos se suman solos a tu base.</p>"+
    "<p class='muted'>Es una función del plan <b>Oro</b>. Mientras tanto podés cargar los precios a mano en cada artículo.</p><div class='btns'>"+(esDueno()?"<button class='btn' id='liPlan'>Ver los planes</button>":"")+"<button class='btn o' id='liVolver'>Volver</button></div></div>";
   var bp=document.getElementById("liPlan");if(bp)bp.onclick=function(){S.vista="plan";route()};
   document.getElementById("liVolver").onclick=irListas;
   return;
  }
  var err=await cargarDatosListas();
  if(err){box.innerHTML="<div class='status err'>"+err+"</div>";return}
  if(S.lpLectura)pintarRevisionLista();else pintarCargaLista();
}
function pintarCargaLista(){
  document.getElementById("box").innerHTML="<div class='card'><h2>1. Elegí la lista</h2><p class='muted' style='margin-top:0'>Foto, PDF, Excel (.xlsx / .xls) o CSV. Podés elegir varios archivos del mismo proveedor juntos.</p>"+
   "<input type='file' id='liArch' accept='image/*,application/pdf,.xlsx,.xls,.ods,.csv,text/csv' multiple aria-label='Lista de precios'>"+
   "<div id='liNoms' class='muted' style='margin-top:6px'></div>"+
   "<label for='liTexto'>O pegá el texto de la lista</label><textarea id='liTexto' rows='5' placeholder='F-123  Filtro de aceite Mann W712  $ 8.500'></textarea>"+
   "<label for='liProv'>Proveedor</label><select id='liProv'><option value=''>Que lo detecte la IA</option>"+S.lpProvs.map(function(p){return "<option value='"+p.id+"'>"+esc(p.nombre)+"</option>"}).join("")+"</select>"+
   "<div id='liSt' class='status hide'></div><div class='btns'><button class='btn' id='liLeer'>"+ic("image")+" Leer con IA</button><button class='btn o' id='liVolver'>Volver</button></div></div>"+
   "<p class='muted' style='font-size:.88rem'>Nada se guarda hasta que revises la lista y toques <b>Confirmar</b>. Las listas largas se leen por partes y puede tardar un rato.</p>";
  var fa=document.getElementById("liArch");
  fa.onchange=function(){document.getElementById("liNoms").textContent=Array.prototype.map.call(fa.files,function(f){return f.name}).join(" · ")};
  document.getElementById("liVolver").onclick=irListas;
  document.getElementById("liLeer").onclick=leerListaIA;
}
var hojaCargada=null;
function cargarLectorExcel(){
  if(window.XLSX)return Promise.resolve();
  if(hojaCargada)return hojaCargada;
  hojaCargada=new Promise(function(res,rej){var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=res;s.onerror=function(){hojaCargada=null;rej("No se pudo abrir el lector de Excel. Revisá la conexión.")};document.head.appendChild(s)});
  return hojaCargada;
}
async function planillaATexto(f){
  if(/\.csv$/i.test(f.name)||f.type==="text/csv")return await f.text();
  await cargarLectorExcel();
  var wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
  return wb.SheetNames.map(function(n){return XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:";",blankrows:false})}).join("\n");
}
// Parte un texto largo en tandas de renglones (repitiendo el encabezado) para que la IA conteste rápido
function partirTexto(t){
  var lineas=String(t).split(/\r?\n/).filter(function(l){return l.replace(/[;,\s]/g,"")!==""}),partes=[],cab=lineas[0]||"";
  for(var i=0;i<lineas.length;i+=120){var p=lineas.slice(i,i+120);if(i>0)p.unshift(cab);partes.push(p.join("\n").slice(0,38000))}
  return partes;
}
async function pedirListaIA(cuerpo){
  var resp=await fetch("/api/leer-lista-precios",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(Object.assign({taller_id:S.taller.id,access_token:S.session.access_token,familias:S.familias.map(function(f){return f.nombre}),proveedores:S.lpProvs.map(function(p){return p.nombre})},cuerpo))});
  var r;try{r=await resp.json()}catch(e){throw "El servidor no respondió bien. Probá de nuevo."}
  if(r.error)throw r.error;
  return r;
}
async function leerListaIA(){
  var files=Array.prototype.slice.call(document.getElementById("liArch").files||[]),texto=document.getElementById("liTexto").value.trim(),provSel=document.getElementById("liProv").value;
  if(!files.length&&!texto){say("liSt","Elegí un archivo o pegá el texto de la lista.",true);return}
  var bt=document.getElementById("liLeer");bt.disabled=true;
  var tandas=[],avisos=[],items=[],prov=null,cuit=null;
  for(var i=0;i<files.length;i++){
   var f=files[i];
   try{
    if(/\.(xlsx|xls|ods|csv)$/i.test(f.name)||f.type==="text/csv"){say("liSt","Abriendo "+f.name+"…");partirTexto(await planillaATexto(f)).forEach(function(t,k,arr){tandas.push({nombre:f.name+(arr.length>1?" (parte "+(k+1)+" de "+arr.length+")":""),cuerpo:{texto:t}})})}
    else if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){if(f.size>3.5*1024*1024)throw "pesa mucho para leerlo (máx. 3,5 MB); subí fotos de las hojas o el Excel";tandas.push({nombre:f.name,cuerpo:{archivo:await aBase64(f),tipo:"application/pdf"}})}
    else tandas.push({nombre:f.name,cuerpo:{archivo:await aBase64(await achicar(f,2000)),tipo:"image/jpeg"}});
   }catch(e){avisos.push(f.name+": "+(typeof e==="string"?e:"no se pudo abrir."))}
  }
  if(texto)partirTexto(texto).forEach(function(t,k,arr){tandas.push({nombre:"Texto pegado"+(arr.length>1?" (parte "+(k+1)+")":""),cuerpo:{texto:t}})});
  for(var j=0;j<tandas.length;j++){
   say("liSt","Leyendo "+tandas[j].nombre+(tandas.length>1?" — "+(j+1)+" de "+tandas.length:"")+"… puede tardar unos segundos.");
   try{
    var r=await pedirListaIA(tandas[j].cuerpo);
    if(!prov&&r.proveedor){prov=r.proveedor;cuit=r.cuit}
    if(r.incompleto)avisos.push(tandas[j].nombre+": la lista es muy larga para leerla de una vez; se leyeron "+r.items.length+" artículos. Subí el resto por separado (o mejor, el Excel).");
    if(!r.items.length)avisos.push(tandas[j].nombre+": no se encontraron artículos.");
    items=items.concat(r.items);
   }catch(e){avisos.push(tandas[j].nombre+": "+(typeof e==="string"?e:"no se pudo leer."))}
  }
  bt.disabled=false;
  if(!items.length){say("liSt",avisos.join(" ")||"No se encontraron artículos.",true);return}
  var vistos={};
  items=items.filter(function(it){var k=normCodigo(it.codigo)||norm(it.descripcion).trim();if(vistos[k])return false;vistos[k]=1;return true});
  S.lpLectura={avisos:avisos,prov:provSel||provDeLista(prov,cuit),provNuevo:prov||"",cuit:cuit,venta:"igual",margen:"",
   items:items.map(function(it){var fam=familiaPorNombre(it.familia);return {incluir:true,codigo:it.codigo||"",descripcion:it.descripcion,precio:it.precio,familia_id:fam?fam.id:""}})};
  pintarRevisionLista();window.scrollTo(0,0);
}
function provDeLista(nombre,cuit){
  var c=soloDigitos(cuit),n=norm(nombre).trim(),ps=S.lpProvs;
  if(c.length>=8){var x=ps.filter(function(p){return soloDigitos(p.cuit)===c})[0];if(x)return x.id}
  if(n){var y=ps.filter(function(p){var pn=norm(p.nombre).trim();return pn===n||(pn.length>=4&&n.length>=4&&(pn.indexOf(n)>=0||n.indexOf(pn)>=0))})[0];if(y)return y.id;return "nuevo"}
  return ps.length?"":"nuevo";
}
function pintarRevisionLista(){
  var L=S.lpLectura,box=document.getElementById("box");
  var nuevos=L.items.filter(function(it){return it.incluir&&!articuloIgual(it)}).length,inc=L.items.filter(function(it){return it.incluir}).length;
  var h=(L.avisos.length?"<div class='status err'>"+L.avisos.map(esc).join("<br>")+"</div>":"")+
   "<div class='card'><h2>2. Revisá y confirmá</h2>"+
   "<label for='lrProv'>Proveedor de esta lista</label><select id='lrProv'><option value=''>Elegí el proveedor</option>"+S.lpProvs.map(function(p){return "<option value='"+p.id+"'"+(p.id===L.prov?" selected":"")+">"+esc(p.nombre)+"</option>"}).join("")+"<option value='nuevo'"+(L.prov==="nuevo"?" selected":"")+">+ Proveedor nuevo</option></select>"+
   (L.prov==="nuevo"?"<label for='lrProvNom'>Nombre del proveedor nuevo</label><input id='lrProvNom' value=\""+esc(L.provNuevo)+"\">":"")+
   "<label for='lrVenta'>Precio de venta de los artículos nuevos</label><select id='lrVenta'><option value='igual'"+(L.venta==="igual"?" selected":"")+">Igual al de la lista</option><option value='margen'"+(L.venta==="margen"?" selected":"")+">Lista + un porcentaje</option><option value='vacio'"+(L.venta==="vacio"?" selected":"")+">Dejarlo sin precio</option></select>"+
   (L.venta==="margen"?"<label for='lrMargen'>Porcentaje a sumar</label><input id='lrMargen' inputmode='decimal' placeholder='Ej.: 30' value=\""+esc(L.margen)+"\">":"")+
   "<p class='muted' style='margin:10px 0 0'>"+inc+" artículo"+(inc===1?"":"s")+" para cargar · "+nuevos+" nuevo"+(nuevos===1?"":"s")+" en tu base. A los que ya tenés se les actualiza solo el precio de este proveedor.</p>"+
   "<div id='lrSt' class='status hide'></div><div class='btns'><button class='btn' id='lrOk'>Confirmar</button><button class='btn o' id='lrTodos'>"+(inc===L.items.length?"Destildar todos":"Tildar todos")+"</button><button class='btn o' id='lrX'>Cancelar</button></div></div>";
  h+=L.items.slice(0,600).map(function(it,i){var ex=articuloIgual(it);
   return "<div class='card' style='padding:10px 12px"+(it.incluir?"":";opacity:.55")+"'><div class='lr' style='align-items:flex-start'><label style='display:flex;gap:8px;align-items:flex-start;margin:0;font:inherit;text-transform:none;letter-spacing:normal;flex:1;color:var(--ink)'><input type='checkbox' data-li-inc='"+i+"'"+(it.incluir?" checked":"")+" style='width:auto;min-height:0;margin-top:4px'>"+
    "<span>"+(it.codigo?"<span class='tag'>"+esc(it.codigo)+"</span> ":"")+esc(it.descripcion)+"<br><span class='tag "+(ex?"":"g")+"' style='display:inline-block;margin-top:4px'>"+(ex?"Ya está":"Nuevo")+"</span></span></label></div>"+
    "<div class='g2' style='margin-top:6px'><div><label for='lf"+i+"'>Familia</label><select id='lf"+i+"' data-li-fam='"+i+"'>"+opcionesFamilia(it.familia_id)+"</select></div>"+
    "<div><label for='lp"+i+"'>Precio</label><input id='lp"+i+"' data-li-pre='"+i+"' inputmode='decimal' placeholder='Sin precio' value=\""+(it.precio!=null?esc(String(it.precio).replace(".",",")):"")+"\"></div></div></div>"}).join("");
  if(L.items.length>600)h+="<p class='muted'>Se muestran los primeros 600 para revisar; se cargan los "+L.items.length+".</p>";
  box.innerHTML=h;
  document.getElementById("lrProv").onchange=function(){L.prov=this.value;pintarRevisionLista()};
  var pn=document.getElementById("lrProvNom");if(pn)pn.oninput=function(){L.provNuevo=this.value};
  document.getElementById("lrVenta").onchange=function(){L.venta=this.value;pintarRevisionLista()};
  var mg=document.getElementById("lrMargen");if(mg)mg.oninput=function(){L.margen=this.value};
  document.getElementById("lrX").onclick=function(){S.lpLectura=null;pintarCargaLista()};
  document.getElementById("lrTodos").onclick=function(){var todos=L.items.every(function(it){return it.incluir});L.items.forEach(function(it){it.incluir=!todos});pintarRevisionLista()};
  box.querySelectorAll("[data-li-inc]").forEach(function(c){c.onchange=function(){L.items[Number(c.dataset.liInc)].incluir=c.checked;pintarRevisionLista()}});
  box.querySelectorAll("[data-li-fam]").forEach(function(s){s.onchange=function(){L.items[Number(s.dataset.liFam)].familia_id=s.value}});
  box.querySelectorAll("[data-li-pre]").forEach(function(p){p.oninput=function(){var t=p.value.trim();L.items[Number(p.dataset.liPre)].precio=t?numAR(t):null}});
  document.getElementById("lrOk").onclick=confirmarLista;
}
async function confirmarLista(){
  var L=S.lpLectura,bt=document.getElementById("lrOk");
  var items=L.items.filter(function(it){return it.incluir&&String(it.descripcion||"").trim()});
  if(!items.length){say("lrSt","No hay artículos tildados.",true);return}
  if(items.some(function(it){return it.precio!=null&&!(it.precio>=0)})){say("lrSt","Hay un precio que no se entiende. Revisalo.",true);return}
  if(!L.prov){say("lrSt","Elegí el proveedor de la lista.",true);return}
  var margen=L.venta==="margen"?numAR(L.margen):0;
  if(L.venta==="margen"&&!(margen>=0)){say("lrSt","Revisá el porcentaje.",true);return}
  bt.disabled=true;say("lrSt","Guardando…");
  var provId=L.prov;
  if(provId==="nuevo"){
   var nom=String(L.provNuevo||"").trim();if(!nom){bt.disabled=false;say("lrSt","Escribí el nombre del proveedor nuevo.",true);return}
   var rp=await sb.from("proveedores").insert({taller_id:S.taller.id,nombre:nom,cuit:L.cuit||null}).select().single();
   if(rp.error){bt.disabled=false;say("lrSt",rp.error.message,true);return}
   provId=rp.data.id;L.prov=provId;S.lpProvs.push(rp.data);
  }
  // 1. los artículos que no están en la base se crean (con su familia y precio de venta)
  var nuevos=[],vistos={},sinFam=[];
  items.forEach(function(it){
   var ex=articuloIgual(it);
   if(ex){if(!ex.familia_id&&it.familia_id)sinFam.push({id:ex.id,familia_id:it.familia_id});return}
   var k=normCodigo(it.codigo)||norm(it.descripcion).trim();if(vistos[k])return;vistos[k]=1;
   var venta=L.venta==="vacio"||it.precio==null?0:Math.round(it.precio*(1+margen/100)*100)/100;
   nuevos.push({taller_id:S.taller.id,codigo:String(it.codigo||"").trim()||null,descripcion:String(it.descripcion).trim(),precio:venta,familia_id:it.familia_id||null});
  });
  var ra=await insertarEnTandas("articulos",nuevos);
  S.articulos=S.articulos.concat(ra.data||[]);
  if(ra.error){bt.disabled=false;say("lrSt",ra.error.message,true);return}
  for(var i=0;i<sinFam.length;i++)await sb.from("articulos").update({familia_id:sinFam[i].familia_id}).eq("id",sinFam[i].id);
  // 2. el precio de este proveedor para cada artículo (si ya había uno, se actualiza)
  var ahora=new Date().toISOString(),filas=[],porArt={};
  items.forEach(function(it){var a=articuloIgual(it);if(!a||porArt[a.id])return;porArt[a.id]=1;
   filas.push({taller_id:S.taller.id,articulo_id:a.id,proveedor_id:provId,codigo_proveedor:String(it.codigo||"").trim()||null,precio:it.precio,actualizado:ahora})});
  var rpp=await insertarEnTandas("precios_proveedor",filas,"articulo_id,proveedor_id");
  bt.disabled=false;
  if(rpp.error){say("lrSt",rpp.error.message,true);return}
  S.lpLectura=null;S.lpProv=provId;S.lpFam="";S.qLp="";
  S.avisoListas="Listo: "+filas.length+" precio"+(filas.length===1?"":"s")+" de "+provNombre(provId)+" cargado"+(filas.length===1?"":"s")+" ("+nuevos.length+" artículo"+(nuevos.length===1?"":"s")+" nuevo"+(nuevos.length===1?"":"s")+").";
  irListas();
}
