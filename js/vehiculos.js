// Vehículos: ficha completa (marca, modelo, color, motor y caja), alta/edición
// y buscador de vehículos por marca, modelo, color, patente o datos del cliente.
// Usa las variables y funciones globales de index.html (sb, S, m, esc, ic, norm...).
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.vehiculos=renderVehiculos;VISTAS.vehiculoForm=renderVehiculoForm;
GRUPOS.vehiculos="clientes";GRUPOS.vehiculoForm="clientes";

var COMBUSTIBLES=["Nafta","Diésel","GNC","Nafta / GNC","Híbrido","Eléctrico"];
function usaMotorEnFicha(){return rubroTaller()!=="nautica"}
function cajaTxt(t){return t==="automatica"?"Automática":t==="manual"?"Manual":t||""}
// Nombre corto del vehículo: el nombre cargado, o marca + modelo
function vehTitulo(e){if(!e)return "";var mm=[e.marca,e.modelo].filter(Boolean).join(" ");return e.nombre||mm||equipoLabel()}
// Línea de detalle: marca, modelo, año y color (sin repetir lo que ya dice el nombre)
function vehDetalle(e){if(!e)return "";var mm=[e.marca,e.modelo].filter(Boolean).join(" ");
  return [e.nombre&&mm&&norm(e.nombre)!==norm(mm)?mm:"",e.anio,e.color].filter(Boolean).join(" · ")}
function vehBusqueda(e,c){
  return norm([e.nombre,e.marca,e.modelo,e.anio,e.color,e.matricula_patente,normPatente(e.matricula_patente),e.motor,e.codigo_motor,e.vin,
   c&&c.nombre,c&&c.telefono,c&&String(c.telefono||"").replace(/[^0-9]/g,"")].concat((e.motores||[]).map(function(mo){return mo.marca+" "+mo.modelo})).join(" "))}
function tabsClientes(activa){
  return "<div class='tabs' role='tablist'><button role='tab' data-tab='clientes' aria-selected='"+(activa==="clientes")+"'>"+ic("users")+" Clientes</button>"+
   "<button role='tab' data-tab='vehiculos' aria-selected='"+(activa==="vehiculos")+"'>"+ic("car")+" "+(rubroTaller()==="nautica"?"Embarcaciones":"Vehículos")+"</button></div>"}
function conectarTabs(){m.querySelectorAll("[data-tab]").forEach(function(b){b.onclick=function(){S.vista=b.dataset.tab;route()}})}

/* ---------- buscador de vehículos ---------- */
async function renderVehiculos(){
  m.innerHTML="<h1>"+(rubroTaller()==="nautica"?"Embarcaciones":"Vehículos")+"</h1>"+tabsClientes("vehiculos")+"<div id='box'>"+skel()+"</div>";
  conectarTabs();
  var r=await sb.from("equipos").select("*,clientes(id,nombre,telefono),motores(marca,modelo)").order("creado",{ascending:false});
  if(r.error)r=await sb.from("equipos").select("*,clientes(id,nombre,telefono),motores(marca,modelo)");
  if(r.error){document.getElementById("box").innerHTML=esc(r.error.message);return}
  var lista=r.data||[];
  var ph=usaMotorEnFicha()?"Marca, modelo, color, "+patenteLabel().toLowerCase()+" o cliente":"Nombre, "+patenteLabel().toLowerCase()+", motor o cliente";
  var h="<div class='btns' style='margin:0 0 12px'><button class='btn' id='vNuevo'>"+ic("plus")+(equipoFem()?" Nueva ":" Nuevo ")+equipoLabel().toLowerCase()+"</button><button class='btn o' id='vPat'>"+ic("camera")+" Por foto de "+patenteLabel().toLowerCase()+"</button></div>"+
   buscadorHtml(ph,S.qVehiculos);
  h+=lista.map(function(e){var c=e.clientes||{};
   return "<div class='card' data-q=\""+esc(vehBusqueda(e,c))+"\" style='padding:12px 16px'><button class='item' data-ficha='"+e.id+"'><span><b style='font-family:var(--f-body);font-size:1.05rem'>"+esc(vehTitulo(e))+"</b>"+
    (vehDetalle(e)?"<br><span class='muted'>"+esc(vehDetalle(e))+"</span>":"")+
    "<br><span class='muted'>"+ic("users")+" "+esc(c.nombre||"Sin cliente")+"</span></span>"+
    "<span style='text-align:right'>"+(e.matricula_patente?plateHtml(e.matricula_patente,"sm"):"")+"</span></button></div>"}).join("")||
   vacio("car","Todavía no hay "+(rubroTaller()==="nautica"?"embarcaciones":"vehículos"),"Cargá uno con el botón de arriba o desde la ficha de un cliente.");
  h+="<p id='sinres' class='muted hide'>No hay "+(rubroTaller()==="nautica"?"embarcaciones":"vehículos")+" que coincidan con la búsqueda.</p>";
  document.getElementById("box").outerHTML=h;
  var bv=document.getElementById("buscar");
  bv.oninput=function(){S.qVehiculos=bv.value;filtrarLista(bv.value)};
  filtrarLista(bv.value);
  m.querySelectorAll("[data-ficha]").forEach(function(b){b.onclick=function(){abrirFicha(b.dataset.ficha)}});
  document.getElementById("vNuevo").onclick=function(){abrirVehiculoForm(null,null)};
  document.getElementById("vPat").onclick=function(){S.vista="patente";route()};
}

