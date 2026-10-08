// Cuentas corrientes de proveedores con IA (plan Oro): se sube una o varias fotos/PDF
// (facturas, recibos, resúmenes de cuenta) o se pega un texto; la IA arma la lista de
// compras y pagos, se asocia cada una a su proveedor, se marcan los posibles duplicados
// y el taller revisa y corrige todo antes de confirmar. El saldo se actualiza solo.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.provIA=renderProvIA;GRUPOS.provIA="proveedores";

var TIPOS_OP=[["compra","Factura"],["pago","Pago"],["nota_credito","Nota de crédito"]];
function tipoOpTxt(t){var x=TIPOS_OP.filter(function(y){return y[0]===t})[0];return x?x[1]:t}
function medioProvTxt(v){return v==="nota_credito"?"Nota de crédito":medioTxt(v)}
function soloDigitos(s){return String(s||"").replace(/\D/g,"")}
function irProvIA(provId){S.iaProvDef=provId||"";S.iaOps=null;S.iaAvisos=null;irProv("provIA")}

async function renderProvIA(){
  m.innerHTML="<h1>Cuentas corrientes con IA</h1><div id='box'>"+skel()+"</div>";
  var box=document.getElementById("box");
  if(!esOro()){
   box.innerHTML="<div class='card'><p style='margin-top:0'>Subís fotos o PDF de facturas, recibos o el resumen de cuenta que te manda el proveedor, y la IA carga las compras y los pagos sola: detecta duplicados, los asocia a cada proveedor y actualiza el saldo. Vos revisás todo antes de confirmar.</p>"+
    "<p class='muted'>Es una función del plan <b>Oro</b>.</p><div class='btns'>"+(esDueno()?"<button class='btn' id='iaPlan'>Ver los planes</button>":"")+"<button class='btn o' id='iaVolver'>Volver</button></div></div>";
   var bp=document.getElementById("iaPlan");if(bp)bp.onclick=function(){S.vista="plan";route()};
   document.getElementById("iaVolver").onclick=function(){irProv("proveedores")};
   return;
  }
  var rp=await sb.from("proveedores").select("*").order("nombre");
  if(rp.error){box.innerHTML="<div class='status err'>"+FALTA_SQL_PROV+"</div>";return}
  S.iaProvs=rp.data||[];
  try{S.iaCta=await cuentaProveedores()}catch(e){box.innerHTML="<div class='status err'>"+esc(e.message)+"</div>";return}
  if(S.iaOps)pintarRevisionIA();else pintarCargaIA();
}

/* ---------- paso 1: subir el material ---------- */
function pintarCargaIA(){
  var h="<div class='card'><h2>1. ¿Qué querés cargar?</h2><p class='muted' style='margin-top:0'>Fotos o PDF de facturas, notas de crédito, recibos, transferencias o el resumen de cuenta del proveedor. Podés elegir varios archivos juntos.</p>"+
   "<input type='file' id='iaArch' accept='image/*,application/pdf' multiple aria-label='Fotos o PDF'>"+
   "<div id='iaNoms' class='muted' style='margin-top:6px'></div>"+
   "<label for='iaTexto'>O pegá el texto (mensaje del proveedor, planilla, resumen)</label><textarea id='iaTexto' rows='5' placeholder='12/09 Factura A 0001-00004567 $ 85.300&#10;20/09 Transferencia $ 50.000'></textarea>"+
   "<label for='iaProvDef'>Si no se reconoce el proveedor, usar</label><select id='iaProvDef'><option value=''>Que lo detecte la IA</option>"+S.iaProvs.map(function(p){return "<option value='"+p.id+"'"+(p.id===S.iaProvDef?" selected":"")+">"+esc(p.nombre)+"</option>"}).join("")+"</select>"+
   "<div id='iaSt' class='status hide'></div><div class='btns'><button class='btn' id='iaLeer'>"+ic("image")+" Leer con IA</button><button class='btn o' id='iaManual'>"+ic("plus")+" Cargar a mano</button><button class='btn o' id='iaVolver'>Volver</button></div></div>"+
   "<p class='muted' style='font-size:.88rem'>Nada se guarda hasta que revises la lista y toques <b>Confirmar</b>.</p>";
  document.getElementById("box").innerHTML=h;
  var fa=document.getElementById("iaArch");
  fa.onchange=function(){document.getElementById("iaNoms").textContent=Array.prototype.map.call(fa.files,function(f){return f.name}).join(" · ")};
  document.getElementById("iaProvDef").onchange=function(){S.iaProvDef=this.value};
  document.getElementById("iaVolver").onclick=function(){irProv(S.iaProvDef?"provDetalle":"proveedores",S.iaProvDef?{provSel:S.iaProvDef}:null)};
  document.getElementById("iaManual").onclick=function(){S.iaArchivos=[];S.iaOps=[opVacia()];S.iaAvisos=null;pintarRevisionIA()};
  document.getElementById("iaLeer").onclick=leerConIA;
}
function achicar(file,max){return new Promise(function(res,rej){var img=new Image(),u=URL.createObjectURL(file);
  img.onerror=function(){URL.revokeObjectURL(u);rej("No se pudo abrir la imagen "+file.name)};
  img.onload=function(){var s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
   c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){res(b)},"image/jpeg",.85)};img.src=u})}
