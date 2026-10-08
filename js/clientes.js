// Edición completa de los datos de un cliente. Se modifica el mismo registro,
// así que las órdenes, el historial y los vehículos siguen asociados.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.clienteForm=renderClienteForm;GRUPOS.clienteForm="clientes";

var CAMPOS_CLIENTE=[["nombre","Nombre y apellido"],["telefono","Teléfono","tel"],["email","Email","email"],["dni_cuit","DNI / CUIT"],["direccion","Domicilio"],["localidad","Localidad"],["observaciones","Observaciones","t"]];
function editarCliente(id,volver){S.clienteEdit=id;S.volverCliente=volver||S.vista;S.vista="clienteForm";route();window.scrollTo(0,0)}
// Línea con los datos de contacto que se muestra en la tarjeta del cliente
function datosClienteTxt(c){return [c.telefono,c.email,[c.direccion,c.localidad].filter(Boolean).join(", "),c.dni_cuit&&"DNI/CUIT "+c.dni_cuit].filter(Boolean).join(" · ")}

async function renderClienteForm(){
  m.innerHTML="<h1>Editar cliente</h1><div id='box'>"+skel()+"</div>";
  var r=await sb.from("clientes").select("*,equipos(id,nombre,marca,modelo,matricula_patente)").eq("id",S.clienteEdit).single();
  if(r.error){document.getElementById("box").innerHTML=esc(r.error.message);return}
  var c=r.data,nOt=await sb.from("ordenes").select("id",{count:"exact",head:true}).eq("cliente_id",c.id);
  var h="<div class='card'>"+CAMPOS_CLIENTE.map(function(f){var v=c[f[0]];
   return "<label for='cl_"+f[0]+"'>"+f[1]+"</label>"+(f[2]==="t"?"<textarea id='cl_"+f[0]+"'>"+esc(v)+"</textarea>":"<input id='cl_"+f[0]+"'"+(f[2]?" type='"+f[2]+"'":"")+" value=\""+esc(v)+"\">")}).join("")+
   "<div id='clSt' class='status hide'></div><div class='btns'><button class='btn' id='clGuardar'>Guardar cambios</button><button class='btn o' id='clVolver'>Volver</button></div></div>";
  var eqs=c.equipos||[];
  h+="<div class='card'><h2>Lo que queda asociado</h2><p class='muted' style='margin:0'>"+(eqs.length?eqs.map(function(e){return esc(vehTitulo(e))+(e.matricula_patente?" "+esc(e.matricula_patente):"")}).join(" · "):"Sin "+equipoPlural()+" cargados")+
   (nOt.count!=null?"<br>"+nOt.count+" orden"+(nOt.count===1?"":"es")+" de trabajo":"")+"</p><p class='muted' style='font-size:.85rem;margin:8px 0 0'>Cambiar los datos no borra nada: el historial y los "+equipoPlural()+" siguen con este cliente.</p></div>";
  document.getElementById("box").outerHTML=h;
  document.getElementById("clVolver").onclick=function(){S.vista=S.volverCliente||"clientes";route()};
  document.getElementById("clGuardar").onclick=async function(){
   var d={};CAMPOS_CLIENTE.forEach(function(f){d[f[0]]=document.getElementById("cl_"+f[0]).value.trim()||null});
   if(!d.nombre){say("clSt","El nombre no puede quedar vacío.",true);return}
   d.telefono=d.telefono||"";
   this.disabled=true;
   var u=await sb.from("clientes").update(d).eq("id",c.id);
   this.disabled=false;
   if(u.error&&/column|schema cache/i.test(u.error.message)){
    // Sin el SQL nuevo solo existen nombre y teléfono: se guardan esos y se avisa
    var u2=await sb.from("clientes").update({nombre:d.nombre,telefono:d.telefono}).eq("id",c.id);
    say("clSt",(u2.error?u2.error.message:"Se guardaron el nombre y el teléfono.")+" Para guardar email, domicilio y demás datos falta correr el SQL nuevo en Supabase (sql/2026-10-08_modificaciones.sql).",true);return}
   if(u.error){say("clSt",u.error.message,true);return}
   S.vista=S.volverCliente||"clientes";route();
  };
}