/* ---------- alta / edición ---------- */
function abrirVehiculoForm(equipoId,clienteId,volverA){S.vehForm={id:equipoId,cliente_id:clienteId,volver:volverA||S.vista};S.vista="vehiculoForm";route();window.scrollTo(0,0)}
function inputVeh(id,label,val,extra){return "<label for='v_"+id+"'>"+label+"</label><input id='v_"+id+"' value=\""+esc(val==null?"":val)+"\""+(extra||"")+">"}
function selectVeh(id,label,val,opciones){
  var ops=opciones.map(function(o){var v=Array.isArray(o)?o[0]:o,t=Array.isArray(o)?o[1]:o;return "<option value=\""+esc(v)+"\""+(String(val||"")===String(v)?" selected":"")+">"+esc(t)+"</option>"}).join("");
  if(val&&!opciones.some(function(o){return (Array.isArray(o)?o[0]:o)===val}))ops+="<option selected>"+esc(val)+"</option>";
  return "<label for='v_"+id+"'>"+label+"</label><select id='v_"+id+"'><option value=''>—</option>"+ops+"</select>"}
async function renderVehiculoForm(){
  var F=S.vehForm||{};
  m.innerHTML="<h1>"+(F.id?"Editar ":equipoFem()?"Nueva ":"Nuevo ")+equipoLabel().toLowerCase()+"</h1><div style='height:12px'></div><div id='box'>"+skel(2)+"</div>";
  var res=await Promise.all([
   F.id?sb.from("equipos").select("*").eq("id",F.id).single():Promise.resolve({data:{cliente_id:F.cliente_id}}),
   sb.from("clientes").select("id,nombre").order("nombre")
  ]);
  if(res[0].error){document.getElementById("box").innerHTML=esc(res[0].error.message);return}
  var e=res[0].data||{},clientes=res[1].data||[],auto=usaMotorEnFicha();
  var h="<div class='card'><h2>Datos</h2>"+
   "<label for='v_cliente'>Cliente</label><select id='v_cliente'><option value=''>— elegir —</option>"+clientes.map(function(c){return "<option value='"+c.id+"'"+(c.id===e.cliente_id?" selected":"")+">"+esc(c.nombre)+"</option>"}).join("")+"</select>"+
   "<div class='g2'><div>"+inputVeh("marca","Marca",e.marca,auto?" placeholder='Toyota'":"")+"</div><div>"+inputVeh("modelo","Modelo",e.modelo,auto?" placeholder='Corolla XEi'":"")+"</div></div>"+
   "<div class='g2'><div>"+inputVeh("anio","Año",e.anio," inputmode='numeric' maxlength='4'")+"</div><div>"+inputVeh("color","Color",e.color)+"</div></div>"+
   "<div class='g2'><div>"+inputVeh("patente",patenteLabel(),e.matricula_patente," autocapitalize='characters' autocomplete='off'")+"</div><div>"+inputVeh("nombre",auto?"Nombre o apodo (opcional)":"Nombre",e.nombre,auto?" placeholder='Si lo dejás vacío se usa marca y modelo'":"")+"</div></div>"+
   inputVeh("vin","N° de chasis / VIN (opcional)",e.vin," autocapitalize='characters' autocomplete='off'")+
   "</div>";
  if(auto)h+="<div class='card'><h2>Motor</h2>"+
   "<div class='g2'><div>"+inputVeh("motor","Motor",e.motor," placeholder='1.8 16v'")+"</div><div>"+inputVeh("cilindrada","Cilindrada",e.cilindrada," placeholder='1798 cc'")+"</div></div>"+
   "<div class='g2'><div>"+selectVeh("combustible","Combustible",e.combustible,COMBUSTIBLES)+"</div><div>"+inputVeh("codigo_motor","Código de motor",e.codigo_motor," autocapitalize='characters' placeholder='2ZR-FE'")+"</div></div></div>"+
   "<div class='card'><h2>Transmisión</h2>"+
   "<div class='g2'><div>"+selectVeh("caja_tipo","Tipo de caja",e.caja_tipo,[["manual","Manual"],["automatica","Automática"]])+"</div><div>"+inputVeh("caja_modelo","Modelo o código de caja",e.caja_modelo," placeholder='U341E'")+"</div></div></div>";
  h+="<div class='card'><h2>Notas</h2><textarea id='v_notas' placeholder='Cualquier dato útil del "+equipoLabel().toLowerCase()+"'>"+esc(e.notas||"")+"</textarea></div>";
  h+="<div id='st' class='status hide'></div><div class='btns'><button class='btn' id='vGuardar'>Guardar</button><button class='btn o' id='vVolver'>Volver</button></div>";
  document.getElementById("box").outerHTML=h;
  document.getElementById("vVolver").onclick=volverDeVehiculo;
  document.getElementById("vGuardar").onclick=async function(){
   function v(id){var el=document.getElementById("v_"+id);return el?el.value.trim():""}
   var data={cliente_id:v("cliente")||null,marca:v("marca")||null,modelo:v("modelo")||null,anio:Number(v("anio"))||null,color:v("color")||null,
    matricula_patente:normPatente(v("patente"))||null,vin:v("vin").toUpperCase()||null,notas:v("notas")||null};
   data.nombre=v("nombre")||[data.marca,data.modelo].filter(Boolean).join(" ")||null;
   if(auto)Object.assign(data,{motor:v("motor")||null,cilindrada:v("cilindrada")||null,combustible:v("combustible")||null,codigo_motor:v("codigo_motor").toUpperCase()||null,caja_tipo:v("caja_tipo")||null,caja_modelo:v("caja_modelo").toUpperCase()||null});
   if(!data.cliente_id){say("st","Elegí el cliente.",true);return}
   if(!data.nombre){say("st","Completá la marca y el modelo"+(auto?"":" o el nombre")+".",true);return}
   this.disabled=true;say("st","Guardando…");
   var r=F.id?await sb.from("equipos").update(data).eq("id",F.id).select("id").single():await sb.from("equipos").insert(Object.assign({taller_id:S.taller.id},data)).select("id").single();
   this.disabled=false;
   if(r.error){say("st",/column|schema cache/i.test(r.error.message)?"Falta correr el SQL nuevo en Supabase (sql/2026-10-06_1_vehiculos.sql).":r.error.message,true);return}
   S.fichaId=r.data.id;S.vista="ficha";route();
  };
}
function volverDeVehiculo(){var F=S.vehForm||{};S.vista=F.volver&&F.volver!=="vehiculoForm"?F.volver:"vehiculos";route()}