async function pedirIA(cuerpo){
  var resp=await fetch("/api/cuenta-corriente-ia",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(Object.assign({taller_id:S.taller.id,access_token:S.session.access_token,taller:S.taller.nombre,proveedores:S.iaProvs.map(function(p){return {nombre:p.nombre,cuit:p.cuit}})},cuerpo))});
  var r;try{r=await resp.json()}catch(e){throw "El servidor no respondió bien. Probá de nuevo."}
  if(r.error)throw r.error;
  return r.operaciones||[];
}
async function leerConIA(){
  var files=Array.prototype.slice.call(document.getElementById("iaArch").files||[]),texto=document.getElementById("iaTexto").value.trim();
  if(!files.length&&!texto){say("iaSt","Elegí al menos una foto o PDF, o pegá un texto.",true);return}
  var bt=document.getElementById("iaLeer");bt.disabled=true;
  var ops=[],avisos=[];
  for(var i=0;i<files.length;i++){
   var f=files[i];say("iaSt","Leyendo "+(files.length>1?"("+(i+1)+" de "+files.length+") ":"")+f.name+"… puede tardar unos segundos.");
   try{
    var pdf=f.type==="application/pdf"||/\.pdf$/i.test(f.name),blob=f,tipo="application/pdf";
    if(pdf){if(f.size>3.5*1024*1024)throw "pesa mucho para leerlo (máx. 3,5 MB); subí fotos de las hojas"}
    else{blob=await achicar(f,2000);tipo="image/jpeg"}
    var res=await pedirIA({archivo:await aBase64(blob),tipo:tipo});
    if(!res.length)avisos.push(f.name+": no se encontraron operaciones.");
    res.forEach(function(o){o._archivo=i;o._fuente=f.name;ops.push(o)});
   }catch(e){avisos.push(f.name+": "+(typeof e==="string"?e:"no se pudo leer."))}
  }
  if(texto){
   say("iaSt","Leyendo el texto…");
   try{var rt=await pedirIA({texto:texto});if(!rt.length)avisos.push("En el texto no se encontraron operaciones.");rt.forEach(function(o){o._fuente="Texto pegado";ops.push(o)})}
   catch(e){avisos.push("Texto: "+(typeof e==="string"?e:"no se pudo leer."))}
  }
  bt.disabled=false;
  if(!ops.length){say("iaSt",avisos.join(" ")||"No se encontraron operaciones.",true);return}
  S.iaArchivos=files;S.iaAvisos=avisos;
  S.iaOps=ops.map(normalizarOp);
  marcarDuplicados(true);
  pintarRevisionIA();window.scrollTo(0,0);
}
function opVacia(){return {incluir:true,tipo:"compra",prov:S.iaProvDef||"",numero:"",fecha:hoyISO(),vencimiento:"",importe:0,medio:"transferencia",obs:"",fuente:"A mano",archivo:null}}
// Busca el proveedor por CUIT y después por nombre; si no está, se propone crearlo
function provDeIA(nombre,cuit){
  var c=soloDigitos(cuit),n=norm(nombre).trim(),ps=S.iaProvs;
  if(c.length>=8){var x=ps.filter(function(p){return soloDigitos(p.cuit)===c})[0];if(x)return x.id}
  if(n){
   var y=ps.filter(function(p){return norm(p.nombre).trim()===n})[0]||
    ps.filter(function(p){var pn=norm(p.nombre).trim();return pn.length>=4&&n.length>=4&&(pn.indexOf(n)>=0||n.indexOf(pn)>=0)})[0];
   if(y)return y.id;
   return "nuevo:"+String(nombre).trim();
  }
  return S.iaProvDef||"";
}
function normalizarOp(o){
  var fecha=/^\d{4}-\d\d-\d\d$/.test(o.fecha||"")?o.fecha:"",venc=/^\d{4}-\d\d-\d\d$/.test(o.vencimiento||"")?o.vencimiento:"";
  var medio=MEDIOS.some(function(md){return md[0]===o.medio_pago})?o.medio_pago:"transferencia";
  return {incluir:true,tipo:o.tipo,prov:provDeIA(o.proveedor,o.cuit),cuit:o.cuit||"",numero:o.numero||"",fecha:fecha,vencimiento:o.tipo==="compra"?venc:"",
   importe:redondo(o.importe),medio:medio,obs:o.observaciones||"",fuente:o._fuente||"",archivo:o._archivo==null?null:o._archivo};
}

