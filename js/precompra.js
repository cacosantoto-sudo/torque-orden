// Verificación pre compra (solo talleres de autos): informe con puntaje sobre 100,
// carrocería por sector, neumáticos, alertas, gastos estimados, recomendación y riesgo,
// contrato de servicio, PDF para mandar por WhatsApp o correo y QR al informe digital.
// Historial por patente (dominio) y VIN; los datos del cliente salen de Clientes.
// Los cálculos y los PDF están en js/precompra-pdf.js (los comparte con precompra.html).
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.precompras=renderPrecompras;VISTAS.precompraForm=renderPrecompraForm;VISTAS.precompraAjustes=renderPrecompraAjustes;
GRUPOS.precompras="mas";GRUPOS.precompraForm="mas";GRUPOS.precompraAjustes="mas";

var FALTA_SQL_PC="Para usar la verificación pre compra falta correr en Supabase el SQL nuevo (sql/2026-10-16_precompra.sql).";
var PC_TRANSMISIONES=["Manual","Automática","Automática DSG","Automática CVT","Automatizada"];
var PC_VALORES=["OK","Normal","Correcto","Preciso","Buen estado","Desgaste leve","Acorde al km","Con detalles","Revisar"];
function pcErrSql(e){return /relation|does not exist|schema cache|precompra/i.test(e&&e.message||"")}
function pcSoloAutos(){
  if(esRubroAutos())return true;
  m.innerHTML="<h1>Verificación pre compra</h1><div class='card'><p class='muted' style='margin:0'>Esta función es solo para talleres de autos.</p></div>";
  return false;
}
function pcEstilos(){
  if(document.getElementById("pcCss"))return;
  var st=document.createElement("style");st.id="pcCss";
  st.textContent=".pcBar{height:8px;border-radius:4px;background:var(--card2);overflow:hidden;margin:8px 0 2px}.pcBar i{display:block;height:100%;border-radius:4px;transition:width .2s}"+
   ".pcTot{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 14px;margin-bottom:12px}"+
   ".pcTot b{font:800 2rem/1 var(--f-head)}.pcTot .tag{font-size:.8rem}"+
   ".pcSec{display:grid;grid-template-columns:1.3fr 1.2fr .7fr;gap:6px;align-items:center;border-top:1px solid var(--line);padding:8px 0}.pcSec input,.pcSec select{min-height:40px;padding:6px 8px}.pcSec .ob{grid-column:1/-1}"+
   ".pcNeu{border-top:1px solid var(--line);padding-top:8px;margin-top:8px}"+
   ".pcFila{display:flex;gap:8px;align-items:center;margin-top:8px}.pcFila input{flex:1}.pcFila .btn{padding:6px 10px;min-height:0}"+
   ".pcFotoSlot{display:flex;gap:10px;align-items:center;margin-top:8px}.pcFotoSlot .autoMini{width:110px;flex:none}.pcFotoSlot input{flex:1}"+
   ".pcPad{width:100%;height:170px;background:#fff;border:2px dashed var(--line);border-radius:10px;touch-action:none;display:block;box-sizing:border-box}"+
   ".pcCard{display:flex;gap:12px;align-items:center;width:100%;text-align:left;color:var(--ink);font:inherit;cursor:pointer}"+
   ".pcPts{font:800 1.6rem/1 var(--f-head);text-align:right}";
  document.head.appendChild(st);
}
async function pcCargarConfig(){
  var r=await sb.from("precompra_config").select("*").eq("taller_id",S.taller.id).maybeSingle();
  S.pcCfg=r.error?{}:(r.data||{});return r.error;
}
function irPrecompra(id){S.pcEdit=id||null;S.vista="precompraForm";route();window.scrollTo(0,0)}
function pcTagCalif(total){var i=pcRangoIdx(total,S.pcCfg);return i<=1?"g":i<=3?"w":"bad"}

/* ---------- lista e historial ---------- */
async function renderPrecompras(){
  if(!pcSoloAutos())return;pcEstilos();
  m.innerHTML="<div class='lr'><h1>Verificación pre compra</h1><button class='btn' id='pcNuevo' style='padding:8px 14px;min-height:0'>"+ic("plus")+" Informe</button></div><div id='box'>"+skel()+"</div>";
  document.getElementById("pcNuevo").onclick=function(){irPrecompra(null)};
  var r=await sb.from("precompras").select("id,codigo,fecha,marca,modelo,anio,patente,vin,cliente,puntaje,estado,creado").order("creado",{ascending:false});
  if(r.error){document.getElementById("box").innerHTML="<div class='status err'>"+(pcErrSql(r.error)?FALTA_SQL_PC:esc(r.error.message))+"</div>";return}
  await pcCargarConfig();
  S.pcLista=r.data||[];pintarPrecompras();
}
function pintarPrecompras(){
  var box=document.getElementById("box");if(!box)return;
  var cuenta={};S.pcLista.forEach(function(p){[p.patente,p.vin].filter(Boolean).forEach(function(k){cuenta[k]=(cuenta[k]||0)+1})});
  var h="<button class='fila' id='pcAjustes' style='min-height:48px;font-size:1rem'>"+ic("sliders")+"<span>Ajustes del informe</span>"+ic("chevron")+"</button>";
  h+=buscadorHtml("Buscar por patente, VIN, cliente, marca o N° de informe",S.pcQ);
  h+=S.pcLista.map(function(p){var cli=p.cliente&&p.cliente.nombre,veces=Math.max(cuenta[p.patente]||0,cuenta[p.vin]||0),tot=Number(p.puntaje)||0;
   var q=norm([p.codigo,p.marca,p.modelo,p.anio,p.patente,p.vin,cli].join(" "));
   return "<button class='card pcCard' data-pc='"+p.id+"' data-q=\""+esc(q)+"\"><div style='flex:1;min-width:0'>"+
    "<span class='muted' style='font:600 .78rem var(--f-mono)'>"+esc(p.codigo||"")+" · "+esc(pcFecha(p.fecha).replace(/ /g,""))+"</span><br>"+
    "<b style='font-size:1.05rem'>"+esc([p.marca,p.modelo,p.anio].filter(Boolean).join(" ")||"Vehículo sin datos")+"</b><br>"+
    "<span class='muted' style='font-size:.88rem'>"+[p.patente,p.vin&&"VIN "+p.vin].filter(Boolean).map(esc).join(" · ")+"</span>"+
    (cli?"<br><span class='muted' style='font-size:.85rem'>"+ic("users")+" "+esc(cli)+"</span>":"")+
    "<div style='margin-top:6px;display:flex;gap:6px;flex-wrap:wrap'>"+(p.estado==="finalizado"?"<span class='tag g'>Finalizado</span>":"<span class='tag'>Borrador</span>")+
    (veces>1?"<span class='tag w'>"+veces+" inspecciones de este auto</span>":"")+"</div></div>"+
    "<div><div class='pcPts'>"+tot+"<span class='muted' style='font-size:.8rem'>/100</span></div><span class='tag "+pcTagCalif(tot)+"'>"+esc(pcCalif(tot,S.pcCfg).txt)+"</span></div></button>"}).join("")||
   vacio("car","Todavía no hay informes","Tocá <b>Informe</b> para cargar la primera verificación pre compra.");
  h+="<p id='sinres' class='muted hide'>No hay informes que coincidan.</p>";
  box.innerHTML=h;
  document.getElementById("pcAjustes").onclick=function(){S.vista="precompraAjustes";route();window.scrollTo(0,0)};
  m.querySelectorAll("[data-pc]").forEach(function(b){b.onclick=function(){irPrecompra(b.dataset.pc)}});
  var bu=document.getElementById("buscar");bu.oninput=function(){S.pcQ=bu.value;filtrarLista(bu.value)};if(S.pcQ)filtrarLista(S.pcQ);
}

