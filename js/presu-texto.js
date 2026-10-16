/* Torque & Orden — pegar un presupuesto náutico escrito como texto (formato WhatsApp, con *negritas*)
   y volcarlo en la planilla de presupuestos. Se lee en el teléfono, sin IA: cliente, motor, título,
   resumen, repuestos con importes, trabajos de mano de obra con su detalle, observación y totales. */
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.presuTexto=renderPresuTexto;GRUPOS.presuTexto="ordenes";

// "$20.000" -> 20000 · "$1.234,50" -> 1234.5
function montoTexto(s){
  s=String(s||"").replace(/[^\d.,]/g,"");if(!s)return 0;
  if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,"").replace(",",".");
  else if(/\.\d{1,2}$/.test(s)&&!/\.\d{3}/.test(s))s=s.replace(/,/g,"");
  else s=s.replace(/[.,]/g,"");
  return Number(s)||0}
function sinAsteriscos(s){return String(s||"").replace(/\*/g,"").replace(/_/g," ").replace(/\s+/g," ").trim()}
// renglón entero en negrita: *ALGO*
function esNegrita(l){return /^\*[^*]+\*$/.test(l.trim())}

function leerPresupuestoTexto(txt){
  var R={cliente:"",motor:"",embarcacion:"",trabajo:"",resumen:"",repuestos:[],manos:[],observacion:"",
         subRep:null,subMano:null,total:null,avisos:[]};
  var lineas=String(txt||"").replace(/\r/g,"").split("\n"),visto=false,sec="inicio",parrafos=[],actual=null;
  var MONTO=/^(.+?):\s*\$\s*([\d.,]+)\s*\.?$/;
  function cerrarItem(){if(actual){actual.detalle=actual.detalle.join("\n").replace(/\n{3,}/g,"\n\n").trim();actual=null}}
  function pushParrafo(l){parrafos.push(l)}
  lineas.forEach(function(raw,idx){
    var l=raw.trim(),limpio=sinAsteriscos(l),N=norm(limpio);
    if(!l){if(actual)actual.detalle.push("");else if(sec==="trabajo"||sec==="obs")pushParrafo("");return}
    // encabezados conocidos
    if(/^repuestos( y materiales)?$/.test(N)||/^materiales$/.test(N)){cerrarItem();sec="rep";return}
    if(/^mano de obra/.test(N)&&!MONTO.test(limpio)){cerrarItem();sec="mano";return}
    if(/^total general$/.test(N)){cerrarItem();sec="totales";return}
    if(/^observacion(es)?:?$/.test(N)){cerrarItem();sec="obs";parrafos=[];return}
    if(/^datos para transferencia/.test(N)){cerrarItem();sec="fin";return}
    // subtotales y total, en cualquier sección
    var mt=limpio.match(MONTO);
    if(mt&&/^subtotal/.test(norm(mt[1]))){cerrarItem();
      if(/mano/.test(norm(mt[1])))R.subMano=montoTexto(mt[2]);else R.subRep=montoTexto(mt[2]);return}
    if(mt&&/^total$/.test(norm(mt[1]))){cerrarItem();R.total=montoTexto(mt[2]);return}
    if(sec==="fin")return;
    if(sec==="inicio"){
      var kv=limpio.match(/^([^:]{2,30}):\s*(.+)$/);
      if(kv){var k=norm(kv[1]);
        visto=true;
        if(/^cliente/.test(k)){R.cliente=kv[2].trim();return}
        if(/^motor/.test(k)){R.motor=kv[2].trim();return}
        if(/^(embarcacion|lancha|barco|casco)/.test(k)){R.embarcacion=kv[2].trim();return}
      }
      // el primer renglón en negrita es el nombre del taller; el siguiente, el título del trabajo
      if(esNegrita(l)){if(!visto){visto=true;return}R.trabajo=limpio;sec="trabajo";parrafos=[];return}
      visto=true;
      if(R.cliente||R.motor){sec="trabajo";parrafos=[limpio];R.resumen=limpio}
      return}
    if(sec==="trabajo"){pushParrafo(limpio);R.resumen=parrafos.join("\n").replace(/\n{3,}/g,"\n\n").trim();return}
    if(sec==="obs"){pushParrafo(limpio);R.observacion=parrafos.join("\n").replace(/\n{3,}/g,"\n\n").trim();return}
    if(sec==="rep"){
      var r=limpio.replace(/^[-•·]\s*/,"").match(MONTO);
      if(!r){R.avisos.push("No se entendió el repuesto: "+limpio);return}
      var desc=r[1].trim(),imp=montoTexto(r[2]),cant=1,pu=imp;
      // "(3 unidades x $20.000)"
      var cu=desc.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:unidades?|unid\.?|uds?\.?|u\.?)?\s*x\s*\$?\s*([\d.,]+)\s*\)/i);
      if(cu){var c=Number(cu[1].replace(",",".")),p=montoTexto(cu[2]);
        if(c>0&&Math.abs(c*p-imp)<0.5){cant=c;pu=p}
        desc=desc.replace(cu[0],"")}
      else{var cx=desc.match(/\s*\(x\s*(\d+(?:[.,]\d+)?)\)\s*$/i);
        if(cx){var c2=Number(cx[1].replace(",","."));if(c2>0){cant=c2;pu=imp/c2}desc=desc.replace(cx[0],"")}}
      desc=desc.replace(/\s+,/g,",").replace(/\s{2,}/g," ").trim();
      R.repuestos.push({descripcion:desc,cantidad:cant,precio:pu});return}
    if(sec==="mano"){
      var mm=!/^[-•·]/.test(limpio)&&limpio.match(MONTO);
      if(mm){cerrarItem();actual={tipo:"mano",descripcion:mm[1].trim(),detalle:[],cantidad:1,precio:montoTexto(mm[2])};R.manos.push(actual);return}
      if(actual){actual.detalle.push(limpio);return}
      R.avisos.push("Texto suelto en mano de obra: "+limpio);return}
    // sec==="totales": los renglones "Repuestos y materiales: $X" se recalculan solos
  });
  cerrarItem();
  return R;
}
function sumaPegado(R){
  var sr=R.repuestos.reduce(function(s,it){return s+it.cantidad*it.precio},0),sm=R.manos.reduce(function(s,it){return s+it.precio},0);
  return {rep:sr,mano:sm,total:sr+sm}}