/* ---------- duplicados ---------- */
function mismoImporte(a,b){return Math.abs((Number(a)||0)-(Number(b)||0))<0.01}
function claveOp(o){
  var grupo=o.tipo==="compra"?"c":"p",num=soloDigitos(o.numero);
  return o.prov+"|"+grupo+"|"+(num.length>=3?"n"+num:"f"+o.fecha+"|"+redondo(o.importe));
}
function duplicadoDe(o,i){
  if(!o.prov)return null;
  if(o.prov.indexOf("nuevo:")!==0){
   var num=soloDigitos(o.numero);
   if(o.tipo==="compra"){
    var c=S.iaCta.compras.filter(function(c){if(c.proveedor_id!==o.prov)return false;var cn=soloDigitos(c.numero);
     return (num.length>=3&&cn.length>=3)?cn===num:(c.fecha===o.fecha&&mismoImporte(c.total,o.importe))})[0];
    if(c)return "Ya está cargada: factura "+(c.numero?"Nº "+c.numero+" ":"")+"del "+fechaAR(c.fecha)+" por "+money(c.total);
   }else{
    var p=S.iaCta.pagos.filter(function(p){return p.proveedor_id===o.prov&&p.fecha===o.fecha&&mismoImporte(p.importe,o.importe)})[0];
    if(p)return "Ya hay un pago del "+fechaAR(p.fecha)+" por "+money(p.importe);
   }
  }
  var k=claveOp(o);
  for(var j=0;j<i;j++)if(S.iaOps[j].incluir&&claveOp(S.iaOps[j])===k)return "Está repetida en lo que subiste ("+esc(S.iaOps[j].fuente||"otra")+")";
  return null;
}
// Recalcula los duplicados; la primera vez (o si aparece uno nuevo) la destilda sola
function marcarDuplicados(inicial){
  S.iaOps.forEach(function(o,i){if(o.dup==="Ya quedó guardada.")return;var d=duplicadoDe(o,i);if(d&&(inicial||!o.dup))o.incluir=false;o.dup=d});
}