/* ---------- formulario ---------- */
async function renderPrecompraForm(){
  if(!pcSoloAutos())return;pcEstilos();
  m.innerHTML="<h1>"+(S.pcEdit?"Informe pre compra":"Nueva verificación pre compra")+"</h1><div id='box'>"+skel()+"</div>";
  var errCfg=await pcCargarConfig();
  if(errCfg&&pcErrSql(errCfg)){document.getElementById("box").innerHTML="<div class='status err'>"+FALTA_SQL_PC+"</div>";return}
  var rc=await sb.from("clientes").select("*").order("nombre");S.pcClientes=rc.error?[]:(rc.data||[]);
  var cfg=S.pcCfg,hoy=new Date(),p={fecha:hoy.getFullYear()+"-"+String(hoy.getMonth()+1).padStart(2,"0")+"-"+String(hoy.getDate()).padStart(2,"0"),
   lugar:cfg.lugar||"",estado:"borrador",cliente:{},fotos:{},combustible:"Nafta",
   datos:{cats:{},carroceria:{},neumaticos:{},frenos:{},escaneo:{},manejo:{},interior:{},alertas:[],gastos:[],recom:"auto",riesgo:"auto",responsable:{nombre:cfg.responsable||"",matricula:cfg.matricula||""},contrato:{}}};
  if(S.pcEdit){
   var r=await sb.from("precompras").select("*").eq("id",S.pcEdit).single();
   if(r.error){document.getElementById("box").innerHTML="<div class='status err'>"+esc(r.error.message)+"</div>";return}
   p=r.data;p.datos=Object.assign({cats:{},carroceria:{},neumaticos:{},frenos:{},escaneo:{},manejo:{},interior:{},alertas:[],gastos:[],responsable:{},contrato:{}},p.datos||{});
   p.fotos=p.fotos||{};p.cliente=p.cliente||{};
  }
  S.pc=p;S.pcNuevas={};S.pcGalNuevas=[];S.pcQuitar=[];S.pcFirmaCli=null;S.pcHist=null;S.pcEquipo=null;
  pintarPrecompraForm();
  if(p.patente||p.vin)pcBuscarHistorial();
}
function pcIn(id,lbl,val,extra){return "<div><label for='"+id+"'>"+lbl+"</label><input id='"+id+"' value=\""+esc(val==null?"":val)+"\""+(extra||"")+"></div>"}
function pcTa(id,lbl,val,ph){return "<label for='"+id+"'>"+lbl+"</label><textarea id='"+id+"' placeholder=\""+esc(ph||"")+"\">"+esc(val||"")+"</textarea>"}
function pcSel(id,lbl,val,ops){return "<div><label for='"+id+"'>"+lbl+"</label><select id='"+id+"'>"+ops.map(function(o){return "<option value='"+o[0]+"'"+(String(val==null?"":val)===o[0]?" selected":"")+">"+o[1]+"</option>"}).join("")+"</select></div>"}
// Una foto del informe: la guardada, la nueva (se sube al guardar) o el botón para agregarla
function pcFotoSlot(key,lbl){
  var nueva=S.pcNuevas[key],ruta=S.pc.fotos[key],u=nueva?nueva.url:(ruta?pcUrlFoto(ruta):"");
  return "<label for='pcF_"+key+"'>"+lbl+"</label><div class='pcFotoSlot'>"+(u?"<div class='autoMini'><img src=\""+esc(u)+"\" alt=''><button data-pcfq='"+key+"' aria-label='Quitar foto' title='Quitar foto'>"+ic("trash")+"</button></div>":"")+
   "<input type='file' id='pcF_"+key+"' data-pcf='"+key+"' accept='image/*'></div>";
}
function pcCatHtml(c,i){
  var D=S.pc.datos,v=D.cats[c.k]||{},campos=PC_CAT_CAMPOS[c.k]||[],h="";
  h+="<div class='card' id='pcCat_"+c.k+"'><div class='lr'><h2 style='margin:0'>"+(i+1)+". "+c.n+"</h2><span class='tag'>Máx. "+c.max+" pts</span></div>";
  h+="<div class='g2'><div><label for='pcPts_"+c.k+"'>Puntaje (0 a "+c.max+")</label><input id='pcPts_"+c.k+"' type='number' inputmode='numeric' min='0' max='"+c.max+"' value=\""+esc(v.pts==null?"":v.pts)+"\"></div><div><div class='pcBar'><i id='pcBar_"+c.k+"'></i></div><span class='muted' id='pcPct_"+c.k+"' style='font-size:.85rem'></span></div></div>";
  if(campos.length)h+="<div class='g2'>"+campos.map(function(f){return pcIn("pcC_"+c.k+"_"+f[0],f[1],v[f[0]]," placeholder=\""+esc(f[2])+"\""+(f[3]?" inputmode='numeric'":""))}).join("")+"</div>";
  if(c.k==="inter")h+=pcIn("pcC_inter_acorde","Estado general acorde al kilometraje",v.acorde," placeholder='Desgaste acorde al kilometraje'");
  if(c.k==="elec")h+="<p class='muted' style='font-size:.85rem;margin:8px 0 0'>Las fallas y los módulos se cargan en <b>Escaneo electrónico</b>, más abajo.</p>";
  if(c.k==="carro")h+="<p class='muted' style='font-size:.85rem;margin:8px 0 0'>Las piezas repintadas o con masilla se marcan en <b>Carrocería por sector</b>, más abajo.</p>";
  if(c.k==="neufre")h+="<p class='muted' style='font-size:.85rem;margin:8px 0 0'>La vida útil sale de <b>Neumáticos</b> y las pastillas de <b>Frenos</b>, más abajo.</p>";
  h+=pcTa("pcObs_"+c.k,"Comentario breve (va al informe)",v.obs,pcComentarioAuto(D,c.k)||"Se arma solo con los datos cargados")+"</div>";
  return h;
}
function pintarPrecompraForm(){
  var p=S.pc,D=p.datos,C=p.cliente||{},M=D.motor||{};
  var h="<div class='pcTot' id='pcTot'></div>";
  // cabecera
  h+="<div class='card'><h2>Informe</h2><div class='g2'><div><label>N° de informe</label><input value=\""+esc(p.codigo||"Se asigna al guardar")+"\" disabled></div>"+pcIn("pcFecha","Fecha de inspección",p.fecha," type='date'")+"</div>"+
   "<div class='g2'>"+pcIn("pcLugar","Lugar de inspección",p.lugar," placeholder='CABA, Buenos Aires'")+pcSel("pcEstado","Estado",p.estado,[["borrador","Borrador"],["finalizado","Finalizado"]])+"</div></div>";
  // cliente
  h+="<div class='card'><h2>Cliente</h2><label for='pcCli'>Nombre y apellido</label><input id='pcCli' list='pcCliLista' autocomplete='off' placeholder='Elegí un cliente o escribí uno nuevo' value=\""+esc(C.nombre||"")+"\"><datalist id='pcCliLista'>"+S.pcClientes.map(function(c){return "<option value=\""+esc(c.nombre)+"\">"}).join("")+"</datalist>"+
   "<div class='muted' id='pcCliInfo' style='font-size:.85rem;margin-top:6px'></div>"+
   "<div class='g3'>"+pcIn("pcDni","DNI",C.dni," inputmode='numeric'")+pcIn("pcTel","Teléfono",C.telefono," type='tel'")+pcIn("pcMail","Correo electrónico",C.email," type='email'")+"</div></div>";
  // vehículo
  h+="<div class='card'><h2>Datos del vehículo inspeccionado</h2>"+
   "<div class='g2'>"+pcIn("pcPat","Dominio / Patente",p.patente," style='text-transform:uppercase' placeholder='AB123CD'")+pcIn("pcVin","N° de chasis (VIN)",p.vin," style='text-transform:uppercase'")+"</div>"+
   "<div id='pcHist'></div>"+
   "<div class='g2'>"+pcIn("pcMarca","Marca",p.marca," placeholder='Volkswagen'")+pcIn("pcModelo","Modelo",p.modelo," placeholder='Vento 2.0 TSI'")+"</div>"+
   "<div class='g3'>"+pcIn("pcAnio","Año",p.anio," inputmode='numeric'")+pcIn("pcKm","Kilometraje indicado",p.km!=null?p.km:""," inputmode='numeric'")+pcIn("pcColor","Color",p.color)+"</div>"+
   "<div class='g3'>"+pcIn("pcCil","Motor: cilindrada",M.cil," placeholder='2.0 TSI'")+pcIn("pcPot","Potencia",M.pot," placeholder='211 CV'")+pcIn("pcTipoM","Tipo",M.tipo," placeholder='Turbo nafta'")+"</div>"+
   "<div class='g2'>"+pcSel("pcComb","Combustible",p.combustible||"",[["",""]].concat(COMBUSTIBLES.map(function(c){return [c,c]})))+
    pcIn("pcTrans","Transmisión",p.transmision," list='pcTransLista' placeholder='Automática DSG'")+"</div><datalist id='pcTransLista'>"+PC_TRANSMISIONES.map(function(t){return "<option value=\""+t+"\">"}).join("")+"</datalist>"+
   pcFotoSlot("principal","Foto principal (frente o lateral, con la patente visible)")+
   "<label for='pcGal'>Más fotos del vehículo</label><div class='autoFotos'>"+
   (p.fotos.galeria||[]).map(function(r,i){return "<div class='autoMini'><img src=\""+esc(pcUrlFoto(r))+"\" alt='Foto "+(i+1)+"'><button data-pcgq='"+i+"' aria-label='Quitar foto' title='Quitar foto'>"+ic("trash")+"</button></div>"}).join("")+
   S.pcGalNuevas.map(function(b,i){return "<div class='autoMini'><img src=\""+b.url+"\" alt=''><span class='tag' style='position:absolute;left:4px;bottom:4px'>Nueva</span></div>"}).join("")+
   "</div><input type='file' id='pcGal' accept='image/*' multiple></div>";
  // resumen
  h+="<div class='card'><h2>Puntaje general y resumen</h2><div id='pcCalif'></div>"+pcTa("pcResumen","Resumen ejecutivo",D.resumen,"El vehículo se encuentra en buen estado general. No se detectan fallas críticas. Se observan detalles menores que requieren atención a mediano plazo.")+"</div>";
  // categorías
  h+="<h2 style='margin:20px 0 10px'>Puntuación por categorías</h2>"+PC_CATS.map(pcCatHtml).join("");
  // carrocería
  h+="<div class='card'><h2>Carrocería y pintura por sector</h2><div style='display:flex;gap:14px;align-items:center;margin-bottom:6px'><div id='pcSvg'></div><div class='muted' style='font-size:.85rem'>"+
   PC_ESTADOS.map(function(e){return "<div><span style='display:inline-block;width:12px;height:12px;border-radius:3px;background:"+e[3]+";vertical-align:-1px'></span> "+e[1]+"</div>"}).join("")+
   "<p style='margin:8px 0 0'>Espesor en micrones (µm) con medidor de pintura digital.</p></div></div>"+
   PC_SECTORES.map(function(s){var d=D.carroceria[s[0]]||{};return "<div class='pcSec'><b style='font-size:.92rem'>"+s[1]+"</b>"+
    "<select id='pcS_"+s[0]+"_estado' aria-label='Estado de "+s[1]+"'><option value=''>Sin revisar</option>"+PC_ESTADOS.map(function(e){return "<option value='"+e[0]+"'"+(d.estado===e[0]?" selected":"")+">"+e[1]+"</option>"}).join("")+"</select>"+
    "<input id='pcS_"+s[0]+"_um' inputmode='numeric' placeholder='µm' aria-label='Espesor de "+s[1]+" en micrones' value=\""+esc(d.um==null?"":d.um)+"\">"+
    "<input class='ob' id='pcS_"+s[0]+"_obs' placeholder='Observaciones' aria-label='Observaciones de "+s[1]+"' value=\""+esc(d.obs||"")+"\"></div>"}).join("")+"</div>";
  // neumáticos
  h+="<div class='card'><h2>Neumáticos</h2>"+PC_NEU.map(function(n){var d=D.neumaticos[n[0]]||{};return "<div class='pcNeu'><b>"+n[1]+"</b><div class='g3'>"+
    pcIn("pcN_"+n[0]+"_dot","DOT / año",d.dot," placeholder='2022'")+pcIn("pcN_"+n[0]+"_mm","Dibujo (mm)",d.mm," inputmode='decimal'")+pcIn("pcN_"+n[0]+"_vida","Vida útil (%)",d.vida," inputmode='numeric'")+"</div>"+
    pcFotoSlot("neu_"+n[0],"Foto")+"</div>"}).join("")+"</div>";
  // submódulos
  var F=D.frenos,E=D.escaneo,MJ=D.manejo,IN=D.interior;
  h+="<div class='card'><h2>Frenos</h2><div class='g2'>"+pcIn("pcFr_pd","Pastillas delanteras (%)",F.pd," inputmode='numeric'")+pcIn("pcFr_dd","Discos delanteros",F.dd," placeholder='Buen estado'")+"</div>"+
   "<div class='g2'>"+pcIn("pcFr_pt","Pastillas traseras (%)",F.pt," inputmode='numeric'")+pcIn("pcFr_dt","Discos traseros",F.dt," placeholder='Buen estado'")+"</div>"+
   pcSel("pcFr_parejo","Frenado",F.parejo==null?"":F.parejo?"si":"no",[["","Sin evaluar"],["si","Parejo y eficiente"],["no","A revisar"]])+pcFotoSlot("frenos","Foto")+"</div>";
  h+="<div class='card'><h2>Escaneo electrónico</h2><div class='g2'>"+PC_ESCANEO.map(function(x){var v=E[x[0]];return pcSel("pcE_"+x[0],x[1],v==null?"":v?"ok":"falla",[["","Sin verificar"],["ok",x[1]+" OK"],["falla","Con falla"]])}).join("")+"</div>"+
   pcIn("pcE_fallas","Fallas activas",E.fallas," placeholder='Sin fallas activas'")+pcFotoSlot("escaneo","Foto")+"</div>";
  var dl="<datalist id='pcValores'>"+PC_VALORES.map(function(v){return "<option value=\""+v+"\">"}).join("")+"</datalist>";
  h+="<div class='card'><h2>Prueba de manejo</h2><div class='g2'>"+PC_MANEJO.map(function(x){return pcIn("pcM_"+x[0],x[1],MJ[x[0]]," list='pcValores' placeholder='"+x[2]+"'")}).join("")+"</div>"+pcFotoSlot("manejo","Foto")+dl+"</div>";
  h+="<div class='card'><h2>Interior</h2><div class='g2'>"+PC_INTERIOR.map(function(x){return pcIn("pcI_"+x[0],x[1],IN[x[0]]," list='pcValores' placeholder='"+x[2]+"'")}).join("")+"</div>"+pcFotoSlot("interior","Foto")+"</div>";
  // alertas
  h+="<div class='card'><h2>Alertas importantes</h2>"+(D.alertas||[]).map(function(a,i){return "<div class='pcFila'><input id='pcAl_"+i+"' value=\""+esc(a)+"\" aria-label='Alerta "+(i+1)+"'><button class='btn o icon del' data-pcal-del='"+i+"' aria-label='Quitar alerta' title='Quitar'>"+ic("trash")+"</button></div>"}).join("")+
   "<div class='btns'><button class='btn o' id='pcAlMas' style='padding:6px 12px;min-height:0'>"+ic("plus")+" Alerta</button><button class='btn o' id='pcAlSug' style='padding:6px 12px;min-height:0'>Sugerir con lo cargado</button></div></div>";
  // gastos
  h+="<div class='card'><h2>Estimación de gastos post compra</h2>"+(D.gastos||[]).map(function(g,i){return "<div class='pcFila'><input id='pcG_"+i+"_desc' placeholder='Reparación o servicio' value=\""+esc(g.desc||"")+"\" aria-label='Reparación "+(i+1)+"'><input id='pcG_"+i+"_costo' inputmode='decimal' placeholder='$' style='max-width:130px' value=\""+esc(g.costo==null?"":g.costo)+"\" aria-label='Costo "+(i+1)+"'><button class='btn o icon del' data-pcg-del='"+i+"' aria-label='Quitar ítem' title='Quitar'>"+ic("trash")+"</button></div>"}).join("")+
   "<div class='lr' style='margin-top:12px'><button class='btn o' id='pcGMas' style='padding:6px 12px;min-height:0'>"+ic("plus")+" Ítem</button><span>Total estimado <b id='pcGTot' style='font-family:var(--f-mono)'></b></span></div></div>";
  // recomendación
  h+="<div class='card'><h2>Recomendación final y riesgo</h2><div class='g2'>"+pcSel("pcRecom","Recomendación",D.recom||"auto",[["auto","Según el puntaje"]].concat(PC_RECOM))+pcSel("pcRiesgo","Riesgo de compra",D.riesgo||"auto",[["auto","Según el puntaje"]].concat(PC_RIESGO))+"</div>"+
   "<div class='muted' id='pcRecomInfo' style='font-size:.85rem;margin-top:6px'></div>"+pcTa("pcRecomTxt","Por qué (va al informe)",D.recom_txt,"El vehículo es recomendable. Se sugiere negociar teniendo en cuenta los gastos estimados.")+"</div>";
  // observaciones y responsable
  var R=D.responsable||{};
  h+="<div class='card'><h2>Observaciones generales y responsable</h2>"+pcTa("pcObsGen","Conclusiones y recomendaciones a mediano plazo",D.observaciones,"")+
   "<div class='g2'>"+pcIn("pcRespNom","Mecánico responsable",R.nombre)+pcIn("pcRespMat","Matrícula profesional",R.matricula)+"</div>"+
   "<p class='muted' style='font-size:.85rem;margin:8px 0 0'>"+((D.firma_ruta||S.pcCfg.firma_ruta)?"La firma del responsable sale de los ajustes del informe.":"Para que el informe lleve la firma del responsable, cargala en <b>Ajustes del informe</b>.")+"</p></div>";
  // contrato
  var co=D.contrato||{};
  h+="<div class='card'><h2>Contrato / consentimiento</h2><p class='muted' style='margin-top:0;font-size:.9rem'>Se arma con los datos del cliente, del vehículo, el lugar y la fecha. Podés firmarlo en pantalla o imprimirlo y firmarlo en papel.</p>"+
   "<div class='g2'>"+pcIn("pcCoAcl","Aclaración",co.aclaracion," placeholder='Nombre de quien firma'")+pcIn("pcCoDni","DNI",co.dni," inputmode='numeric'")+"</div>"+
   (co.firma_ruta&&!S.pcFirmaCli?"<p style='margin:10px 0 0'><span class='tag g'>Firmado por el cliente</span> <button class='btn o' id='pcReFirma' style='padding:4px 10px;min-height:0;margin-left:6px'>Volver a firmar</button></p>":
    "<label>Firma del cliente</label><canvas id='pcPadCli' class='pcPad'></canvas><div class='btns' style='margin-top:6px'><button class='btn o' id='pcPadCliBorrar' style='padding:4px 10px;min-height:0'>Borrar firma</button></div>")+
   "<div class='btns'><button class='btn o' id='pcContrato'>"+ic("download")+" PDF del contrato</button></div></div>";
  // acciones
  h+="<div id='pcSt' class='status hide'></div><div class='btns'><button class='btn' id='pcGuardar'>Guardar</button><button class='btn o' id='pcPdf'>"+ic("download")+" PDF del informe</button>"+
   "<button class='btn o' id='pcWa'>"+ic("message")+" WhatsApp</button><button class='btn o' id='pcMailBtn'>Correo</button>"+(p.qr_token?"<a class='btn o' target='_blank' rel='noopener' href=\""+esc(pcUrlInforme(p.qr_token))+"\">"+ic("qr")+" Informe digital</a>":"")+
   "</div><div class='btns'>"+(p.id?"<button class='btn o del' id='pcBorrar'>"+ic("trash")+" Eliminar</button>":"")+"<button class='btn o' id='pcVolver'>Volver</button></div>";
  var box=document.getElementById("box");box.innerHTML=h;
  // eventos
  box.oninput=function(e){if(e.target&&e.target.type==="file")return;pcLeer();pcVivos()};
  box.onchange=box.oninput;
  document.getElementById("pcCli").addEventListener("change",pcClienteElegido);
  document.getElementById("pcPat").addEventListener("change",pcBuscarHistorial);
  document.getElementById("pcVin").addEventListener("change",pcBuscarHistorial);
  m.querySelectorAll("[data-pcf]").forEach(function(inp){inp.onchange=async function(){var f=inp.files&&inp.files[0];if(!f||!/^image\//.test(f.type))return;pcLeer();say("pcSt","Preparando la foto…");
   var b=await shrink(f);S.pcNuevas[inp.dataset.pcf]={blob:b,url:URL.createObjectURL(b)};pcRepintar()}});
  m.querySelectorAll("[data-pcfq]").forEach(function(b){b.onclick=function(){var k=b.dataset.pcfq;if(!confirm("¿Quitar esta foto?"))return;pcLeer();
   if(S.pcNuevas[k])delete S.pcNuevas[k];else if(S.pc.fotos[k]){S.pcQuitar.push(S.pc.fotos[k]);delete S.pc.fotos[k]}pcRepintar()}});
  document.getElementById("pcGal").onchange=async function(){var fs=Array.prototype.slice.call(this.files||[]);pcLeer();say("pcSt","Preparando las fotos…");
   for(var i=0;i<fs.length;i++){if(!/^image\//.test(fs[i].type))continue;var b=await shrink(fs[i]);S.pcGalNuevas.push({blob:b,url:URL.createObjectURL(b)})}pcRepintar()};
  m.querySelectorAll("[data-pcgq]").forEach(function(b){b.onclick=function(){var i=Number(b.dataset.pcgq);if(!confirm("¿Quitar esta foto?"))return;pcLeer();
   S.pcQuitar.push(S.pc.fotos.galeria[i]);S.pc.fotos.galeria.splice(i,1);pcRepintar()}});
  document.getElementById("pcAlMas").onclick=function(){pcLeer();S.pc.datos.alertas.push("");pcRepintar();var u=document.getElementById("pcAl_"+(S.pc.datos.alertas.length-1));if(u)u.focus()};
  document.getElementById("pcAlSug").onclick=function(){pcLeer();var ya=S.pc.datos.alertas.map(function(a){return norm(a).trim()}),nuevas=pcAlertasSugeridas(S.pc.datos).filter(function(a){return ya.indexOf(norm(a).trim())<0});
   S.pc.datos.alertas=S.pc.datos.alertas.filter(function(a){return pcTxt(a)}).concat(nuevas);pcRepintar();say("pcSt",nuevas.length?"Se agregaron "+nuevas.length+" alerta(s). Revisalas y quitá las que no van.":"No hay alertas nuevas para sugerir con lo cargado.")};
  m.querySelectorAll("[data-pcal-del]").forEach(function(b){b.onclick=function(){pcLeer();S.pc.datos.alertas.splice(Number(b.dataset.pcalDel),1);pcRepintar()}});
  document.getElementById("pcGMas").onclick=function(){pcLeer();S.pc.datos.gastos.push({desc:"",costo:""});pcRepintar();var u=document.getElementById("pcG_"+(S.pc.datos.gastos.length-1)+"_desc");if(u)u.focus()};
  m.querySelectorAll("[data-pcg-del]").forEach(function(b){b.onclick=function(){pcLeer();S.pc.datos.gastos.splice(Number(b.dataset.pcgDel),1);pcRepintar()}});
  if(document.getElementById("pcPadCli")){S.pcPadCli=pcPad(document.getElementById("pcPadCli"));document.getElementById("pcPadCliBorrar").onclick=function(){S.pcPadCli.limpiar();S.pcFirmaCli=null}}
  var rf=document.getElementById("pcReFirma");if(rf)rf.onclick=function(){pcLeer();S.pcFirmaCli="nueva";pcRepintar()};
  document.getElementById("pcGuardar").onclick=function(){pcGuardar(false)};
  document.getElementById("pcPdf").onclick=pcPdf;
  document.getElementById("pcContrato").onclick=pcContrato;
  document.getElementById("pcWa").onclick=function(){pcEnviar("wa")};
  document.getElementById("pcMailBtn").onclick=function(){pcEnviar("mail")};
  document.getElementById("pcVolver").onclick=function(){S.vista="precompras";route();window.scrollTo(0,0)};
  var bb=document.getElementById("pcBorrar");if(bb)bb.onclick=pcBorrar;
  pcClienteInfo();pcPintarHistorial();pcVivos();
}
// Repintar sin perder la posición en la pantalla
function pcRepintar(){var y=window.scrollY;pintarPrecompraForm();window.scrollTo(0,y)}
function pcV(id){var el=document.getElementById(id);return el?el.value.trim():""}
// Pasa lo escrito en pantalla a S.pc
function pcLeer(){
  var p=S.pc,D=p.datos;if(!document.getElementById("pcFecha"))return;
  p.fecha=pcV("pcFecha")||p.fecha;p.lugar=pcV("pcLugar");p.estado=pcV("pcEstado")||"borrador";
  p.cliente={nombre:pcV("pcCli"),dni:pcV("pcDni"),telefono:pcV("pcTel"),email:pcV("pcMail")};
  p.patente=normPatente(pcV("pcPat"));p.vin=pcV("pcVin").toUpperCase().replace(/[^A-Z0-9]/g,"");
  p.marca=pcV("pcMarca");p.modelo=pcV("pcModelo");p.anio=pcV("pcAnio")?parseInt(pcV("pcAnio"),10)||null:null;
  p.km=pcV("pcKm")?numAR(pcV("pcKm").replace(/\./g,""))||null:null;p.color=pcV("pcColor");p.combustible=pcV("pcComb");p.transmision=pcV("pcTrans");
  D.motor={cil:pcV("pcCil"),pot:pcV("pcPot"),tipo:pcV("pcTipoM")};
  p.motor=[D.motor.cil,D.motor.pot,D.motor.tipo].filter(Boolean).join(" ");
  D.resumen=pcV("pcResumen");
  PC_CATS.forEach(function(c){var o={pts:pcV("pcPts_"+c.k),obs:pcV("pcObs_"+c.k)};(PC_CAT_CAMPOS[c.k]||[]).forEach(function(f){o[f[0]]=pcV("pcC_"+c.k+"_"+f[0])});
   if(c.k==="inter")o.acorde=pcV("pcC_inter_acorde");D.cats[c.k]=o});
  PC_SECTORES.forEach(function(s){D.carroceria[s[0]]={estado:pcV("pcS_"+s[0]+"_estado"),um:pcV("pcS_"+s[0]+"_um"),obs:pcV("pcS_"+s[0]+"_obs")}});
  PC_NEU.forEach(function(n){D.neumaticos[n[0]]={dot:pcV("pcN_"+n[0]+"_dot"),mm:pcV("pcN_"+n[0]+"_mm"),vida:pcV("pcN_"+n[0]+"_vida")}});
  var par=pcV("pcFr_parejo");D.frenos={pd:pcV("pcFr_pd"),dd:pcV("pcFr_dd"),pt:pcV("pcFr_pt"),dt:pcV("pcFr_dt"),parejo:par?par==="si":null};
  D.escaneo={fallas:pcV("pcE_fallas")};PC_ESCANEO.forEach(function(x){var v=pcV("pcE_"+x[0]);D.escaneo[x[0]]=v?v==="ok":null});
  D.manejo={};PC_MANEJO.forEach(function(x){D.manejo[x[0]]=pcV("pcM_"+x[0])});
  D.interior={};PC_INTERIOR.forEach(function(x){D.interior[x[0]]=pcV("pcI_"+x[0])});
  D.alertas=(D.alertas||[]).map(function(a,i){var el=document.getElementById("pcAl_"+i);return el?el.value.trim():a});
  D.gastos=(D.gastos||[]).map(function(g,i){var c=pcV("pcG_"+i+"_costo");return {desc:pcV("pcG_"+i+"_desc"),costo:c?numAR(c)||0:""}});
  D.recom=pcV("pcRecom")||"auto";D.riesgo=pcV("pcRiesgo")||"auto";D.recom_txt=pcV("pcRecomTxt");
  D.observaciones=pcV("pcObsGen");D.responsable={nombre:pcV("pcRespNom"),matricula:pcV("pcRespMat")};
  D.contrato=Object.assign({},D.contrato,{aclaracion:pcV("pcCoAcl"),dni:pcV("pcCoDni")});
}
// Actualiza puntajes, barras, esquema y totales sin repintar todo
function pcVivos(){
  var D=S.pc.datos,tot=pcTotal(D),cal=pcCalif(tot,S.pcCfg);
  var t=document.getElementById("pcTot");if(t)t.innerHTML="<b style='color:"+pcRgb(cal.col)+"'>"+tot+"</b><span class='muted'>/100</span><span class='tag "+pcTagCalif(tot)+"'>"+esc(cal.txt)+"</span><span class='muted' style='margin-left:auto;font-size:.85rem'>Riesgo "+pcRiesgo(D,tot)+"</span>";
  var ca=document.getElementById("pcCalif");if(ca)ca.innerHTML="<p style='margin:0'>Calificación: <b style='color:"+pcRgb(cal.col)+"'>"+tot+"/100 · "+esc(cal.txt)+"</b></p>";
  PC_CATS.forEach(function(c){var p=pcPuntos(D,c.k),pct=p/c.max,b=document.getElementById("pcBar_"+c.k),tx=document.getElementById("pcPct_"+c.k),ob=document.getElementById("pcObs_"+c.k);
   if(b){b.style.width=Math.round(pct*100)+"%";b.style.background=pcRgb(pcColPct(pct))}
   if(tx)tx.textContent=p+" de "+c.max+" pts";
   if(ob)ob.placeholder=pcComentarioAuto(D,c.k)||"Se arma solo con los datos cargados"});
  var sv=document.getElementById("pcSvg");if(sv)sv.innerHTML=pcCarroSvg(D,96);
  var gt=document.getElementById("pcGTot");if(gt)gt.textContent=pcPlata(pcGastosTotal(D));
  var ri=document.getElementById("pcRecomInfo");if(ri)ri.textContent="Va a salir: "+pcRecomTxt(pcRecom(D,tot))+" · Riesgo "+pcRiesgo(D,tot)+".";
}

/* ---------- cliente ---------- */
function pcClientePorNombre(n){var k=norm(n).trim();return k?S.pcClientes.filter(function(c){return norm(c.nombre).trim()===k})[0]||null:null}
function pcClienteElegido(){
  var c=pcClientePorNombre(pcV("pcCli"));
  if(c){[["pcDni",c.dni_cuit],["pcTel",c.telefono],["pcMail",c.email]].forEach(function(x){var el=document.getElementById(x[0]);if(el&&!el.value.trim()&&x[1])el.value=x[1]});pcLeer()}
  pcClienteInfo();
}
function pcClienteInfo(){var el=document.getElementById("pcCliInfo");if(!el)return;var n=pcV("pcCli"),c=pcClientePorNombre(n);
  el.textContent=c?"Cliente cargado: se usan sus datos.":n?"Cliente nuevo: se carga en Clientes al guardar.":""}

/* ---------- historial por patente y VIN ---------- */
async function pcBuscarHistorial(){
  pcLeer();var p=S.pc,pat=p.patente,vin=p.vin;
  if(!pat&&!vin){S.pcHist=null;S.pcEquipo=null;pcPintarHistorial();return}
  var q=sb.from("precompras").select("id,codigo,fecha,puntaje,marca,modelo,anio,motor,combustible,transmision,color,patente,vin,datos");
  var filtros=[];if(pat)filtros.push("patente.eq."+pat);if(vin)filtros.push("vin.eq."+vin);
  var r=await q.or(filtros.join(",")).order("fecha",{ascending:false});
  S.pcHist=(r.data||[]).filter(function(x){return x.id!==p.id});
  // ¿el auto ya está cargado en el taller?
  S.pcEquipo=null;
  if(pat){var patron="%"+pat.split("").join("%")+"%",re=await sb.from("equipos").select("id,marca,modelo,anio,color,vin,motor,cilindrada,combustible,caja_tipo,matricula_patente,clientes(nombre)").ilike("matricula_patente",patron).limit(20);
   S.pcEquipo=(re.data||[]).filter(function(e){return normPatente(e.matricula_patente)===pat})[0]||null}
  if(!S.pcEquipo&&vin){var rv=await sb.from("equipos").select("id,marca,modelo,anio,color,vin,motor,cilindrada,combustible,caja_tipo,matricula_patente,clientes(nombre)").ilike("vin",vin).limit(1);S.pcEquipo=(rv.data||[])[0]||null}
  pcPintarHistorial();
}
function pcPintarHistorial(){
  var el=document.getElementById("pcHist");if(!el)return;var h="";
  if(S.pcHist&&S.pcHist.length){
   h+="<div class='status' style='margin:10px 0'><b>Este vehículo ya tiene "+S.pcHist.length+" inspecci"+(S.pcHist.length>1?"ones":"ón")+" en el taller:</b>"+
    S.pcHist.slice(0,5).map(function(x,i){return "<div class='lr' style='margin-top:6px'><span>"+esc(x.codigo||"")+" · "+esc(pcFecha(x.fecha).replace(/ /g,""))+" · <b>"+(Number(x.puntaje)||0)+"/100</b></span><span style='display:flex;gap:6px'><button class='btn o' data-pch-ver='"+x.id+"' style='padding:4px 10px;min-height:0'>Ver</button><button class='btn o' data-pch-usar='"+i+"' style='padding:4px 10px;min-height:0'>Usar datos</button></span></div>"}).join("")+"</div>";
  }
  if(S.pcEquipo&&S.pc.equipo_id!==S.pcEquipo.id){var e=S.pcEquipo;
   h+="<div class='status' style='margin:10px 0'>Este auto ya está cargado en el taller"+(e.clientes&&e.clientes.nombre?" (cliente "+esc(e.clientes.nombre)+")":"")+". <button class='btn o' id='pcUsarEq' style='padding:4px 10px;min-height:0;margin-left:6px'>Completar con su ficha</button></div>"}
  else if(S.pcEquipo)h+="<p class='muted' style='font-size:.85rem;margin:6px 0 0'>Vinculado a la ficha del vehículo en el taller.</p>";
  el.innerHTML=h;
  el.querySelectorAll("[data-pch-ver]").forEach(function(b){b.onclick=function(){if(confirm("¿Abrir ese informe? Lo que no guardaste de este se pierde."))irPrecompra(b.dataset.pchVer)}});
  el.querySelectorAll("[data-pch-usar]").forEach(function(b){b.onclick=function(){var x=S.pcHist[Number(b.dataset.pchUsar)];pcLeer();
   ["marca","modelo","anio","color","combustible","transmision"].forEach(function(k){if(!S.pc[k]&&x[k])S.pc[k]=x[k]});
   if(!S.pc.vin&&x.vin)S.pc.vin=x.vin;if(!S.pc.patente&&x.patente)S.pc.patente=x.patente;
   var mo=(x.datos&&x.datos.motor)||{};if(!S.pc.datos.motor.cil&&!S.pc.datos.motor.pot)S.pc.datos.motor=Object.assign({},mo);
   pcRepintar();say("pcSt","Se completaron los datos del vehículo con la inspección anterior.")}});
  var ue=document.getElementById("pcUsarEq");if(ue)ue.onclick=function(){var e=S.pcEquipo;pcLeer();S.pc.equipo_id=e.id;
   if(!S.pc.marca)S.pc.marca=e.marca||"";if(!S.pc.modelo)S.pc.modelo=e.modelo||"";if(!S.pc.anio)S.pc.anio=e.anio||null;if(!S.pc.color)S.pc.color=e.color||"";
   if(!S.pc.vin&&e.vin)S.pc.vin=String(e.vin).toUpperCase().replace(/[^A-Z0-9]/g,"");if(!S.pc.combustible&&e.combustible)S.pc.combustible=e.combustible;
   if(!S.pc.transmision&&e.caja_tipo)S.pc.transmision=cajaTxt(e.caja_tipo);
   if(!S.pc.datos.motor.cil)S.pc.datos.motor.cil=[e.motor,e.cilindrada].filter(Boolean).join(" ");
   pcRepintar();say("pcSt","Se completaron los datos con la ficha del vehículo.")};
}

/* ---------- firma en pantalla ---------- */
function pcPad(c){
  var ctx,hay=false,traza=false,last=null;
  function prep(){var r=c.getBoundingClientRect(),d=window.devicePixelRatio||1;c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));
   ctx=c.getContext("2d");ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.scale(d,d);ctx.lineWidth=2.4;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#1a2f7a";hay=false}
  prep();
  function pos(e){var r=c.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
  c.onpointerdown=function(e){e.preventDefault();c.setPointerCapture(e.pointerId);traza=true;last=pos(e);ctx.beginPath();ctx.arc(last.x,last.y,1.1,0,7);ctx.fillStyle="#1a2f7a";ctx.fill();hay=true};
  c.onpointermove=function(e){if(!traza)return;var p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;hay=true};
  c.onpointerup=c.onpointercancel=function(){traza=false};
  return {limpiar:prep,vacio:function(){return !hay},blob:function(){return new Promise(function(res){c.toBlob(res,"image/png")})}};
}

/* ---------- guardar ---------- */
async function pcGuardar(quedarse){
  pcLeer();
  var p=S.pc,D=p.datos,bt=document.getElementById("pcGuardar");
  if(!p.patente&&!p.marca&&!p.modelo){say("pcSt","Cargá al menos la patente o la marca y el modelo.",true);return false}
  if(bt)bt.disabled=true;
  try{
   // cliente: el cargado (completando lo que le falte) o uno nuevo
   var C=p.cliente,c=pcClientePorNombre(C.nombre);
   if(c){p.cliente_id=c.id;var falta={};if(!c.dni_cuit&&C.dni)falta.dni_cuit=C.dni;if(!c.email&&C.email)falta.email=C.email;if(!c.telefono&&C.telefono)falta.telefono=C.telefono;
    if(Object.keys(falta).length){var ru=await sb.from("clientes").update(falta).eq("id",c.id);if(!ru.error)Object.assign(c,falta)}}
   else if(C.nombre){var cd={taller_id:S.taller.id,nombre:C.nombre,telefono:C.telefono||"",dni_cuit:C.dni||null,email:C.email||null};
    var rn=await sb.from("clientes").insert(cd).select().single();
    if(rn.error&&/column|schema cache/i.test(rn.error.message))rn=await sb.from("clientes").insert({taller_id:S.taller.id,nombre:C.nombre,telefono:cd.telefono}).select().single();
    if(rn.error)throw "No se pudo cargar el cliente: "+rn.error.message;
    S.pcClientes.push(rn.data);p.cliente_id=rn.data.id}
   else p.cliente_id=null;
   if(!p.equipo_id&&S.pcEquipo)p.equipo_id=S.pcEquipo.id;
   if(!D.firma_ruta&&S.pcCfg.firma_ruta)D.firma_ruta=S.pcCfg.firma_ruta;
   // firma del cliente en pantalla
   var firmaBlob=S.pcPadCli&&document.getElementById("pcPadCli")&&!S.pcPadCli.vacio()?await S.pcPadCli.blob():null;
   say("pcSt","Guardando…");
   var fila={fecha:p.fecha,lugar:p.lugar||null,estado:p.estado,cliente_id:p.cliente_id,equipo_id:p.equipo_id||null,cliente:p.cliente,marca:p.marca||null,modelo:p.modelo||null,anio:p.anio,
    patente:p.patente||null,vin:p.vin||null,km:p.km,motor:p.motor||null,combustible:p.combustible||null,transmision:p.transmision||null,color:p.color||null,puntaje:pcTotal(D),datos:D,fotos:p.fotos};
   var r=p.id?await sb.from("precompras").update(fila).eq("id",p.id).select().single():await sb.from("precompras").insert(Object.assign({taller_id:S.taller.id},fila)).select().single();
   if(r.error)throw pcErrSql(r.error)?FALTA_SQL_PC:r.error.message;
   var id=r.data.id,fotos=Object.assign({},p.fotos),errores=0,claves=Object.keys(S.pcNuevas),n=0,totalF=claves.length+S.pcGalNuevas.length;
   for(var i=0;i<claves.length;i++){n++;say("pcSt","Subiendo fotos ("+n+" de "+totalF+")…");
    var ruta=S.taller.id+"/"+id+"/"+claves[i]+"_"+Date.now()+".jpg",up=await sb.storage.from("precompra").upload(ruta,S.pcNuevas[claves[i]].blob,{contentType:"image/jpeg"});
    if(up.error)errores++;else{if(fotos[claves[i]])S.pcQuitar.push(fotos[claves[i]]);fotos[claves[i]]=ruta}}
   fotos.galeria=(fotos.galeria||[]).slice();
   for(var j=0;j<S.pcGalNuevas.length;j++){n++;say("pcSt","Subiendo fotos ("+n+" de "+totalF+")…");
    var rg=S.taller.id+"/"+id+"/galeria_"+Date.now()+"_"+j+".jpg",ug=await sb.storage.from("precompra").upload(rg,S.pcGalNuevas[j].blob,{contentType:"image/jpeg"});
    if(ug.error)errores++;else fotos.galeria.push(rg)}
   var datos=r.data.datos||D;
   if(firmaBlob){var rf=S.taller.id+"/precompra/"+id+"/firma_cliente_"+Date.now()+".png",uf=await sb.storage.from("documentos").upload(rf,firmaBlob,{contentType:"image/png"});
    if(uf.error)errores++;else{if(datos.contrato&&datos.contrato.firma_ruta)await sb.storage.from("documentos").remove([datos.contrato.firma_ruta]);datos.contrato=Object.assign({},datos.contrato,{firma_ruta:rf,firmado:new Date().toISOString()})}}
   if(totalF||firmaBlob){var r2=await sb.from("precompras").update({fotos:fotos,datos:datos}).eq("id",id).select().single();if(r2.error)throw r2.error.message;r=r2}
   if(S.pcQuitar.length)await sb.storage.from("precompra").remove(S.pcQuitar);
   S.pc=r.data;S.pc.datos=Object.assign({cats:{},carroceria:{},neumaticos:{},frenos:{},escaneo:{},manejo:{},interior:{},alertas:[],gastos:[],responsable:{},contrato:{}},S.pc.datos||{});S.pc.fotos=S.pc.fotos||{};
   S.pcEdit=id;S.pcNuevas={};S.pcGalNuevas=[];S.pcQuitar=[];S.pcFirmaCli=null;
   pcRepintar();
   say("pcSt",errores?"Se guardó el informe "+S.pc.codigo+", pero "+errores+" archivo(s) no se pudieron subir. Probá agregarlos de nuevo.":"Informe "+S.pc.codigo+" guardado.",!!errores);
   return true;
  }catch(e){if(bt)bt.disabled=false;say("pcSt",typeof e==="string"?e:"No se pudo guardar.",true);return false}
}
async function pcBorrar(){
  var p=S.pc;if(!confirm("¿Eliminar el informe "+(p.codigo||"")+"? Se borran también sus fotos."))return;
  var r=await sb.from("precompras").delete().eq("id",p.id);if(r.error){say("pcSt",r.error.message,true);return}
  var F=p.fotos||{},rutas=Object.keys(F).filter(function(k){return k!=="galeria"}).map(function(k){return F[k]}).concat(F.galeria||[]).filter(Boolean);
  if(rutas.length)await sb.storage.from("precompra").remove(rutas);
  if(p.datos&&p.datos.contrato&&p.datos.contrato.firma_ruta)await sb.storage.from("documentos").remove([p.datos.contrato.firma_ruta]);
  S.vista="precompras";route();
}

/* ---------- PDF, WhatsApp y correo ---------- */
async function pcCompartir(r,texto){
  var blob=r.doc.output("blob"),file=null;
  try{file=new File([blob],r.nombre,{type:"application/pdf"})}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
   try{await navigator.share({files:[file],title:r.nombre,text:texto});say("pcSt","Listo.");return}
   catch(e){if(e&&e.name==="AbortError"){document.getElementById("pcSt").classList.add("hide");return}}
  }
  r.doc.save(r.nombre);say("pcSt","PDF descargado. Adjuntalo en el WhatsApp o el correo del cliente.");
}
async function pcPdf(){
  if(!window.jspdf){say("pcSt","No se pudo cargar el generador de PDF. Revisá la conexión.",true);return}
  if(!(await pcGuardar(true)))return;
  say("pcSt","Armando el PDF del informe…");
  try{var r=await pcPdfInforme(S.pc,S.taller,S.pcCfg);await pcCompartir(r,"Informe de verificación pre compra "+S.pc.codigo)}
  catch(e){say("pcSt","No se pudo armar el PDF.",true)}
}
async function pcContrato(){
  if(!window.jspdf){say("pcSt","No se pudo cargar el generador de PDF. Revisá la conexión.",true);return}
  if(!(await pcGuardar(true)))return;
  say("pcSt","Armando el contrato…");
  try{
   var co=S.pc.datos.contrato||{},firmaUrl=null;
   if(co.firma_ruta){var sg=await sb.storage.from("documentos").createSignedUrl(co.firma_ruta,600);firmaUrl=sg.data&&sg.data.signedUrl}
   var fr=S.pc.datos.firma_ruta||S.pcCfg.firma_ruta;
   var r=await pcPdfContrato(S.pc,S.taller,S.pcCfg,firmaUrl,fr?pcUrlFoto(fr):null);
   await pcCompartir(r,"Contrato de verificación pre compra "+S.pc.codigo);
  }catch(e){say("pcSt","No se pudo armar el contrato.",true)}
}
function pcMensaje(){
  var p=S.pc,tot=pcTotal(p.datos),nombre=(p.cliente&&p.cliente.nombre||"").split(" ")[0];
  return "Hola"+(nombre?" "+nombre:"")+", te enviamos el informe de verificación pre compra "+p.codigo+" del "+[p.marca,p.modelo,p.anio].filter(Boolean).join(" ")+(p.patente?" ("+p.patente+")":"")+
   ".\nPuntaje: "+tot+"/100 · "+pcCalif(tot,S.pcCfg).txt+".\n\nInforme digital con todas las fotos:\n"+pcUrlInforme(p.qr_token)+"\n\n"+S.taller.nombre;
}
async function pcEnviar(via){
  if(!(await pcGuardar(true)))return;
  var p=S.pc,msg=pcMensaje();
  if(via==="wa"){var tel=telWa(p.cliente&&p.cliente.telefono);window.open(tel?"https://wa.me/"+tel+"?text="+encodeURIComponent(msg):"https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank","noopener");
   say("pcSt","Se abrió WhatsApp con el enlace al informe. Si querés mandar también el PDF, tocá PDF del informe.")}
  else{location.href="mailto:"+encodeURIComponent(p.cliente&&p.cliente.email||"")+"?subject="+encodeURIComponent("Informe de verificación pre compra "+p.codigo)+"&body="+encodeURIComponent(msg);
   say("pcSt","Se abrió el correo con el enlace al informe. Para adjuntar el PDF, descargalo con PDF del informe.")}
}

/* ---------- ajustes ---------- */
async function renderPrecompraAjustes(){
  if(!pcSoloAutos())return;pcEstilos();
  m.innerHTML="<h1>Ajustes del informe pre compra</h1><div id='box'>"+skel()+"</div>";
  var err=await pcCargarConfig();
  if(err&&pcErrSql(err)){document.getElementById("box").innerHTML="<div class='status err'>"+FALTA_SQL_PC+"</div>";return}
  var c=S.pcCfg,rg=pcRangos(c),pref=c.prefijo||String(S.taller.nombre||"").trim().split(/\s+/)[0].replace(/[^A-Za-z0-9]/g,"").slice(0,4).toUpperCase();
  var h="<div class='card'><h2>Número de informe</h2>"+pcIn("pcAPref","Prefijo",pref," style='text-transform:uppercase' maxlength='8'")+
   "<p class='muted' style='font-size:.85rem;margin:6px 0 0'>Queda así: <b id='pcAEj'></b> (prefijo, año y mes, y el número que sigue). Los informes ya hechos no cambian.</p></div>";
  h+="<div class='card'><h2>Datos por defecto</h2>"+pcIn("pcALugar","Lugar de inspección",c.lugar," placeholder='CABA, Buenos Aires'")+
   "<div class='g2'>"+pcIn("pcAResp","Mecánico responsable",c.responsable)+pcIn("pcAMat","Matrícula profesional",c.matricula)+"</div>"+
   "<label>Firma del responsable</label>"+(c.firma_ruta?"<img src=\""+esc(pcUrlFoto(c.firma_ruta))+"\" alt='Firma guardada' style='max-width:100%;max-height:110px;background:#fff;border-radius:8px;display:block;margin-bottom:8px'>":"")+
   "<canvas id='pcPadTec' class='pcPad'></canvas><p class='muted' style='font-size:.85rem;margin:6px 0 0'>"+(c.firma_ruta?"Para cambiarla, firmá de nuevo en el recuadro.":"Firmá con el dedo dentro del recuadro.")+"</p>"+
   "<div class='btns' style='margin-top:6px'><button class='btn o' id='pcPadTecBorrar' style='padding:4px 10px;min-height:0'>Borrar</button></div></div>";
  h+="<div class='card'><h2>Calificación por puntaje</h2><p class='muted' style='margin-top:0;font-size:.9rem'>Desde qué puntaje va cada etiqueta.</p>"+
   rg.map(function(r,i){return "<div class='g2'>"+pcIn("pcAMin_"+i,"Desde",i===4?0:r.min," inputmode='numeric'"+(i===4?" disabled":""))+pcIn("pcATxt_"+i,"Etiqueta",r.txt)+"</div>"}).join("")+
   "<div class='btns'><button class='btn o' id='pcARest' style='padding:6px 12px;min-height:0'>Volver a los rangos de fábrica</button></div></div>";
  h+="<div id='pcASt' class='status hide'></div><div class='btns'><button class='btn' id='pcAGuardar'>Guardar ajustes</button><button class='btn o' id='pcAVolver'>Volver</button></div>";
  document.getElementById("box").innerHTML=h;
  var pad=pcPad(document.getElementById("pcPadTec"));document.getElementById("pcPadTecBorrar").onclick=pad.limpiar;
  var ej=function(){var d=new Date();document.getElementById("pcAEj").textContent=(pcV("pcAPref").toUpperCase().replace(/[^A-Z0-9]/g,"")||"INF")+"-"+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,"0")+"001"};
  document.getElementById("pcAPref").oninput=ej;ej();
  document.getElementById("pcARest").onclick=function(){PC_RANGOS.forEach(function(r,i){document.getElementById("pcAMin_"+i).value=r.min;document.getElementById("pcATxt_"+i).value=r.txt})};
  document.getElementById("pcAVolver").onclick=function(){S.vista="precompras";route()};
  document.getElementById("pcAGuardar").onclick=async function(){
   var bt=this,rangos=[];
   for(var i=0;i<5;i++){var mn=i===4?0:parseInt(pcV("pcAMin_"+i),10);if(isNaN(mn)){say("pcASt","Revisá los puntajes de la calificación.",true);return}rangos.push({min:mn,txt:pcV("pcATxt_"+i)||PC_RANGOS[i].txt})}
   for(var k=1;k<5;k++)if(rangos[k].min>=rangos[k-1].min){say("pcASt","Cada rango tiene que empezar en un puntaje menor que el de arriba.",true);return}
   bt.disabled=true;say("pcASt","Guardando…");
   var d={taller_id:S.taller.id,prefijo:pcV("pcAPref").toUpperCase().replace(/[^A-Z0-9]/g,"")||null,lugar:pcV("pcALugar")||null,responsable:pcV("pcAResp")||null,matricula:pcV("pcAMat")||null,rangos:rangos,firma_ruta:c.firma_ruta||null,actualizado:new Date().toISOString()};
   if(!pad.vacio()){var b=await pad.blob(),ruta=S.taller.id+"/config/firma_"+Date.now()+".png",up=await sb.storage.from("precompra").upload(ruta,b,{contentType:"image/png"});
    if(up.error){bt.disabled=false;say("pcASt","No se pudo subir la firma: "+up.error.message,true);return}d.firma_ruta=ruta}
   var r=await sb.from("precompra_config").upsert(d,{onConflict:"taller_id"});
   if(r.error){bt.disabled=false;say("pcASt",pcErrSql(r.error)?FALTA_SQL_PC:r.error.message,true);return}
   S.pcCfg=d;S.vista="precompras";route();
  };
}