// Diferencias entre lo que dice el texto y lo que suma el sistema
function controlPegado(R){
  var s=sumaPegado(R),dif=[];
  function cmp(nombre,dice,calc){if(dice!=null&&Math.abs(dice-calc)>=1)dif.push(nombre+": el texto dice "+plata(dice)+" y los ítems suman "+plata(calc))}
  cmp("Subtotal repuestos",R.subRep,s.rep);cmp("Subtotal mano de obra",R.subMano,s.mano);cmp("Total",R.total,s.total);
  return dif}

// Pasa lo leído al presupuesto abierto (S.presu). No guarda: el usuario revisa y toca Guardar.
function volcarEnPresu(R){
  var M=S.presu.meta;
  M.formato="nautico";M.materiales_cliente=false;
  M.trabajo=R.trabajo;M.resumen=R.resumen;M.observacion=R.observacion;
  if(R.motor)M.motor=R.motor;
  S.presu.items=R.repuestos.map(function(it){return {descripcion:it.descripcion,cantidad:it.cantidad,precio:it.precio}})
    .concat(R.manos.map(function(it){return {tipo:"mano",descripcion:it.descripcion,detalle:it.detalle,cantidad:1,precio:it.precio}}));
  if(!S.presu.items.length)S.presu.items=[itemVacio()];
  if(!itemsDe("mano").length)S.presu.items.push(itemVacio("mano"));
}
function resumenPegadoHtml(R){
  var s=sumaPegado(R),dif=controlPegado(R);
  return "<div class='card'><h2>Lo que se leyó</h2>"+
   "<div class='lr'><span class='muted'>Cliente</span><b>"+esc(R.cliente||"—")+"</b></div>"+
   "<div class='lr'><span class='muted'>Motor</span><b>"+esc(R.motor||"—")+"</b></div>"+
   (R.trabajo?"<div class='lr'><span class='muted'>Trabajo</span><b style='text-align:right'>"+esc(R.trabajo)+"</b></div>":"")+
   "<div class='lr' style='margin-top:8px'><span class='muted'>Repuestos ("+R.repuestos.length+")</span><span>"+plata(s.rep)+"</span></div>"+
   "<div class='lr'><span class='muted'>Mano de obra ("+R.manos.length+")</span><span>"+plata(s.mano)+"</span></div>"+
   "<div class='lr' style='font-weight:700;font-size:1.1rem'><span>Total</span><span>"+plata(s.total)+"</span></div>"+
   (dif.length?"<div class='status err' style='margin-top:8px'>Ojo, los números no cierran:<br>"+dif.map(esc).join("<br>")+"</div>"
    :(R.total!=null?"<div class='status' style='margin-top:8px'>Los subtotales y el total coinciden con el texto.</div>":""))+
   (R.avisos.length?"<p class='muted' style='margin-top:8px'>"+R.avisos.map(esc).join("<br>")+"</p>":"")+
   "</div>"}

