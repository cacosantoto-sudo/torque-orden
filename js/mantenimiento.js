// Historial de mantenimiento (aceite y filtros, caja automática, distribución),
// próximos services y QR propio de cada vehículo (ficha digital + etiqueta para imprimir).
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.mantForm=renderMantForm;GRUPOS.mantForm="clientes";

var TIPOS_MANT={
  aceite:{nombre:"Service de aceite y filtros",corto:"Aceite de motor",emoji:"🛢️",km:10000,meses:12},
  caja:{nombre:"Service de caja automática",corto:"Aceite caja automática",emoji:"⚙️",km:60000,meses:24},
  distribucion:{nombre:"Distribución",corto:"Distribución",emoji:"🔧",km:60000,meses:48},
  otro:{nombre:"Otro mantenimiento",corto:"Otro",emoji:"🧰"}
};
var ORDEN_TIPOS=["aceite","caja","distribucion"];
var COMPONENTES_DIST=["Correa de distribución","Cadena de distribución","Tensor","Rodillo/s","Bomba de agua","Correa de accesorios","Retenes"];
function fechaAR(f){if(!f)return "";var d=String(f).length===10?new Date(f+"T12:00:00"):new Date(f);return isNaN(d)?String(f):d.toLocaleDateString("es-AR")}
function mesAnio(f){if(!f)return "";var d=new Date(String(f).slice(0,10)+"T12:00:00");var t=d.toLocaleDateString("es-AR",{month:"long",year:"numeric"});return t.charAt(0).toUpperCase()+t.slice(1)}
function kmTxt(n){return n==null||n===""?"":Number(n).toLocaleString("es-AR")+" "+(rubroTaller()==="nautica"?"h":"km")}
function hoyISO(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function sumarMeses(iso,n){var d=new Date((iso||hoyISO())+"T12:00:00");d.setMonth(d.getMonth()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}

// El último registro de cada tipo dice cuándo toca el próximo
function proximosDe(mants){
  var out={};
  (mants||[]).slice().sort(function(a,b){return String(b.fecha).localeCompare(String(a.fecha))||String(b.creado||"").localeCompare(String(a.creado||""))})
   .forEach(function(x){if(x.tipo!=="otro"&&!out[x.tipo])out[x.tipo]=x});
  return out;
}
// Estado de un próximo service según km actual y fecha
function estadoProximo(p,kmActual){
  if(!p||(!p.proximo_km&&!p.proximo_fecha))return null;
  var hoy=new Date(hoyISO()+"T12:00:00"),dias=p.proximo_fecha?Math.round((new Date(p.proximo_fecha+"T12:00:00")-hoy)/864e5):null;
  var faltaKm=p.proximo_km&&kmActual?Number(p.proximo_km)-Number(kmActual):null;
  if((dias!=null&&dias<0)||(faltaKm!=null&&faltaKm<=0))return {cls:"bad",txt:"Vencido"};
  if((dias!=null&&dias<=30)||(faltaKm!=null&&faltaKm<=1000))return {cls:"w",txt:"Por vencer"};
  return {cls:"g",txt:"Al día"};
}
function kmActualDe(ords,mants,motores){
  var v=[0];(ords||[]).forEach(function(o){v.push(Number(o.medidor)||0)});(mants||[]).forEach(function(x){v.push(Number(x.km)||0)});(motores||[]).forEach(function(x){v.push(Number(x.medidor)||0)});
  return Math.max.apply(null,v)||null;
}
function detalleMant(x){
  var d=x.datos||{},L=[];
  if(x.tipo==="aceite"){
   var ac=[d.aceite_marca,d.aceite_tipo,d.viscosidad].filter(Boolean).join(" ");if(ac||d.litros)L.push(["Aceite",ac+(d.litros?" · "+String(d.litros).replace(".",",")+" L":"")]);
   [["filtro_aceite","Filtro de aceite"],["filtro_aire","Filtro de aire"],["filtro_habitaculo","Filtro de habitáculo"],["filtro_combustible","Filtro de combustible"]].forEach(function(f){if(d[f[0]])L.push([f[1],d[f[0]]])});
  }else if(x.tipo==="caja"){
   if(d.atf||d.litros)L.push(["Aceite ATF",[d.atf,d.litros?String(d.litros).replace(".",",")+" L":""].filter(Boolean).join(" · ")]);
   L.push(["Filtro",d.filtro?d.filtro:"No se reemplazó"]);
  }else if(x.tipo==="distribucion"){
   var comp=(d.componentes||[]).concat(d.otros?[d.otros]:[]);if(comp.length)L.push(["Componentes",comp.join(", ")]);
  }else if(d.descripcion)L.push(["Trabajo",d.descripcion]);
  return L;
}

/* ---------- tarjetas para la ficha (app) ---------- */
function fichaProximosHtml(mants,kmActual){
  var P=proximosDe(mants);
  var filas=ORDEN_TIPOS.filter(function(t){return P[t]&&(P[t].proximo_km||P[t].proximo_fecha)}).map(function(t){
   var p=P[t],est=estadoProximo(p,kmActual);
   return "<div style='border-top:1px solid var(--line);padding:10px 0'><div class='lr'><b style='font-family:var(--f-head);text-transform:uppercase;letter-spacing:.04em;font-size:1.05rem'>"+TIPOS_MANT[t].emoji+" "+TIPOS_MANT[t].corto+"</b>"+(est?"<span class='tag "+(est.cls==="bad"?"bad":est.cls)+"'>"+est.txt+"</span>":"")+"</div>"+
    (p.proximo_km?"<div>Próximo: <b>"+kmTxt(p.proximo_km)+"</b></div>":"")+(p.proximo_fecha?"<div>Fecha límite: <b>"+fechaAR(p.proximo_fecha)+"</b></div>":"")+"</div>"}).join("");
  return "<div class='card'><h2>Próximos servicios</h2>"+(kmActual?"<p class='muted' style='margin:-4px 0 4px'>Último "+(rubroTaller()==="nautica"?"registro de horas":"kilometraje registrado")+": <b>"+kmTxt(kmActual)+"</b></p>":"")+
   (filas||"<p class='muted' style='margin:0'>Cargá un service para que se calculen solos.</p>")+"</div>";
}
function fichaMantHtml(mants){
  var lista=(mants||[]).slice().sort(function(a,b){return String(b.fecha).localeCompare(String(a.fecha))});
  return "<div class='card'><div class='lr'><h2 style='margin:0'>Historial de mantenimiento</h2><button class='btn' id='fMant' style='padding:6px 12px;min-height:0'>"+ic("plus")+" Service</button></div>"+
   (lista.length?lista.map(function(x){
    return "<button class='item' data-mant='"+x.id+"' style='border-top:1px solid var(--line);padding:10px 0;margin-top:6px'><span><b style='font-family:var(--f-body)'>"+(TIPOS_MANT[x.tipo]||TIPOS_MANT.otro).emoji+" "+esc((TIPOS_MANT[x.tipo]||TIPOS_MANT.otro).nombre)+"</b><br>"+
     "<span class='muted'>"+fechaAR(x.fecha)+(x.km?" · "+kmTxt(x.km):"")+"</span>"+
     detalleMant(x).map(function(l){return "<br><span style='font-size:.9rem'><span class='muted'>"+l[0]+":</span> "+esc(l[1])+"</span>"}).join("")+
     (x.proximo_km||x.proximo_fecha?"<br><span style='font-size:.9rem'><span class='muted'>Próximo:</span> "+[kmTxt(x.proximo_km),x.proximo_fecha?"límite "+fechaAR(x.proximo_fecha):""].filter(Boolean).join(" · ")+"</span>":"")+
     "</span><span class='muted'>›</span></button>"}).join(""):"<p class='muted' style='margin:10px 0 0'>Todavía no hay services cargados.</p>")+"</div>";
}
function conectarFichaMant(e,kmActual){
  var b=document.getElementById("fMant");if(b)b.onclick=function(){abrirMantForm({equipo_id:e.id,km:kmActual||null},e)};
  m.querySelectorAll("[data-mant]").forEach(function(x){x.onclick=function(){abrirMantForm({id:x.dataset.mant},e)}});
}

/* ---------- formulario de service ---------- */
function abrirMantForm(datos,equipo,volver){S.mant={datos:datos,equipo:equipo,volver:volver||S.vista};S.vista="mantForm";route();window.scrollTo(0,0)}
async function renderMantForm(){
  var M=S.mant||{},x=Object.assign({tipo:"aceite",fecha:hoyISO(),datos:{}},M.datos||{});
  m.innerHTML="<h1>"+(x.id?"Editar service":"Cargar service")+"</h1><p class='muted'>"+esc(vehTitulo(M.equipo))+(M.equipo&&M.equipo.matricula_patente?" · "+esc(M.equipo.matricula_patente):"")+"</p><div id='box'>"+skel(2)+"</div>";
  if(x.id){var r=await sb.from("mantenimientos").select("*").eq("id",x.id).single();if(r.error){document.getElementById("box").innerHTML=esc(r.error.message);return}x=r.data;x.datos=x.datos||{}}
  var d=x.datos,tocadoKm=!!x.id,tocadoFecha=!!x.id;
  function inp(id,label,val,extra){return "<label for='mt_"+id+"'>"+label+"</label><input id='mt_"+id+"' value=\""+esc(val==null?"":val)+"\""+(extra||"")+">"}
  function camposTipo(t){
   if(t==="aceite")return "<div class='g2'><div>"+inp("aceite_marca","Marca de aceite",d.aceite_marca," placeholder='Shell Helix'")+"</div><div>"+
     "<label for='mt_aceite_tipo'>Tipo</label><select id='mt_aceite_tipo'><option value=''>—</option>"+["Sintético","Semisintético","Mineral"].map(function(o){return "<option"+(d.aceite_tipo===o?" selected":"")+">"+o+"</option>"}).join("")+"</select></div></div>"+
     "<div class='g2'><div>"+inp("viscosidad","Viscosidad",d.viscosidad," placeholder='5W-30' autocapitalize='characters'")+"</div><div>"+inp("litros","Cantidad (litros)",d.litros," inputmode='decimal' placeholder='4,2'")+"</div></div>"+
     "<p class='muted' style='margin:14px 0 0'>Filtros: escribí marca o código del que pusiste. Si no se cambió, dejalo vacío.</p>"+
     "<div class='g2'><div>"+inp("filtro_aceite","Filtro de aceite",d.filtro_aceite)+"</div><div>"+inp("filtro_aire","Filtro de aire",d.filtro_aire)+"</div></div>"+
     "<div class='g2'><div>"+inp("filtro_habitaculo","Filtro de habitáculo",d.filtro_habitaculo)+"</div><div>"+inp("filtro_combustible","Filtro de combustible",d.filtro_combustible)+"</div></div>";
   if(t==="caja")return "<div class='g2'><div>"+inp("atf","Aceite ATF utilizado",d.atf," placeholder='Dexron VI'")+"</div><div>"+inp("litros","Cantidad (litros)",d.litros," inputmode='decimal'")+"</div></div>"+
     inp("filtro","Filtro reemplazado (marca o código; vacío si no se cambió)",d.filtro);
   if(t==="distribucion")return "<label>Componentes reemplazados</label><div style='display:grid;grid-template-columns:1fr 1fr;gap:6px'>"+COMPONENTES_DIST.map(function(c,i){
     return "<label style='display:flex;align-items:center;gap:8px;margin:0;text-transform:none;letter-spacing:0;font-family:var(--f-body);font-weight:500;color:var(--ink);min-height:40px'><input type='checkbox' data-comp=\""+esc(c)+"\""+((d.componentes||[]).indexOf(c)>=0?" checked":"")+" style='width:22px;min-height:22px'>"+esc(c)+"</label>"}).join("")+"</div>"+
     inp("otros","Otros componentes",d.otros);
   return "<label for='mt_descripcion'>Qué se hizo</label><textarea id='mt_descripcion'>"+esc(d.descripcion||"")+"</textarea>";
  }
  var h="<div class='card'><label for='mt_tipo'>Tipo de service</label><select id='mt_tipo'>"+Object.keys(TIPOS_MANT).map(function(t){return "<option value='"+t+"'"+(x.tipo===t?" selected":"")+">"+TIPOS_MANT[t].emoji+" "+TIPOS_MANT[t].nombre+"</option>"}).join("")+"</select>"+
   "<div class='g2'><div><label for='mt_fecha'>Fecha</label><input id='mt_fecha' type='date' value='"+esc(x.fecha||hoyISO())+"'></div><div>"+inp("km",medidorLabel(),x.km," inputmode='numeric'")+"</div></div></div>"+
   "<div class='card'><h2 id='mt_titDet'>Detalle</h2><div id='mt_det'>"+camposTipo(x.tipo)+"</div></div>"+
   "<div class='card' id='mt_prox'><h2>Próximo service</h2><div class='g2'><div>"+inp("proximo_km","Próximo a los ("+(rubroTaller()==="nautica"?"horas":"km")+")",x.proximo_km," inputmode='numeric'")+"</div><div><label for='mt_proximo_fecha'>Fecha límite</label><input id='mt_proximo_fecha' type='date' value='"+esc(x.proximo_fecha||"")+"'></div></div>"+
   "<p class='muted' id='mt_sug' style='margin:6px 0 0'></p></div>"+
   "<div class='card'><label for='mt_obs' style='margin-top:0'>Observaciones</label><textarea id='mt_obs'>"+esc(x.observaciones||"")+"</textarea></div>"+
   "<div id='st' class='status hide'></div><div class='btns'><button class='btn' id='mtGuardar'>Guardar</button><button class='btn o' id='mtVolver'>Volver</button>"+(x.id?"<button class='btn d' id='mtBorrar'>Eliminar</button>":"")+"</div>";
  document.getElementById("box").outerHTML=h;
  var selTipo=document.getElementById("mt_tipo");
  function sugerir(){
   var t=TIPOS_MANT[selTipo.value],km=Number(document.getElementById("mt_km").value),f=document.getElementById("mt_fecha").value;
   document.getElementById("mt_prox").classList.toggle("hide",selTipo.value==="otro");
   if(!t.km){document.getElementById("mt_sug").textContent="";return}
   if(!tocadoKm&&km)document.getElementById("mt_proximo_km").value=km+t.km;
   if(!tocadoFecha&&f)document.getElementById("mt_proximo_fecha").value=sumarMeses(f,t.meses);
   document.getElementById("mt_sug").textContent="Se sugiere cada "+t.km.toLocaleString("es-AR")+" km o "+t.meses+" meses. Podés cambiarlo.";
  }
  selTipo.onchange=function(){d={};document.getElementById("mt_det").innerHTML=camposTipo(selTipo.value);if(!x.id){tocadoKm=false;tocadoFecha=false}sugerir()};
  document.getElementById("mt_km").oninput=sugerir;document.getElementById("mt_fecha").onchange=sugerir;
  document.getElementById("mt_proximo_km").oninput=function(){tocadoKm=true};document.getElementById("mt_proximo_fecha").onchange=function(){tocadoFecha=true};
  sugerir();
  document.getElementById("mtVolver").onclick=volverDeMant;
  var bb=document.getElementById("mtBorrar");if(bb)bb.onclick=async function(){
   if(!confirm("¿Eliminar este service del historial?"))return;
   var r=await sb.from("mantenimientos").delete().eq("id",x.id);if(r.error){say("st",r.error.message,true);return}volverDeMant()};
  document.getElementById("mtGuardar").onclick=async function(){
   function v(id){var el=document.getElementById("mt_"+id);return el?el.value.trim():""}
   var tipo=selTipo.value,datos={};
   if(tipo==="aceite")["aceite_marca","aceite_tipo","viscosidad","litros","filtro_aceite","filtro_aire","filtro_habitaculo","filtro_combustible"].forEach(function(k){if(v(k))datos[k]=v(k)});
   else if(tipo==="caja")["atf","litros","filtro"].forEach(function(k){if(v(k))datos[k]=v(k)});
   else if(tipo==="distribucion"){datos.componentes=[].slice.call(m.querySelectorAll("[data-comp]:checked")).map(function(c){return c.dataset.comp});if(v("otros"))datos.otros=v("otros")}
   else if(v("descripcion"))datos.descripcion=v("descripcion");
   if(datos.viscosidad)datos.viscosidad=datos.viscosidad.toUpperCase();
   var data={tipo:tipo,fecha:v("fecha")||hoyISO(),km:Number(v("km").replace(/\./g,""))||null,datos:datos,
    proximo_km:tipo==="otro"?null:Number(v("proximo_km").replace(/\./g,""))||null,proximo_fecha:tipo==="otro"?null:v("proximo_fecha")||null,observaciones:v("obs")||null};
   this.disabled=true;say("st","Guardando…");
   var r=x.id?await sb.from("mantenimientos").update(data).eq("id",x.id):await sb.from("mantenimientos").insert(Object.assign({taller_id:S.taller.id,equipo_id:x.equipo_id,orden_id:x.orden_id||null},data));
   this.disabled=false;
   if(r.error){say("st",/mantenimientos|schema cache|does not exist/i.test(r.error.message)?"Falta correr el SQL nuevo en Supabase (sql/2026-10-06_2_mantenimiento_y_qr.sql).":r.error.message,true);return}
   volverDeMant();
  };
}
function volverDeMant(){var M=S.mant||{};if(M.volver==="ordenForm"){S.vista="ordenForm"}else{S.fichaId=(M.equipo&&M.equipo.id)||S.fichaId;S.vista="ficha"}route()}

/* ---------- QR del vehículo ---------- */
function urlBase(){return location.origin+location.pathname.replace(/[^/]*$/,"")}
function urlFicha(token){return urlBase()+"ficha.html?t="+token}
function qrHtml(texto,px){
  if(window.qrcode){try{var q=qrcode(0,"M");q.addData(texto);q.make();var n=q.getModuleCount(),c=Math.max(2,Math.floor(px/(n+8)));
   return q.createSvgTag({cellSize:c,margin:4,scalable:true}).replace("<svg ","<svg role='img' aria-label='Código QR' style='width:"+px+"px;height:"+px+"px;background:#fff' ")}catch(e){}}
  return "<img src='https://api.qrserver.com/v1/create-qr-code/?size="+px*2+"x"+px*2+"&data="+encodeURIComponent(texto)+"' width='"+px+"' height='"+px+"' alt='Código QR' style='background:#fff'>";
}
function verQRVehiculo(e,tel){
  var url=urlFicha(e.qr_token),etq=urlBase()+"etiqueta.html?t="+e.qr_token;
  var prev=document.getElementById("qrVeh");if(prev)prev.remove();
  var msg="Hola, te pasamos la ficha digital de tu "+vehTitulo(e)+" con el historial de mantenimiento y el próximo service:\n"+url;
  m.insertAdjacentHTML("afterbegin","<div class='card qr' id='qrVeh'><b>Ficha digital de "+esc(vehTitulo(e))+"</b><div style='background:#fff;padding:8px;border-radius:8px;line-height:0'>"+qrHtml(url,180)+"</div>"+
   "<a class='link' href='"+url+"' target='_blank' rel='noopener'>"+esc(url)+"</a><div class='btns' style='justify-content:center'>"+
   "<a class='btn' href='"+etq+"' target='_blank' rel='noopener'>"+ic("printer")+" Imprimir etiqueta</a>"+
   (tel?"<a class='btn o' target='_blank' rel='noopener' href='https://wa.me/"+tel+"?text="+encodeURIComponent(msg)+"'>"+ic("message")+" Mandar por WhatsApp</a>":"")+
   "<button class='btn o' onclick='this.closest(\".card\").remove()'>Cerrar</button></div></div>");
  window.scrollTo(0,0);
}

/* ---------- services por vencer (panel) ---------- */
async function cargarServicesPorVencer(){
  var box=document.getElementById("vencBox");if(!box)return;
  var r=await sb.from("mantenimientos").select("id,equipo_id,tipo,fecha,km,proximo_km,proximo_fecha,creado,equipos(id,nombre,marca,modelo,matricula_patente,clientes(nombre,telefono))");
  if(!document.getElementById("vencBox"))return;
  if(r.error){box.remove();return}
  var porEq={};(r.data||[]).forEach(function(x){(porEq[x.equipo_id]=porEq[x.equipo_id]||[]).push(x)});
  var hoy=new Date(hoyISO()+"T12:00:00"),lista=[];
  Object.keys(porEq).forEach(function(k){var P=proximosDe(porEq[k]);ORDEN_TIPOS.forEach(function(t){var p=P[t];if(!p||!p.proximo_fecha)return;
   var dias=Math.round((new Date(p.proximo_fecha+"T12:00:00")-hoy)/864e5);if(dias<=30)lista.push({p:p,t:t,dias:dias})})});
  lista.sort(function(a,b){return a.dias-b.dias});
  var h="<h2>Services por vencer</h2><p class='muted' style='margin-top:0'>Vencidos o con fecha límite en los próximos 30 días.</p>";
  h+=lista.length?lista.map(function(x){var e=x.p.equipos||{},c=e.clientes||{},tel=telWa(c.telefono);
   var msg="Hola"+(c.nombre?" "+c.nombre.split(" ")[0]:"")+", te escribimos de "+(S.taller.nombre||"el taller")+". Te recordamos que "+(x.dias<0?"ya venció":"se acerca")+" el "+TIPOS_MANT[x.t].corto.toLowerCase()+" de tu "+vehTitulo(e)+(x.p.proximo_km?" (a los "+kmTxt(x.p.proximo_km)+")":"")+", fecha límite "+fechaAR(x.p.proximo_fecha)+". ¿Coordinamos un turno?";
   return "<div style='border-top:1px solid var(--line);padding:10px 0'><div class='lr'><button class='link' data-ficha='"+e.id+"' style='background:none;border:0;padding:0;min-height:44px;font-weight:700;text-align:left;color:var(--ac)'>"+esc(vehTitulo(e))+(e.matricula_patente?" · "+esc(e.matricula_patente):"")+"</button><span class='tag "+(x.dias<0?"bad":"w")+"'>"+(x.dias<0?"Vencido":"en "+x.dias+(x.dias===1?" día":" días"))+"</span></div>"+
    "<span class='muted'>"+TIPOS_MANT[x.t].emoji+" "+TIPOS_MANT[x.t].corto+" · límite "+fechaAR(x.p.proximo_fecha)+(x.p.proximo_km?" · "+kmTxt(x.p.proximo_km):"")+" · "+esc(c.nombre||"")+"</span>"+
    (tel?"<div class='btns' style='margin-top:8px'><a class='btn o' style='padding:6px 12px;min-height:0' target='_blank' rel='noopener' href='https://wa.me/"+tel+"?text="+encodeURIComponent(msg)+"'>"+ic("message")+" Avisar por WhatsApp</a></div>":"")+"</div>"}).join(""):"<p class='muted' style='margin:0'>No hay services por vencer.</p>";
  box.innerHTML=h;
  box.querySelectorAll("[data-ficha]").forEach(function(b){b.onclick=function(){abrirFicha(b.dataset.ficha)}});
}
