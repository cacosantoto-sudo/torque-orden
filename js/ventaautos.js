// Venta de unidades según el rubro: autos, motos (nuevas y usadas) o lanchas y motores fuera de borda.
// Unidades propias o en consignación, con el cliente (existente o nuevo),
// precio para el cliente, precio de publicación, datos del auto, documentación en PDF y fotos.
// Los archivos van a la carpeta privada "documentos" del taller: <taller>/autos/<auto>/...
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.autos=renderAutos;VISTAS.autoForm=renderAutoForm;GRUPOS.autos="autos";GRUPOS.autoForm="autos";

var FALTA_SQL_AUTOS="Para usar la venta de unidades falta correr en Supabase el SQL nuevo (sql/2026-10-14_2_contabilidad_venta_autos.sql).";
var FALTA_SQL_VENTA2="Para guardar si es nueva o usada y el tipo de unidad falta correr en Supabase el SQL nuevo (sql/2026-10-15_cheques_y_ventas.sql).";
// Textos de la venta según el rubro del taller
function ventaTxt(){
  var r=rubroTaller();
  if(r==="motos")return {titulo:"Venta de motos",dock:"Venta motos",dockCorto:"Motos",unidad:"moto",plural:"motos",fem:true,marca:"Honda",modelo:"CB 250 Twister",patente:"Patente",patPh:"A123BCD",medidor:"Kilómetros",med:"km",
   docs:"título, cédula, 08, informe de dominio…",fotos:"Fotos de la moto",tipos:null};
  if(r==="nautica")return {titulo:"Venta de lanchas y motores fuera de borda",dock:"Venta lanchas",dockCorto:"Lanchas",unidad:"unidad",plural:"lanchas y motores",fem:true,marca:"Bermuda",modelo:"180 Classic",patente:"Matrícula",patPh:"REY 12345",medidor:"Horas de motor",med:"h",
   docs:"título, matrícula, certificado de navegabilidad, factura del motor…",fotos:"Fotos de la unidad",tipos:[["lancha","Lancha / embarcación"],["motor_fb","Motor fuera de borda"]]};
  return {titulo:"Venta de autos",dock:"Venta autos",dockCorto:"Autos",unidad:"auto",plural:"autos",fem:false,marca:"Volkswagen",modelo:"Gol Trend 1.6",patente:"Patente",patPh:"AB123CD",medidor:"Kilómetros",med:"km",
   docs:"título, cédula, 08, VTV, informe de dominio…",fotos:"Fotos del vehículo",tipos:null};
}
function capital(t){return t.charAt(0).toUpperCase()+t.slice(1)}
function tipoUnidadTxt(v){var t=(ventaTxt().tipos||[]).filter(function(x){return x[0]===v})[0];return t?t[1]:""}
var ESTADOS_AUTO=[["disponible","Disponible","g"],["reservado","Reservado","w"],["vendido","Vendido",""]];
function estadoAuto(v){return ESTADOS_AUTO.filter(function(e){return e[0]===v})[0]||ESTADOS_AUTO[0]}
function tituloAuto(a){return [a.marca,a.modelo,a.anio].filter(Boolean).join(" ")||capital(ventaTxt().unidad)+" sin datos"}
function irAuto(id){S.autoEdit=id||null;S.vista="autoForm";route();window.scrollTo(0,0)}
// Para ver una foto o un PDF guardado se pide un enlace temporal
async function urlFirmadas(rutas){
  if(!rutas.length)return {};
  var r=await sb.storage.from("documentos").createSignedUrls(rutas,3600),out={};
  (r.data||[]).forEach(function(x){if(x.signedUrl)out[x.path]=x.signedUrl});
  return out;
}