/* ---------- tarjetas para la ficha ---------- */
function fichaDatosHtml(e){
  var filas=function(lista){return lista.filter(function(x){return x[1]}).map(function(x){return "<div class='lr' style='border-top:1px solid var(--line);padding:6px 0'><span class='muted'>"+x[0]+"</span><b style='font-family:var(--f-body);text-align:right'>"+esc(x[1])+"</b></div>"}).join("")};
  var datos=filas([["Marca",e.marca],["Modelo",e.modelo],["Año",e.anio],["Color",e.color],["Chasis / VIN",e.vin]]);
  var h="<div class='card'><div class='lr'><h2 style='margin:0'>Datos</h2><button class='btn o' id='fEditar' style='padding:6px 12px;min-height:0'>"+ic("pencil")+" Editar</button></div>"+(datos||"<p class='muted' style='margin:8px 0 0'>Todavía no cargaste marca, modelo ni color.</p>")+"</div>";
  if(usaMotorEnFicha()){
   var mot=filas([["Motor",e.motor],["Cilindrada",e.cilindrada],["Combustible",e.combustible],["Código de motor",e.codigo_motor]]);
   var caja=filas([["Tipo de caja",cajaTxt(e.caja_tipo)],["Modelo / código",e.caja_modelo]]);
   h+="<div class='card'><h2>Motor y transmisión</h2>"+(mot||caja?mot+caja:"<p class='muted' style='margin:0'>Sin datos de motor ni de caja. Tocá <b>Editar</b> para cargarlos.</p>")+"</div>";
  }
  return h;
}