/* ---------- paso 2: revisar y corregir ---------- */
function nombreProvOp(v){if(!v)return "";if(v.indexOf("nuevo:")===0)return v.slice(6);var p=S.iaProvs.filter(function(x){return x.id===v})[0];return p?p.nombre:""}
function pintarRevisionIA(){
  var ops=S.iaOps,inc=ops.filter(function(o){return o.incluir}),ndup=ops.filter(function(o){return o.dup}).length;
  var nuevos={};ops.forEach(function(o){if(o.prov.indexOf("nuevo:")===0)nuevos[o.prov]=1});
  var h="<div class='card'><h2>2. Revisá y corregí</h2><p class='muted' style='margin-top:0'>La IA encontró <b>"+ops.length+"</b> operaci"+(ops.length===1?"ón":"ones")+(ndup?", <b style='color:var(--br)'>"+ndup+" posible"+(ndup===1?"":"s")+" duplicado"+(ndup===1?"":"s")+"</b> (quedan sin tildar)":"")+
   ". Cambiá lo que haga falta y destildá lo que no quieras cargar.</p>"+(S.iaAvisos&&S.iaAvisos.length?"<div class='status err'>"+esc(S.iaAvisos.join(" "))+"</div>":"")+"</div>";
  // cómo queda la cuenta de cada proveedor
  var porProv={};inc.forEach(function(o){if(!o.prov)return;porProv[o.prov]=(porProv[o.prov]||0)+(o.tipo==="compra"?1:-1)*(Number(o.importe)||0)});
  var saldoAct={};S.iaCta.compras.forEach(function(c){saldoAct[c.proveedor_id]=(saldoAct[c.proveedor_id]||0)+(Number(c.total)||0)});S.iaCta.pagos.forEach(function(p){saldoAct[p.proveedor_id]=(saldoAct[p.proveedor_id]||0)-(Number(p.importe)||0)});
  var ks=Object.keys(porProv);
  if(ks.length)h+="<div class='card'><h2>Cómo quedan las cuentas</h2><table class='t'><tr><th>Proveedor</th><th>Saldo hoy</th><th>Saldo nuevo</th></tr>"+ks.map(function(k){var a=redondo(saldoAct[k]),n=redondo(a+porProv[k]);
   return "<tr><td style='font-family:var(--f-body)'>"+esc(nombreProvOp(k))+(k.indexOf("nuevo:")===0?" <span class='tag w'>Nuevo</span>":"")+"</td><td>"+money(a)+"</td><td><b style='color:"+(n>0?"var(--bad)":"var(--ok)")+"'>"+(n<0?money(-n)+" a favor":money(n))+"</b></td></tr>"}).join("")+"</table></div>";
  h+=ops.map(function(o,i){
   var provOpts="<option value=''>Elegí el proveedor…</option>"+S.iaProvs.map(function(p){return "<option value='"+p.id+"'"+(p.id===o.prov?" selected":"")+">"+esc(p.nombre)+"</option>"}).join("")+
    Object.keys(nuevos).map(function(k){return "<option value=\""+esc(k)+"\""+(k===o.prov?" selected":"")+">+ Nuevo: "+esc(k.slice(6))+"</option>"}).join("");
   return "<div class='card' data-op='"+i+"' style='padding:12px 14px;"+(o.incluir?"":"opacity:.6")+"'>"+
    "<div class='lr'><label style='display:flex;gap:10px;align-items:center;margin:0;text-transform:none;letter-spacing:normal;font-size:1rem;color:var(--ink);font-family:var(--f-body)'><input type='checkbox' data-k='incluir'"+(o.incluir?" checked":"")+" style='width:24px;min-height:24px'> <b>Cargar</b></label>"+
    "<span class='muted' style='font-size:.8rem;text-align:right'>"+esc(o.fuente)+"</span></div>"+
    (o.dup?"<div class='status err' style='margin-top:8px'>Posible duplicado. "+o.dup+"</div>":"")+
    "<div class='g2'><div><label>Tipo</label><select data-k='tipo'>"+TIPOS_OP.map(function(t){return "<option value='"+t[0]+"'"+(t[0]===o.tipo?" selected":"")+">"+t[1]+"</option>"}).join("")+"</select></div>"+
    "<div><label>Importe</label><input data-k='importe' inputmode='decimal' value=\""+esc(String(o.importe||"").replace(".",","))+"\"></div></div>"+
    "<label>Proveedor</label><select data-k='prov'>"+provOpts+"</select>"+
    "<div class='g2'><div><label>Fecha</label><input type='date' data-k='fecha' value='"+esc(o.fecha)+"'></div><div><label>Nº de comprobante</label><input data-k='numero' value=\""+esc(o.numero)+"\"></div></div>"+
    (o.tipo==="compra"?"<label>Vencimiento</label><input type='date' data-k='vencimiento' value='"+esc(o.vencimiento)+"'>":"")+
    (o.tipo==="pago"?"<label>Medio de pago</label><select data-k='medio'>"+MEDIOS.map(function(md){return "<option value='"+md[0]+"'"+(md[0]===o.medio?" selected":"")+">"+md[1]+"</option>"}).join("")+"</select>":"")+
    "<label>Observaciones</label><input data-k='obs' value=\""+esc(o.obs)+"\"></div>"}).join("");
  var tc=inc.filter(function(o){return o.tipo==="compra"}).length,tp=inc.length-tc;
  h+="<div id='iaSt2' class='status hide'></div><div class='btns'><button class='btn' id='iaOk'"+(inc.length?"":" disabled")+">Confirmar y cargar "+inc.length+(inc.length===1?" operación":" operaciones")+"</button>"+
   "<button class='btn o' id='iaMas'>"+ic("plus")+" Agregar una a mano</button><button class='btn o' id='iaOtra'>Empezar de nuevo</button></div>"+
   (inc.length?"<p class='muted' style='font-size:.88rem'>Se van a cargar "+tc+" factura"+(tc===1?"":"s")+" y "+tp+" pago"+(tp===1?"":"s")+"/nota"+(tp===1?"":"s")+" de crédito. Los pagos se aplican solos a las facturas más viejas. No se registra nada en la caja.</p>":"");
  document.getElementById("box").innerHTML=h;
  m.querySelectorAll("[data-op]").forEach(function(card){var o=S.iaOps[Number(card.dataset.op)];
   card.querySelectorAll("[data-k]").forEach(function(el){el.onchange=function(){var k=el.dataset.k;
    if(k==="incluir")o.incluir=el.checked;else if(k==="importe")o.importe=redondo(numAR(el.value));else o[k]=el.value;
    if(k!=="incluir"&&k!=="obs")marcarDuplicados(false);
    pintarRevisionIA()}})});
  document.getElementById("iaOk").onclick=confirmarIA;
  document.getElementById("iaMas").onclick=function(){S.iaOps.push(opVacia());pintarRevisionIA();var c=m.querySelectorAll("[data-op]");c[c.length-1].scrollIntoView({behavior:"smooth"})};
  document.getElementById("iaOtra").onclick=function(){if(!confirm("¿Descartar esta lista y empezar de nuevo?"))return;S.iaOps=null;pintarCargaIA()};
}