/* ---------- lista ---------- */
async function renderAutos(){
  var vt=ventaTxt();
  m.innerHTML="<div class='lr'><h1>"+vt.titulo+"</h1><button class='btn' id='autoNuevo' style='padding:8px 14px;min-height:0'>"+ic("plus")+" "+capital(vt.unidad)+"</button></div><div id='box'>"+skel()+"</div>";
  document.getElementById("autoNuevo").onclick=function(){irAuto(null)};
  var r=await sb.from("autos_venta").select("*, clientes(nombre,telefono)").order("creado",{ascending:false});
  if(r.error){document.getElementById("box").innerHTML="<div class='status err'>"+(/relation|does not exist|schema cache/i.test(r.error.message)?FALTA_SQL_AUTOS:esc(r.error.message))+"</div>";return}
  S.autos=r.data||[];
  var tapas=S.autos.map(function(a){return (a.fotos||[])[0]}).filter(Boolean).map(function(f){return f.ruta});
  S.autoUrls=await urlFirmadas(tapas);
  pintarAutos();
}
function pintarAutos(){
  var box=document.getElementById("box");if(!box)return;
  var fe=S.autoFiltro||"activos",lista=S.autos.filter(function(a){return fe==="todos"||(fe==="activos"?a.estado!=="vendido":a.estado===fe)});
  var vt=ventaTxt();
  var h="<div class='tabs' role='tablist' style='flex-wrap:wrap'>"+[["activos","En venta"],["vendido","Vendidos"],["todos","Todos"]].map(function(t){return "<button role='tab' data-af='"+t[0]+"' aria-selected='"+(fe===t[0])+"'>"+t[1]+"</button>"}).join("")+"</div>";
  h+=buscadorHtml("Buscar por marca, modelo, "+vt.patente.toLowerCase()+" o cliente",S.autoQ);
  h+=lista.map(function(a){var f=(a.fotos||[])[0],u=f&&S.autoUrls[f.ruta],e=estadoAuto(a.estado);
   var q=norm([a.marca,a.modelo,a.anio,a.color,a.patente,a.clientes&&a.clientes.nombre].join(" "));
   return "<button class='card autoCard' data-auto='"+a.id+"' data-q=\""+esc(q)+"\">"+
    "<div class='autoFoto'>"+(u?"<img src=\""+esc(u)+"\" alt='' loading='lazy'>":ic(esRubroAutos()?"car":"tag"))+"</div>"+
    "<div style='flex:1;min-width:0'><b style='font-size:1.05rem'>"+esc(tituloAuto(a))+"</b><br><span class='muted' style='font-size:.88rem'>"+[a.color,a.patente&&String(a.patente).toUpperCase(),a.kilometros!=null&&Number(a.kilometros).toLocaleString("es-AR")+" "+vt.med].filter(Boolean).map(esc).join(" · ")+"</span>"+
    (a.clientes?"<br><span class='muted' style='font-size:.85rem'>"+ic("users")+" "+esc(a.clientes.nombre)+"</span>":"")+
    "<div style='margin-top:6px;display:flex;gap:6px;flex-wrap:wrap'><span class='tag "+e[2]+"'>"+e[1]+"</span>"+(a.unidad_estado?"<span class='tag'>"+(a.unidad_estado==="nuevo"?(vt.fem?"Nueva":"Nuevo"):(vt.fem?"Usada":"Usado"))+"</span>":"")+(tipoUnidadTxt(a.tipo_unidad)?"<span class='tag'>"+tipoUnidadTxt(a.tipo_unidad)+"</span>":"")+"<span class='tag'>"+(a.condicion==="consignacion"?"Consignación":"Propio")+"</span></div></div>"+
    "<div style='text-align:right'><span class='muted' style='font-size:.75rem;font-family:var(--f-mono)'>PUBLICACIÓN</span><br><b style='font-family:var(--f-mono)'>"+(a.precio_publicacion!=null?money(a.precio_publicacion):"—")+"</b></div></button>"}).join("")||
   vacio(esRubroAutos()?"car":"tag","No hay "+vt.plural,fe==="vendido"?"Todavía no hay "+vt.plural+" vendid"+(vt.fem?"as":"os")+".":"Tocá <b>"+capital(vt.unidad)+"</b> para cargar "+(vt.fem?"la primera":"el primero")+".");
  h+="<p id='sinres' class='muted hide'>No hay "+vt.plural+" que coincidan.</p>";
  box.innerHTML=h;
  m.querySelectorAll("[data-af]").forEach(function(b){b.onclick=function(){S.autoFiltro=b.dataset.af;pintarAutos()}});
  m.querySelectorAll("[data-auto]").forEach(function(b){b.onclick=function(){irAuto(b.dataset.auto)}});
  var bu=document.getElementById("buscar");bu.oninput=function(){S.autoQ=bu.value;filtrarLista(bu.value)};if(S.autoQ)filtrarLista(S.autoQ);
}