/* ---------- pantalla: Presupuestos > Pegar presupuesto ---------- */
async function renderPresuTexto(){
  var P=S.pegado||(S.pegado={texto:""});
  m.innerHTML="<h1>Pegar presupuesto</h1>"+
   "<p class='muted'>Pegá el presupuesto tal cual lo tenés escrito (el de WhatsApp, con cliente, motor, repuestos y mano de obra). El sistema lo pasa a la planilla y después lo revisás antes de guardar.</p>"+
   "<div class='card'><label for='ptxt' style='margin-top:0'>Texto del presupuesto</label><textarea id='ptxt' rows='12' placeholder='*Cliente:* …&#10;*Motor:* …&#10;&#10;*REPUESTOS Y MATERIALES*&#10;- Aceite de pata: $20.000'>"+esc(P.texto)+"</textarea>"+
   "<div class='btns'><button class='btn' id='leer'>Leer presupuesto</button><button class='btn o' id='back'>Volver</button></div></div>"+
   "<div id='st' class='status hide'></div><div id='res'></div>";
  document.getElementById("back").onclick=function(){S.vista="presupuestos";route()};
  document.getElementById("leer").onclick=function(){P.texto=document.getElementById("ptxt").value;leerYMostrar()};
  if(P.texto&&P.leido)leerYMostrar();
}
async function leerYMostrar(){
  var P=S.pegado,R=leerPresupuestoTexto(P.texto);P.leido=R;
  var res=document.getElementById("res");
  if(!R.repuestos.length&&!R.manos.length){res.innerHTML="";say("st","No se encontraron repuestos ni trabajos con importe. Fijate que tenga las secciones REPUESTOS Y MATERIALES o MANO DE OBRA y los importes con $.",true);return}
  document.getElementById("st").classList.add("hide");
  var cr=await sb.from("clientes").select("id,nombre,equipos(id,motores(id))").order("nombre");
  var clientes=cr.data||[],q=norm(R.cliente).trim();
  // coincide si el nombre es igual o empieza igual (Tomás -> Tomás Pérez)
  var parecidos=q?clientes.filter(function(c){var n=norm(c.nombre).trim();return n===q||n.indexOf(q+" ")===0||q.indexOf(n+" ")===0}):[];
  if(P.clienteId===undefined)P.clienteId=parecidos.length?parecidos[0].id:"";
  var h=resumenPegadoHtml(R)+"<div class='card'><h2>¿A qué orden va?</h2>"+
   "<label for='pcli' style='margin-top:0'>Cliente</label><select id='pcli'>"+
    (R.cliente?"<option value=''"+(P.clienteId?"":" selected")+">Cliente nuevo: "+esc(R.cliente)+"</option>":"<option value=''>— elegir —</option>")+
    parecidos.map(function(c){return "<option value='"+c.id+"'"+(P.clienteId===c.id?" selected":"")+">"+esc(c.nombre)+"</option>"}).join("")+
    (parecidos.length?"<option disabled>──────────</option>":"")+
    clientes.filter(function(c){return parecidos.indexOf(c)<0}).map(function(c){return "<option value='"+c.id+"'"+(P.clienteId===c.id?" selected":"")+">"+esc(c.nombre)+"</option>"}).join("")+
   "</select><label for='pord'>Orden</label><select id='pord'><option value=''>Orden nueva</option></select>"+
   "<p class='muted' id='pordAviso' style='margin-top:6px'></p>"+
   "<div class='btns'><button class='btn' id='seguir'>Pasar a la planilla</button></div></div>";
  res.innerHTML=h;
  var selC=document.getElementById("pcli"),selO=document.getElementById("pord"),ordenes=[];
  async function cargarOrdenes(){
    P.clienteId=selC.value;ordenes=[];
    if(P.clienteId){var ro=await sb.from("ordenes").select("id,numero,estado,motivo,presupuestos(id)").eq("cliente_id",P.clienteId).order("creado",{ascending:false});ordenes=ro.data||[]}
    selO.innerHTML="<option value=''>Orden nueva</option>"+ordenes.map(function(o){return "<option value='"+o.id+"'>OT "+String(o.numero).padStart(6,"0")+" · "+esc(o.estado||"")+(o.motivo?" · "+esc(String(o.motivo).slice(0,40)):"")+(presuDe(o)?" · ya tiene presupuesto":"")+"</option>"}).join("");
    // por defecto, la última orden abierta del cliente
    var abierta=ordenes.filter(function(o){return o.estado!=="Entregado"})[0];selO.value=abierta?abierta.id:"";avisoOrden()}
  function avisoOrden(){var o=ordenes.filter(function(x){return x.id===selO.value})[0];
    document.getElementById("pordAviso").textContent=!selO.value?(P.clienteId?"Se crea una orden nueva para este cliente, en estado Presupuesto.":"Se crea el cliente y una orden nueva en estado Presupuesto."):
     presuDe(o)?"Esta orden ya tiene presupuesto: al guardar, se reemplaza por el pegado.":""}
  selC.onchange=cargarOrdenes;selO.onchange=avisoOrden;
  await cargarOrdenes();
  document.getElementById("seguir").onclick=async function(){
    var b=this;b.disabled=true;
    try{
      var cliId=selC.value,ordId=selO.value;
      if(!cliId){
        if(!R.cliente){say("st","Elegí el cliente.",true);return}
        var rc=await sb.from("clientes").insert({taller_id:S.taller.id,nombre:R.cliente}).select("id").single();
        if(rc.error){say("st",rc.error.message,true);return}cliId=rc.data.id}
      if(!ordId){
        var c=clientes.filter(function(x){return x.id===cliId})[0],eqs=c?c.equipos||[]:[],eq=eqs.length===1?eqs[0]:null,mots=eq?eq.motores||[]:[];
        var ro=await sb.from("ordenes").insert({taller_id:S.taller.id,cliente_id:cliId,equipo_id:eq?eq.id:null,motor_id:mots.length===1?mots[0].id:null,
          motivo:R.trabajo||"",diagnostico:R.resumen||"",estado:"Presupuesto"}).select("id").single();
        if(ro.error){say("st",ro.error.message,true);return}ordId=ro.data.id}
      S.presuPegado={orden_id:ordId,datos:R};S.pegado=null;S.volverPresu="presupuestos";
      await abrirPresupuesto(ordId);
    }finally{b.disabled=false}
  };
}

