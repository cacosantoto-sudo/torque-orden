// Billeteras virtuales (Mercado Pago, Ualá…) y cuentas de banco: son cajas de tipo "billetera" o "banco"
// dentro del módulo Cajas. En el banco, cada movimiento del extracto se marca facturado o no.
// Se puede subir el extracto de movimientos en PDF; la IA (plan Oro) lo lee, se revisa la lista
// y se registran todos los movimientos de una vez. Los que ya estaban cargados no se repiten.

function htmlExtracto(caja){
  var x=S.extracto&&S.extracto.cajaId===caja.id?S.extracto:null;
  if(!x)return "<div class='card'><h2>Extracto de "+esc(caja.nombre)+"</h2>"+
   (esOro()
    ?"<p class='muted' style='margin-top:0'>"+(esBanco(caja)
      ?"Bajá del home banking el extracto o resumen de la cuenta en PDF y subilo acá. Se leen todos los movimientos (créditos y débitos), los revisás, marcás cuáles están facturados y se registran."
      :"Bajá de Mercado Pago el resumen de movimientos en PDF (en la app: <b>Tu dinero › Resumen de cuenta</b> o desde la web: <b>Actividad › Descargar</b>) y subilo acá. Se leen todos los movimientos y los revisás antes de registrarlos.")+"</p>"+
     "<input type='file' id='exArch' accept='application/pdf,.pdf' aria-label='PDF del extracto'>"+
     "<div id='exSt' class='status hide'></div><div class='btns'><button class='btn' id='exLeer'>"+ic("download")+" Leer extracto</button></div>"
    :"<p class='muted' style='margin-top:0'>Cargar el extracto en PDF y que se registren solos todos los movimientos es una función del plan <b>Oro</b>. Mientras tanto podés cargar los movimientos a mano con el formulario de abajo.</p>"+
     (esDueno()?"<div class='btns'><button class='btn o' id='exPlan'>Ver los planes</button></div>":""))+
   "</div>";
  var nSel=x.movs.filter(function(v){return v.incluir}).length,ing=0,egr=0;
  x.movs.forEach(function(v){if(!v.incluir)return;if(v.importe>0)ing+=v.importe;else egr-=v.importe});
  var nDup=x.movs.filter(function(v){return v.dup}).length;
  return "<div class='card'><h2>Revisá el extracto</h2>"+
   "<p class='muted' style='margin-top:0'>"+esc(x.archivo)+(x.periodo?" · "+esc(x.periodo):"")+"<br>"+x.movs.length+" movimientos leídos"+(nDup?" · "+nDup+" ya estaban cargados (quedan destildados)":"")+"</p>"+
   (x.cortado?"<div class='status err'>El extracto era muy largo y se leyó solo una parte. Registrá estos y después subí el resto del período por separado.</div>":"")+
   (x.saldo_inicial!=null||x.saldo_final!=null?"<div class='lr'><span class='muted'>Saldo inicial del extracto</span><b>"+(x.saldo_inicial!=null?money(x.saldo_inicial):"—")+"</b></div><div class='lr'><span class='muted'>Saldo final del extracto</span><b>"+(x.saldo_final!=null?money(x.saldo_final):"—")+"</b></div>":"")+
   "<div class='lr' style='margin-top:8px'><span class='muted'>A registrar: entradas</span><b style='color:var(--ok)'>"+money(ing)+"</b></div><div class='lr'><span class='muted'>A registrar: salidas</span><b style='color:var(--bad)'>"+money(egr)+"</b></div>"+
   "<div style='margin-top:10px;max-height:420px;overflow:auto;border-top:1px solid var(--line)'>"+x.movs.map(function(v,i){
    return "<label class='lr' style='gap:10px;padding:8px 0;border-bottom:1px solid var(--line);text-transform:none;letter-spacing:0;font-family:var(--f-body);font-size:.95rem;color:var(--ink);margin:0;align-items:flex-start'>"+
     "<input type='checkbox' data-ex='"+i+"'"+(v.incluir?" checked":"")+" style='width:22px;min-height:22px;flex:none;margin-top:2px'>"+
     "<span style='flex:1'>"+esc(v.descripcion)+(esBanco(caja)?" <button type='button' class='tag "+(v.fact?"g":"w")+"' data-exf='"+i+"' style='cursor:pointer' title='Tocá para cambiar'>"+(v.fact?"Facturado":"Sin facturar")+"</button>":"")+"<br><span class='muted' style='font-size:.82rem'>"+fechaAR(v.fecha)+(v.hora?" "+esc(v.hora):"")+(v.referencia?" · Op. "+esc(v.referencia):"")+"</span>"+(v.dup?" <span class='tag w'>Ya cargado</span>":"")+"</span>"+
     "<b style='white-space:nowrap;color:"+(v.importe>0?"var(--ok)":"var(--bad)")+"'>"+(v.importe>0?"+":"−")+money(Math.abs(v.importe))+"</b></label>"}).join("")+"</div>"+
   "<div id='exSt' class='status hide'></div><div class='btns'><button class='btn' id='exGuardar'"+(nSel?"":" disabled")+">Registrar "+nSel+" movimiento"+(nSel===1?"":"s")+"</button><button class='btn o' id='exCancelar'>Cancelar</button></div></div>";
}
function conectarExtracto(caja){
  var pl=document.getElementById("exPlan");if(pl)pl.onclick=function(){S.vista="plan";route()};
  var bl=document.getElementById("exLeer");if(bl)bl.onclick=function(){leerExtracto(caja)};
  m.querySelectorAll("[data-exf]").forEach(function(b){b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();var v=S.extracto.movs[Number(b.dataset.exf)];v.fact=!v.fact;var y=window.scrollY;pintarCaja();window.scrollTo(0,y)}});
  m.querySelectorAll("[data-ex]").forEach(function(c){c.onchange=function(){S.extracto.movs[Number(c.dataset.ex)].incluir=c.checked;var y=window.scrollY;pintarCaja();window.scrollTo(0,y)}});
  var bc=document.getElementById("exCancelar");if(bc)bc.onclick=function(){S.extracto=null;pintarCaja()};
  var bg=document.getElementById("exGuardar");if(bg)bg.onclick=function(){registrarExtracto(caja)};
}
// Ya cargado: mismo n° de operación, o mismo día, mismo importe y mismo sentido
function movYaCargado(v,caja){
  return S.movs.some(function(x){
   if(x.caja_id!==caja.id)return false;
   if(v.referencia&&x.referencia)return String(x.referencia)===String(v.referencia);
   return String(fechaMov(x)).slice(0,10)===v.fecha&&Math.abs((Number(x.monto)||0)-Math.abs(v.importe))<0.01&&(x.tipo==="egreso")===(v.importe<0)});
}
async function leerExtracto(caja){
  var f=(document.getElementById("exArch").files||[])[0];
  if(!f){say("exSt","Elegí el PDF del extracto.",true);return}
  if(!(f.type==="application/pdf"||/\.pdf$/i.test(f.name))){say("exSt","Tiene que ser el extracto en PDF.",true);return}
  if(f.size>3.5*1024*1024){say("exSt","El PDF pesa mucho (máx. 3,5 MB). Bajalo de un período más corto.",true);return}
  var bt=document.getElementById("exLeer");bt.disabled=true;say("exSt","Leyendo el extracto… puede tardar hasta un minuto.");
  var r;
  try{
   var resp=await fetch("/api/leer-extracto-mp",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({archivo:await aBase64(f),taller_id:S.taller.id,access_token:S.session.access_token,billetera:caja.nombre,tipo:esBanco(caja)?"banco":"billetera"})});
   r=await resp.json();
  }catch(e){r={error:"El servidor no respondió bien. Probá de nuevo."}}
  bt.disabled=false;
  if(r.error){say("exSt",r.error,true);return}
  if(!(r.movimientos||[]).length){say("exSt","No se encontraron movimientos en el PDF.",true);return}
  S.extracto={cajaId:caja.id,archivo:f.name,periodo:r.periodo,saldo_inicial:r.saldo_inicial,saldo_final:r.saldo_final,cortado:r.cortado,
   movs:r.movimientos.map(function(v){var d=movYaCargado(v,caja);return Object.assign({},v,{dup:d,incluir:!d})})};
  pintarCaja();
}
async function registrarExtracto(caja){
  var sel=S.extracto.movs.filter(function(v){return v.incluir});if(!sel.length)return;
  var filas=sel.map(function(v){var p=v.fecha.split("-"),h=String(v.hora||"12:00").split(":");
   return {taller_id:S.taller.id,caja_id:caja.id,tipo:v.importe>0?"ingreso":"egreso",concepto:v.descripcion,monto:Math.round(Math.abs(v.importe)*100)/100,
    medio_pago:esBanco(caja)?"transferencia":"billetera",banco:caja.nombre,referencia:v.referencia||null,facturado:!!v.fact,fecha:new Date(Number(p[0]),Number(p[1])-1,Number(p[2]),Number(h[0])||0,Number(h[1])||0).toISOString()}});
  var bg=document.getElementById("exGuardar");bg.disabled=true;
  for(var i=0;i<filas.length;i+=200){
   say("exSt","Registrando "+Math.min(i+200,filas.length)+" de "+filas.length+"…");
   var r=await sb.from("movimientos_caja").upsert(filas.slice(i,i+200),{onConflict:"caja_id,referencia",ignoreDuplicates:true});
   if(r.error){bg.disabled=false;say("exSt",(i?"Se registraron "+i+" movimientos, pero el resto dio error: ":"")+r.error.message,true);return}
  }
  S.extracto=null;await renderCaja();
  var st=document.getElementById("stc");if(st)say("stc","Listo: se registraron "+filas.length+" movimientos de "+caja.nombre+".");
}