/* ---------- formulario ---------- */
async function renderAutoForm(){
  var vt=ventaTxt();
  m.innerHTML="<h1>"+(S.autoEdit?capital(vt.unidad)+" en venta":"Cargar "+vt.unidad+" en venta")+"</h1><div id='box'>"+skel()+"</div>";
  var rc=await sb.from("clientes").select("*").order("nombre");
  S.autoClientes=rc.error?[]:(rc.data||[]);
  var a={condicion:"propio",estado:"disponible",unidad_estado:"usado",fotos:[],documentos:[]};
  if(S.autoEdit){
   var ra=await sb.from("autos_venta").select("*").eq("id",S.autoEdit).single();
   if(ra.error){document.getElementById("box").innerHTML="<div class='status err'>"+esc(ra.error.message)+"</div>";return}
   a=ra.data;
  }
  S.auto=a;S.autoFotosNuevas=[];S.autoDocsNuevos=[];S.autoCliModo=S.autoClientes.length?"existente":"nuevo";
  S.autoUrls=await urlFirmadas((a.fotos||[]).map(function(f){return f.ruta}));
  pintarAutoForm();
}
function campoAuto(id,lbl,val,extra){return "<div><label for='"+id+"'>"+lbl+"</label><input id='"+id+"' value=\""+esc(val==null?"":val)+"\""+(extra||"")+"></div>"}
function pintarAutoForm(){
  var vt=ventaTxt(),a=S.auto,nuevo=S.autoCliModo==="nuevo",cli=S.autoClientes.filter(function(c){return c.id===a.cliente_id})[0];
  var h="<div class='card'><h2>Cliente</h2>"+
   "<div class='tabs' role='tablist'><button role='tab' data-acm='existente' aria-selected='"+!nuevo+"'"+(S.autoClientes.length?"":" disabled")+">"+ic("users")+" Cliente cargado</button><button role='tab' data-acm='nuevo' aria-selected='"+nuevo+"'>"+ic("plus")+" Cliente nuevo</button></div>"+
   (nuevo
    ?"<label for='acNom'>Nombre y apellido</label><input id='acNom' autocomplete='off'>"+
     "<div class='g2'>"+campoAuto("acTel","Teléfono","", " type='tel'")+campoAuto("acDni","DNI / CUIT","")+"</div>"+
     "<div class='g2'>"+campoAuto("acMail","Email",""," type='email'")+campoAuto("acLoc","Localidad","")+"</div>"+
     "<p class='muted' style='font-size:.85rem;margin:6px 0 0'>Se carga solo en Clientes al guardar.</p>"
    :"<label for='acCli'>Elegí el cliente</label><input id='acCli' list='acCliLista' autocomplete='off' placeholder='Escribí el nombre…' value=\""+esc(cli?cli.nombre:"")+"\"><datalist id='acCliLista'>"+S.autoClientes.map(function(c){return "<option value=\""+esc(c.nombre)+"\">"}).join("")+"</datalist>"+
     "<div id='acCliDatos' class='muted' style='margin-top:6px;font-size:.9rem'>"+(cli?esc(datosClienteTxt(cli)):"")+"</div>")+
   "</div>";
  h+="<div class='card'><h2>Condición y precios</h2>"+
   "<div class='g2'><div><label for='aCond'>Condición de la venta</label><select id='aCond'><option value='propio'"+(a.condicion==="propio"?" selected":"")+">Propio</option><option value='consignacion'"+(a.condicion==="consignacion"?" selected":"")+">Consignación</option></select></div>"+
   "<div><label for='aEst'>Estado</label><select id='aEst'>"+ESTADOS_AUTO.map(function(e){return "<option value='"+e[0]+"'"+(a.estado===e[0]?" selected":"")+">"+e[1]+"</option>"}).join("")+"</select></div></div>"+
   "<div class='g2'>"+campoAuto("aPCli","Precio para el cliente",a.precio_cliente!=null?String(a.precio_cliente).replace(".",","):""," inputmode='decimal'")+
    campoAuto("aPPub","Precio de venta publicación",a.precio_publicacion!=null?String(a.precio_publicacion).replace(".",","):""," inputmode='decimal'")+"</div>"+
   "<div class='lr' style='margin-top:10px'><span class='muted'>Diferencia (ganancia)</span><b id='aDif'></b></div></div>";
  var ue=a.unidad_estado||"usado";
  h+="<div class='card'><h2>Datos de"+(vt.fem?" la ":"l ")+vt.unidad+"</h2>"+
   "<div class='g2'><div><label for='aUE'>"+(vt.fem?"Nueva o usada":"Nuevo o usado")+"</label><select id='aUE'><option value='nuevo'"+(ue==="nuevo"?" selected":"")+">"+(vt.fem?"Nueva (0 km)":"Nuevo (0 km)")+"</option><option value='usado'"+(ue==="usado"?" selected":"")+">"+(vt.fem?"Usada":"Usado")+"</option></select></div>"+
    (vt.tipos?"<div><label for='aTipo'>Tipo</label><select id='aTipo'>"+vt.tipos.map(function(t){return "<option value='"+t[0]+"'"+(a.tipo_unidad===t[0]?" selected":"")+">"+t[1]+"</option>"}).join("")+"</select></div>":"<div></div>")+"</div>"+
   "<div class='g2'>"+campoAuto("aMarca","Marca",a.marca," placeholder='"+vt.marca+"'")+campoAuto("aModelo","Modelo",a.modelo," placeholder='"+vt.modelo+"'")+"</div>"+
   "<div class='g2'>"+campoAuto("aAnio","Año",a.anio," inputmode='numeric'")+campoAuto("aColor","Color",a.color)+"</div>"+
   "<div class='g2'>"+campoAuto("aPat",vt.patente,a.patente," style='text-transform:uppercase' placeholder='"+vt.patPh+"'")+campoAuto("aKm",vt.medidor,a.kilometros!=null?a.kilometros:""," inputmode='numeric'")+"</div>"+
   "<label for='aObs'>Observaciones</label><textarea id='aObs'>"+esc(a.observaciones)+"</textarea></div>";
  h+="<div class='card'><h2>Documentación digital (PDF)</h2>"+
   ((a.documentos||[]).map(function(d,i){return "<div class='lr' style='border-top:1px solid var(--line);padding:8px 0'><button class='btn o' data-adoc='"+i+"' style='padding:4px 10px;min-height:0'>"+ic("download")+" "+esc(d.nombre||"Documento")+"</button><button class='btn o icon del' data-adoc-del='"+i+"' style='padding:4px 10px;min-height:0' aria-label='Quitar documento' title='Quitar'>"+ic("trash")+"</button></div>"}).join("")||"")+
   S.autoDocsNuevos.map(function(f){return "<div class='muted' style='padding:4px 0'>"+esc(f.name)+" · se sube al guardar</div>"}).join("")+
   "<label for='aDocs'>Agregar PDF ("+vt.docs+")</label><input type='file' id='aDocs' accept='application/pdf,.pdf' multiple></div>";
  h+="<div class='card'><h2>"+vt.fotos+"</h2><div class='autoFotos'>"+
   (a.fotos||[]).map(function(f,i){var u=S.autoUrls[f.ruta];return "<div class='autoMini'>"+(u?"<a href=\""+esc(u)+"\" target='_blank' rel='noopener'><img src=\""+esc(u)+"\" alt='Foto "+(i+1)+"'></a>":ic("image"))+"<button data-afoto-del='"+i+"' aria-label='Quitar foto' title='Quitar foto'>"+ic("trash")+"</button></div>"}).join("")+
   S.autoFotosNuevas.map(function(b,i){return "<div class='autoMini'><img src=\""+b.url+"\" alt='Foto nueva "+(i+1)+"'><span class='tag' style='position:absolute;left:4px;bottom:4px'>Nueva</span></div>"}).join("")+
   "</div><label for='aFotos'>Agregar fotos</label><input type='file' id='aFotos' accept='image/*' multiple></div>";
  h+="<div id='aSt' class='status hide'></div><div class='btns'><button class='btn' id='aGuardar'>Guardar</button>"+(a.id?"<button class='btn o del' id='aBorrar'>"+ic("trash")+" Eliminar</button>":"")+"<button class='btn o' id='aVolver'>Volver</button></div>";
  document.getElementById("box").innerHTML=h;
  // conservar lo escrito al repintar (cambiar de pestaña, agregar fotos…)
  if(S.autoBorrador){Object.keys(S.autoBorrador).forEach(function(k){var el=document.getElementById(k);if(el)el.value=S.autoBorrador[k]});S.autoBorrador=null}
  m.querySelectorAll("[data-acm]").forEach(function(b){b.onclick=function(){guardarBorradorAuto();S.autoCliModo=b.dataset.acm;pintarAutoForm()}});
  var ac=document.getElementById("acCli");if(ac)ac.oninput=function(){var c=autoClientePorNombre(ac.value);document.getElementById("acCliDatos").textContent=c?datosClienteTxt(c):""};
  var dif=function(){var c=numAR(document.getElementById("aPCli").value),p=numAR(document.getElementById("aPPub").value),el=document.getElementById("aDif");
   el.textContent=c>0&&p>0?money(p-c):"—";el.style.color=c>0&&p>0&&p-c<0?"var(--bad)":"var(--ink)"};
  document.getElementById("aPCli").oninput=dif;document.getElementById("aPPub").oninput=dif;dif();
  document.getElementById("aDocs").onchange=function(){var fs=Array.prototype.slice.call(this.files||[]);
   var malos=fs.filter(function(f){return !(f.type==="application/pdf"||/\.pdf$/i.test(f.name))||f.size>10*1024*1024});
   if(malos.length){say("aSt","Solo PDF de hasta 10 MB: "+malos.map(function(f){return f.name}).join(", "),true)}
   guardarBorradorAuto();S.autoDocsNuevos=S.autoDocsNuevos.concat(fs.filter(function(f){return malos.indexOf(f)<0}));pintarAutoForm()};
  document.getElementById("aFotos").onchange=async function(){var fs=Array.prototype.slice.call(this.files||[]);guardarBorradorAuto();
   say("aSt","Preparando las fotos…");
   for(var i=0;i<fs.length;i++){if(!/^image\//.test(fs[i].type))continue;var b=await shrink(fs[i]);S.autoFotosNuevas.push({blob:b,url:URL.createObjectURL(b)})}
   pintarAutoForm()};
  m.querySelectorAll("[data-adoc]").forEach(function(b){b.onclick=function(){abrirDocumento(S.auto.documentos[Number(b.dataset.adoc)].ruta)}});
  m.querySelectorAll("[data-adoc-del]").forEach(function(b){b.onclick=function(){var i=Number(b.dataset.adocDel);if(!confirm("¿Quitar este documento? Se borra al guardar."))return;
   guardarBorradorAuto();S.autoQuitar=(S.autoQuitar||[]).concat([S.auto.documentos[i].ruta]);S.auto.documentos.splice(i,1);pintarAutoForm()}});
  m.querySelectorAll("[data-afoto-del]").forEach(function(b){b.onclick=function(){var i=Number(b.dataset.afotoDel);if(!confirm("¿Quitar esta foto? Se borra al guardar."))return;
   guardarBorradorAuto();S.autoQuitar=(S.autoQuitar||[]).concat([S.auto.fotos[i].ruta]);S.auto.fotos.splice(i,1);pintarAutoForm()}});
  document.getElementById("aGuardar").onclick=guardarAuto;
  document.getElementById("aVolver").onclick=function(){S.autoQuitar=null;S.vista="autos";route()};
  var bb=document.getElementById("aBorrar");if(bb)bb.onclick=borrarAuto;
}
function autoClientePorNombre(n){var k=norm(n).trim();return k?S.autoClientes.filter(function(c){return norm(c.nombre).trim()===k})[0]||null:null}
function guardarBorradorAuto(){var b={};m.querySelectorAll("#box input:not([type=file]),#box select,#box textarea").forEach(function(el){if(el.id)b[el.id]=el.value});S.autoBorrador=b}
async function guardarAuto(){
  var a=S.auto,bt=document.getElementById("aGuardar"),v=function(id){var el=document.getElementById(id);return el?el.value.trim():""};
  var num=function(id){var x=v(id);if(!x)return null;var n=numAR(x);if(isNaN(n))throw "Revisá el campo "+document.querySelector("label[for='"+id+"']").textContent+".";return n};
  bt.disabled=true;
  try{
   var d={condicion:v("aCond"),estado:v("aEst"),precio_cliente:num("aPCli"),precio_publicacion:num("aPPub"),marca:v("aMarca")||null,modelo:v("aModelo")||null,
    anio:v("aAnio")?parseInt(v("aAnio"),10)||null:null,color:v("aColor")||null,patente:v("aPat")?v("aPat").toUpperCase():null,kilometros:v("aKm")?numAR(v("aKm").replace(/\./g,"")):null,observaciones:v("aObs")||null,unidad_estado:v("aUE")||"usado"};
   if(document.getElementById("aTipo"))d.tipo_unidad=v("aTipo");
   if(!d.marca&&!d.modelo&&!d.patente)throw "Cargá al menos la marca, el modelo o la "+ventaTxt().patente.toLowerCase()+".";
   // cliente
   if(S.autoCliModo==="nuevo"){
    var nom=v("acNom");
    if(nom){var ex=autoClientePorNombre(nom);
     if(ex)d.cliente_id=ex.id;
     else{var cd={taller_id:S.taller.id,nombre:nom,telefono:v("acTel")||"",dni_cuit:v("acDni")||null,email:v("acMail")||null,localidad:v("acLoc")||null};
      var rn=await sb.from("clientes").insert(cd).select().single();
      if(rn.error&&/column|schema cache/i.test(rn.error.message))rn=await sb.from("clientes").insert({taller_id:S.taller.id,nombre:nom,telefono:cd.telefono}).select().single();
      if(rn.error)throw "No se pudo cargar el cliente: "+rn.error.message;
      S.autoClientes.push(rn.data);d.cliente_id=rn.data.id}}
    else d.cliente_id=null;
   }else{
    var txt=v("acCli"),c=autoClientePorNombre(txt);
    if(txt&&!c)throw "Ese cliente no está cargado. Elegilo de la lista o usá Cliente nuevo.";
    d.cliente_id=c?c.id:null;
   }
   say("aSt","Guardando…");
   var r=a.id?await sb.from("autos_venta").update(d).eq("id",a.id).select().single():await sb.from("autos_venta").insert(Object.assign({taller_id:S.taller.id},d)).select().single();
   if(r.error&&/unidad_estado|tipo_unidad/.test(r.error.message))throw FALTA_SQL_VENTA2;
   if(r.error)throw /relation|does not exist|schema cache/i.test(r.error.message)?FALTA_SQL_AUTOS:r.error.message;
   var id=r.data.id,docs=(a.documentos||[]).slice(),fotos=(a.fotos||[]).slice(),errores=0;
   for(var i=0;i<S.autoDocsNuevos.length;i++){var f=S.autoDocsNuevos[i];say("aSt","Subiendo documentos ("+(i+1)+" de "+S.autoDocsNuevos.length+")…");
    var ruta=S.taller.id+"/autos/"+id+"/docs/"+Date.now()+"_"+nombreSeguro(f.name);
    var up=await sb.storage.from("documentos").upload(ruta,f,{contentType:"application/pdf"});if(up.error)errores++;else docs.push({ruta:ruta,nombre:f.name})}
   for(var j=0;j<S.autoFotosNuevas.length;j++){say("aSt","Subiendo fotos ("+(j+1)+" de "+S.autoFotosNuevas.length+")…");
    var rf=S.taller.id+"/autos/"+id+"/fotos/"+Date.now()+"_"+j+".jpg";
    var uf=await sb.storage.from("documentos").upload(rf,S.autoFotosNuevas[j].blob,{contentType:"image/jpeg"});if(uf.error)errores++;else fotos.push({ruta:rf})}
   if(S.autoDocsNuevos.length||S.autoFotosNuevas.length||S.autoQuitar){
    var ru=await sb.from("autos_venta").update({documentos:docs,fotos:fotos}).eq("id",id);if(ru.error)throw ru.error.message}
   if(S.autoQuitar&&S.autoQuitar.length)await sb.storage.from("documentos").remove(S.autoQuitar);
   S.autoQuitar=null;S.autoFotosNuevas=[];S.autoDocsNuevos=[];
   if(errores){S.auto=Object.assign(r.data,{documentos:docs,fotos:fotos});S.autoEdit=id;bt.disabled=false;say("aSt","Se guardó "+(ventaTxt().fem?"la ":"el ")+ventaTxt().unidad+", pero "+errores+" archivo(s) no se pudieron subir. Probá agregarlos de nuevo.",true);return}
   S.vista="autos";route();
  }catch(e){bt.disabled=false;say("aSt",typeof e==="string"?e:"No se pudo guardar.",true)}
}
async function borrarAuto(){
  var a=S.auto;if(!confirm("¿Eliminar "+tituloAuto(a)+"? Se borran también sus fotos y documentos."))return;
  var r=await sb.from("autos_venta").delete().eq("id",a.id);if(r.error){say("aSt",r.error.message,true);return}
  var rutas=(a.fotos||[]).concat(a.documentos||[]).map(function(x){return x.ruta}).concat(S.autoQuitar||[]);
  if(rutas.length)await sb.storage.from("documentos").remove(rutas);
  S.autoQuitar=null;S.vista="autos";route();
}