/* ---------- paso 3: guardar ---------- */
async function confirmarIA(){
  var ops=S.iaOps.filter(function(o){return o.incluir});
  for(var i=0;i<ops.length;i++){var o=ops[i],n=S.iaOps.indexOf(o)+1;
   if(!o.prov){say("iaSt2","Falta elegir el proveedor en la operación "+n+".",true);return}
   if(!/^\d{4}-\d\d-\d\d$/.test(o.fecha)){say("iaSt2","Falta la fecha en la operación "+n+".",true);return}
   if(!(o.importe>0)){say("iaSt2","Revisá el importe de la operación "+n+".",true);return}}
  var bt=document.getElementById("iaOk");bt.disabled=true;
  try{
   // proveedores nuevos
   var ids={};
   for(var k in ops.reduce(function(a,o){if(o.prov.indexOf("nuevo:")===0)a[o.prov]=o;return a},{})){
    var ej=ops.filter(function(o){return o.prov===k})[0];
    var rn=await sb.from("proveedores").insert({taller_id:S.taller.id,nombre:k.slice(6),cuit:ej.cuit||null}).select().single();
    if(rn.error)throw rn.error.message;ids[k]=rn.data.id;S.iaProvs.push(rn.data);
   }
   ops.forEach(function(o){if(ids[o.prov])o.prov=ids[o.prov]});
   // comprobantes originales (uno por archivo)
   var rutas={},files=S.iaArchivos||[];
   for(var x=0;x<ops.length;x++){var a=ops[x].archivo;if(ops[x].tipo!=="compra"||a==null||rutas[a]!==undefined||!files[a])continue;
    say("iaSt2","Guardando los comprobantes…");
    var f=files[a],ruta=S.taller.id+"/compras/"+Date.now()+"_"+nombreSeguro(f.name);
    var up=f.size<=10*1024*1024?await sb.storage.from("documentos").upload(ruta,f,{contentType:f.type||"application/octet-stream"}):{error:true};
    rutas[a]=up.error?null:ruta}
   say("iaSt2","Guardando…");
   var compras=ops.filter(function(o){return o.tipo==="compra"}).map(function(o){
    return {taller_id:S.taller.id,proveedor_id:o.prov,numero:o.numero.trim()||null,fecha:o.fecha,vencimiento:o.vencimiento||null,total:redondo(o.importe),observaciones:o.obs.trim()||null,
     comprobante_ruta:o.archivo!=null&&rutas[o.archivo]?rutas[o.archivo]:null,comprobante_nombre:o.archivo!=null&&rutas[o.archivo]?files[o.archivo].name:null}});
   if(compras.length){var rc=await sb.from("compras").insert(compras);if(rc.error)throw rc.error.message;
    ops.forEach(function(o){if(o.tipo==="compra"){o.incluir=false;o.dup="Ya quedó guardada."}})}
   var pagos=ops.filter(function(o){return o.tipo!=="compra"}).map(function(o){
    var obs=[o.tipo==="nota_credito"?"Nota de crédito"+(o.numero?" Nº "+o.numero.trim():""):(o.numero?"Comprobante "+o.numero.trim():""),o.obs.trim()].filter(Boolean).join(" · ");
    return {taller_id:S.taller.id,proveedor_id:o.prov,fecha:o.fecha,importe:redondo(o.importe),medio_pago:o.tipo==="nota_credito"?"nota_credito":o.medio,observaciones:obs||null}});
   var nuevosPagos=[];
   if(pagos.length){var rp=await sb.from("pagos_proveedor").insert(pagos).select();if(rp.error)throw rp.error.message;nuevosPagos=rp.data||[];
    ops.forEach(function(o){if(o.tipo!=="compra"){o.incluir=false;o.dup="Ya quedó guardada."}})}
   // los pagos nuevos cancelan las facturas más viejas de cada proveedor
   var provs={};nuevosPagos.forEach(function(p){(provs[p.proveedor_id]=provs[p.proveedor_id]||[]).push(p)});
   for(var pid in provs){
    var cta=await cuentaProveedores(pid),pend=cta.compras.filter(function(c){return c.saldo>0}),ap=[];
    provs[pid].sort(function(a,b){return String(a.fecha).localeCompare(String(b.fecha))}).forEach(function(p){
     var resto=Number(p.importe)||0;
     pend.forEach(function(c){if(resto<=0||c.saldo<=0)return;var v=redondo(Math.min(resto,c.saldo));c.saldo=redondo(c.saldo-v);resto=redondo(resto-v);
      ap.push({taller_id:S.taller.id,pago_id:p.id,compra_id:c.id,importe:v})})});
    if(ap.length){var ra=await sb.from("pago_aplicaciones").insert(ap);if(ra.error)throw "Se guardaron las operaciones, pero no se pudo marcar qué facturas cancelan los pagos: "+ra.error.message}
   }
   var provsUsados=ops.map(function(o){return o.prov}).filter(function(v,i,a){return a.indexOf(v)===i});
   S.avisoProv="Listo: se cargaron "+compras.length+" factura"+(compras.length===1?"":"s")+" y "+pagos.length+" pago"+(pagos.length===1?"":"s")+"/nota"+(pagos.length===1?"":"s")+" de crédito. Los saldos ya están actualizados.";
   S.iaOps=null;S.iaArchivos=null;
   if(provsUsados.length===1)irProv("provDetalle",{provSel:provsUsados[0]});else irProv("proveedores");
  }catch(e){var msg=typeof e==="string"?e:"No se pudo guardar.";pintarRevisionIA();say("iaSt2",msg,true)}
}
