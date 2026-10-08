// Turnos: calendario del mes editable. Se toca un día y se anotan el cliente, el vehículo,
// la fecha y la hora del turno. Se puede editar, borrar y avisar al cliente por WhatsApp.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.turnos=renderTurnos;GRUPOS.turnos="turnos";
var FALTA_SQL_TUR="Para usar los turnos falta correr en Supabase el SQL sql/2026-10-08_2_articulos_listas_turnos.sql.";
var MESES_LARGO=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
var DIAS_LARGO=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function isoDe(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function fechaDeIso(s){var p=String(s).split("-");return new Date(Number(p[0]),Number(p[1])-1,Number(p[2]))}
function horaCorta(h){return String(h||"").slice(0,5)}
function diaLargo(iso){var d=fechaDeIso(iso);return DIAS_LARGO[d.getDay()]+" "+d.getDate()+" de "+MESES_LARGO[d.getMonth()]}
// Desde el lunes de la semana del día 1 hasta completar 6 semanas
function rangoCalendario(anio,mes){var ini=new Date(anio,mes,1);ini.setDate(1-((ini.getDay()+6)%7));var fin=new Date(ini);fin.setDate(ini.getDate()+41);return {ini:ini,fin:fin}}

async function renderTurnos(){
  if(!S.tDia)S.tDia=hoyISO();
  var dSel=fechaDeIso(S.tDia);
  if(S.tAnio==null){S.tAnio=dSel.getFullYear();S.tMes=dSel.getMonth()}
  m.innerHTML="<h1>Turnos</h1><div id='box'>"+skel(2,140)+"</div>";
  var rg=rangoCalendario(S.tAnio,S.tMes);
  var r=await Promise.all([
   sb.from("turnos").select("*").gte("fecha",isoDe(rg.ini)).lte("fecha",isoDe(rg.fin)).order("fecha").order("hora"),
   S.tClientes?Promise.resolve(null):sb.from("clientes").select("id,nombre,telefono,equipos(id,nombre,marca,modelo,matricula_patente)").order("nombre")]);
  var box=document.getElementById("box");if(!box)return;
  if(r[0].error){box.innerHTML="<div class='status err'>"+FALTA_SQL_TUR+"</div>";return}
  S.turnos=r[0].data||[];
  if(r[1])S.tClientes=r[1].error?[]:(r[1].data||[]);
  box.outerHTML="<div class='card' id='calBox'></div><div class='card' id='diaBox'></div><div class='card' id='turnoForm'></div>";
  pintarCalendario();pintarDia();pintarFormTurno();
}
function pintarCalendario(){
  var porDia={};S.turnos.forEach(function(t){porDia[t.fecha]=(porDia[t.fecha]||0)+1});
  var rg=rangoCalendario(S.tAnio,S.tMes),hoy=hoyISO(),celdas="";
  for(var i=0;i<42;i++){
   var d=new Date(rg.ini);d.setDate(rg.ini.getDate()+i);var iso=isoDe(d),n=porDia[iso]||0;
   celdas+="<button type='button' class='cal-d"+(d.getMonth()!==S.tMes?" fuera":"")+(iso===hoy?" hoy":"")+(iso===S.tDia?" sel":"")+"' data-dia='"+iso+"' aria-label='"+diaLargo(iso)+(n?", "+n+" turno"+(n>1?"s":""):"")+"'"+(iso===S.tDia?" aria-pressed='true'":"")+">"+
    "<span>"+d.getDate()+"</span>"+(n?"<em>"+n+"</em>":"")+"</button>";
  }
  var cal=document.getElementById("calBox");
  cal.innerHTML="<div class='lr' style='margin-bottom:10px'><button class='btn o icon' id='calAnt' aria-label='Mes anterior' title='Mes anterior'>"+ic("chevronL")+"</button>"+
   "<h2 style='margin:0;text-align:center;flex:1;justify-content:center'>"+MESES_LARGO[S.tMes]+" "+S.tAnio+"</h2>"+
   "<button class='btn o icon' id='calSig' aria-label='Mes siguiente' title='Mes siguiente'>"+ic("chevron")+"</button></div>"+
   "<div class='cal'>"+["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(function(x){return "<b>"+x+"</b>"}).join("")+celdas+"</div>"+
   "<div class='btns' style='margin-top:10px'><button class='btn o' id='calHoy'>Hoy</button></div>";
  document.getElementById("calAnt").onclick=function(){moverMes(-1)};
  document.getElementById("calSig").onclick=function(){moverMes(1)};
  document.getElementById("calHoy").onclick=function(){S.tDia=hoyISO();var d=new Date();S.tAnio=d.getFullYear();S.tMes=d.getMonth();S.tEdit=null;renderTurnos()};
  cal.querySelectorAll("[data-dia]").forEach(function(b){b.onclick=function(){
   var iso=b.dataset.dia,d=fechaDeIso(iso);S.tDia=iso;S.tEdit=null;
   if(d.getMonth()!==S.tMes){S.tAnio=d.getFullYear();S.tMes=d.getMonth();renderTurnos();return}
   pintarCalendario();pintarDia();pintarFormTurno();
  }});
}
function moverMes(n){var d=new Date(S.tAnio,S.tMes+n,1);S.tAnio=d.getFullYear();S.tMes=d.getMonth();S.tDia=isoDe(d);S.tEdit=null;renderTurnos()}
function mensajeTurno(t){return "Hola "+t.cliente_nombre+", te recordamos tu turno en "+S.taller.nombre+" el "+diaLargo(t.fecha)+" a las "+horaCorta(t.hora)+" hs"+(t.vehiculo?" para "+t.vehiculo:"")+". ¡Te esperamos!"}
function pintarDia(){
  var lista=S.turnos.filter(function(t){return t.fecha===S.tDia});
  var cont=document.getElementById("diaBox");
  cont.innerHTML="<h2 style='text-transform:none'>"+diaLargo(S.tDia).replace(/^./,function(c){return c.toUpperCase()})+"</h2>"+
   (lista.length?lista.map(function(t){var tel=telWa(t.telefono);
    return "<div style='border-top:1px solid var(--line);padding:8px 0' data-turno='"+t.id+"'><div class='lr' style='align-items:flex-start'><span><b style='font-family:var(--f-mono)'>"+horaCorta(t.hora)+"</b> · <b>"+esc(t.cliente_nombre)+"</b>"+
     (t.vehiculo?"<br><span class='muted'>"+esc(t.vehiculo)+"</span>":"")+(t.nota?"<br><span class='muted' style='font-size:.9rem'>"+esc(t.nota)+"</span>":"")+"</span>"+
     "<span style='display:flex;gap:6px'>"+(tel?"<a class='btn o icon' style='padding:4px 10px;min-height:0' target='_blank' rel='noopener' href='https://wa.me/"+tel+"?text="+encodeURIComponent(mensajeTurno(t))+"' aria-label='Avisar por WhatsApp' title='Avisar por WhatsApp'>"+ic("message")+"</a>":"")+
     "<button class='btn o icon' data-t-edit='"+t.id+"' style='padding:4px 10px;min-height:0' aria-label='Editar turno' title='Editar'>"+ic("pencil")+"</button>"+
     "<button class='btn o icon del' data-t-del='"+t.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar turno' title='Eliminar'>"+ic("trash")+"</button></span></div></div>"}).join("")
   :"<p class='muted' style='margin:0'>No hay turnos este día. Cargá uno abajo.</p>");
  cont.querySelectorAll("[data-t-edit]").forEach(function(b){b.onclick=function(){S.tEdit=b.dataset.tEdit;pintarFormTurno();document.getElementById("turnoForm").scrollIntoView({behavior:"smooth",block:"start"})}});
  cont.querySelectorAll("[data-t-del]").forEach(function(b){b.onclick=function(){var id=b.dataset.tDel;
   borrarConDeshacer("Turno eliminado",cont.querySelector("[data-turno='"+id+"']"),function(){return sb.from("turnos").delete().eq("id",id)},renderTurnos)}});
}
function clientePorNombre(n){var k=norm(n).trim();return k?(S.tClientes||[]).filter(function(c){return norm(c.nombre).trim()===k})[0]||null:null}
function vehiculoTxt(e){return [vehTitulo(e),e.matricula_patente?String(e.matricula_patente).toUpperCase():""].filter(Boolean).join(" · ")}
function pintarFormTurno(){
  var t=S.tEdit?S.turnos.filter(function(x){return x.id===S.tEdit})[0]:null;if(S.tEdit&&!t)S.tEdit=null;
  var f=t||{fecha:S.tDia,hora:"09:00",cliente_nombre:"",telefono:"",vehiculo:"",nota:""};
  var cont=document.getElementById("turnoForm");
  cont.innerHTML="<h2>"+(t?"Editar turno":"Nuevo turno")+"</h2>"+
   "<label for='tuCli'>Cliente</label><input id='tuCli' list='tuCliList' autocomplete='off' value=\""+esc(f.cliente_nombre)+"\" placeholder='Nombre del cliente'>"+
   "<datalist id='tuCliList'>"+(S.tClientes||[]).map(function(c){return "<option value=\""+esc(c.nombre)+"\">"}).join("")+"</datalist>"+
   "<label for='tuTel'>Teléfono</label><input id='tuTel' type='tel' value=\""+esc(f.telefono)+"\" placeholder='Opcional, para avisarle por WhatsApp'>"+
   "<label for='tuVeh'>"+(rubroTaller()==="nautica"?"Embarcación":"Vehículo")+"</label><input id='tuVeh' list='tuVehList' autocomplete='off' value=\""+esc(f.vehiculo)+"\" placeholder='Ej.: Gol Trend AB123CD'><datalist id='tuVehList'></datalist>"+
   "<div class='g2'><div><label for='tuFecha'>Fecha</label><input id='tuFecha' type='date' value='"+esc(f.fecha)+"'></div><div><label for='tuHora'>Hora</label><input id='tuHora' type='time' step='300' value='"+esc(horaCorta(f.hora))+"'></div></div>"+
   "<label for='tuNota'>Nota</label><input id='tuNota' value=\""+esc(f.nota)+"\" placeholder='Opcional: qué trabajo, service, etc.'>"+
   "<div id='tuSt' class='status hide'></div><div class='btns'><button class='btn' id='tuGuardar'>"+(t?"Guardar cambios":"Agendar turno")+"</button>"+(t?"<button class='btn o' id='tuCancelar'>Cancelar</button>":"")+"</div>";
  var cli=document.getElementById("tuCli");
  function alElegirCliente(){
   var c=clientePorNombre(cli.value),tel=document.getElementById("tuTel");
   document.getElementById("tuVehList").innerHTML=c?(c.equipos||[]).map(function(e){return "<option value=\""+esc(vehiculoTxt(e))+"\">"}).join(""):"";
   if(c&&!tel.value&&c.telefono)tel.value=c.telefono;
   if(c&&!document.getElementById("tuVeh").value&&(c.equipos||[]).length===1)document.getElementById("tuVeh").value=vehiculoTxt(c.equipos[0]);
  }
  cli.onchange=alElegirCliente;cli.oninput=function(){if(clientePorNombre(cli.value))alElegirCliente()};
  if(f.cliente_nombre)alElegirCliente();
  var bc=document.getElementById("tuCancelar");if(bc)bc.onclick=function(){S.tEdit=null;pintarFormTurno()};
  document.getElementById("tuGuardar").onclick=async function(){
   var nom=cli.value.trim(),fecha=document.getElementById("tuFecha").value,hora=document.getElementById("tuHora").value;
   if(!nom){say("tuSt","Escribí el nombre del cliente.",true);return}
   if(!fecha||!hora){say("tuSt","Poné la fecha y la hora del turno.",true);return}
   var c=clientePorNombre(nom);
   var d={cliente_nombre:nom,cliente_id:c?c.id:null,telefono:document.getElementById("tuTel").value.trim()||null,vehiculo:document.getElementById("tuVeh").value.trim()||null,
    fecha:fecha,hora:hora,nota:document.getElementById("tuNota").value.trim()||null};
   var choca=S.turnos.filter(function(x){return x.fecha===fecha&&horaCorta(x.hora)===hora&&x.id!==S.tEdit})[0];
   this.disabled=true;
   var r=t?await sb.from("turnos").update(d).eq("id",t.id):await sb.from("turnos").insert(Object.assign({taller_id:S.taller.id},d));
   this.disabled=false;
   if(r.error){say("tuSt",r.error.message,true);return}
   S.tEdit=null;S.tDia=fecha;var fd=fechaDeIso(fecha);S.tAnio=fd.getFullYear();S.tMes=fd.getMonth();
   await renderTurnos();
   if(choca)say("tuSt","Turno guardado. Ojo: a esa misma hora ya estaba el turno de "+choca.cliente_nombre+".");
  };
}

/* ---------- turnos de hoy en el panel ---------- */
async function cargarTurnosHoyPanel(){
  var el=document.getElementById("turHoyBox");if(!el)return;
  var r=await sb.from("turnos").select("*").eq("fecha",hoyISO()).order("hora");
  el=document.getElementById("turHoyBox");if(!el)return;
  if(r.error){el.remove();return}
  el.innerHTML="<h2>Turnos de hoy</h2>"+((r.data||[]).length?r.data.map(function(t){return "<div class='lr' style='border-top:1px solid var(--line);padding:8px 0'><span><b style='font-family:var(--f-mono)'>"+horaCorta(t.hora)+"</b> · "+esc(t.cliente_nombre)+(t.vehiculo?" <span class='muted'>· "+esc(t.vehiculo)+"</span>":"")+"</span></div>"}).join(""):"<p class='muted' style='margin:0'>No hay turnos para hoy.</p>")+
   "<div class='btns' style='margin-top:8px'><button class='btn o' id='irTurnos'>"+ic("calendar")+" Ver turnos</button></div>";
  document.getElementById("irTurnos").onclick=function(){S.tDia=hoyISO();S.tAnio=null;S.vista="turnos";route();window.scrollTo(0,0)};
}