/* ---------- dentro de la planilla: botón "Pegar desde texto" ---------- */
function pegarEnPlanillaHtml(){
  if(!esRubroNautica())return "";
  return "<div class='card'><button class='btn o' id='pegarTxt' style='width:100%'>"+ic("clipboard")+" Pegar presupuesto escrito</button>"+
   "<div id='pegarBox' class='hide'><label for='pegarArea'>Pegá el texto y se completa la planilla (después revisás y guardás)</label><textarea id='pegarArea' rows='10'></textarea>"+
   "<div class='btns'><button class='btn' id='pegarOk'>Completar planilla</button><button class='btn o' id='pegarNo'>Cancelar</button></div></div></div>"}
function conectarPegarEnPlanilla(){
  var b=document.getElementById("pegarTxt");if(!b)return;
  var box=document.getElementById("pegarBox");
  b.onclick=function(){box.classList.toggle("hide");if(!box.classList.contains("hide"))document.getElementById("pegarArea").focus()};
  document.getElementById("pegarNo").onclick=function(){box.classList.add("hide")};
  document.getElementById("pegarOk").onclick=function(){
    var R=leerPresupuestoTexto(document.getElementById("pegarArea").value);
    if(!R.repuestos.length&&!R.manos.length){alert("No se encontraron repuestos ni trabajos con importe en el texto.");return}
    S.presu.pegadoAviso=R;volcarEnPresu(R);pintarPresu();window.scrollTo(0,0)};
}
// Al abrir la planilla después de "Pegar presupuesto", carga lo leído encima de lo guardado
function aplicarPegadoPendiente(){
  var P=S.presuPegado;if(!P||!S.orden||P.orden_id!==S.orden.id)return;
  S.presuPegado=null;S.presu.pegadoAviso=P.datos;volcarEnPresu(P.datos)}
function avisoPegadoHtml(){
  var R=S.presu&&S.presu.pegadoAviso;if(!R)return "";
  var dif=controlPegado(R);
  return "<div id='avisoPegado' class='status"+(dif.length?" err":"")+"'>"+(dif.length?"Se pasó el presupuesto, pero los números del texto no cierran: "+dif.map(esc).join(" · ")+". ":"Presupuesto pasado a la planilla"+(R.total!=null?" (total "+plata(R.total)+", coincide)":"")+". ")+
   "Revisalo y tocá <b>Guardar presupuesto</b>.</div>"}
