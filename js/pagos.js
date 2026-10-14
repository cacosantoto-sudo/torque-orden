// Pagos a cuenta de presupuestos: el cliente deja una seña o paga en partes.
// Cada pago entra solo como ingreso en la Caja 1 (lo hace el SQL con un trigger),
// así que también lo puede cargar un empleado. Si se borra el pago, se borra de la caja.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.pagoPresu=renderPagoPresu;GRUPOS.pagoPresu="ordenes";
VISTAS.presuCliente=renderPresuCliente;GRUPOS.presuCliente="clientes";
var FALTA_SQL_PAGOS="Para registrar pagos a cuenta falta correr en Supabase el SQL sql/2026-10-14_pagos_tarjeta_billeteras.sql.";
var MEDIOS_PAGO_PRESU=[["efectivo","Efectivo"],["transferencia","Transferencia"],["tarjeta","Tarjeta de crédito"]];

function abrirPagoACuenta(presuId,volver){S.pagoPresuId=presuId;S.volverPago=volver||S.vista;S.vista="pagoPresu";route();window.scrollTo(0,0)}
function abrirPresuCliente(clienteId){S.presuCliente=clienteId;S.vista="presuCliente";route();window.scrollTo(0,0)}
// Suma de lo pagado por presupuesto: {id: total}. null si todavía no se corrió el SQL.
async function pagadoPorPresupuesto(ids){
  if(!ids.length)return {};
  var r=await sb.from("pagos_presupuesto").select("presupuesto_id,monto").in("presupuesto_id",ids);
  if(r.error)return null;
  var t={};(r.data||[]).forEach(function(p){t[p.presupuesto_id]=(t[p.presupuesto_id]||0)+(Number(p.monto)||0)});
  return t;
}
// Renglón "Pagado / Saldo" para las tarjetas de presupuestos
function saldoPresuHtml(total,pagado){
  if(!pagado)return "";
  var saldo=(Number(total)||0)-pagado;
  return "<div class='lr' style='margin-top:6px;font-size:.9rem'><span class='muted'>Pagado a cuenta <b style='color:var(--ok)'>"+plata(pagado)+"</b></span><span class='muted'>"+(saldo>0.009?"Saldo <b style='color:var(--br)'>"+plata(saldo)+"</b>":"<span class='tag g'>Pagado</span>")+"</span></div>";
}

/* ---------- pago a cuenta de un presupuesto ---------- */
async function renderPagoPresu(){
  m.innerHTML="<h1>Pago a cuenta</h1><div id='box'>"+skel()+"</div>";
  var r=await Promise.all([
   sb.from("presupuestos").select("*,ordenes(id,numero,cliente_id,clientes(nombre,dni_cuit))").eq("id",S.pagoPresuId).single(),
   sb.from("pagos_presupuesto").select("*").eq("presupuesto_id",S.pagoPresuId).order("fecha",{ascending:false})]);
  var box=document.getElementById("box");if(!box)return;
  if(r[0].error){box.innerHTML=esc(r[0].error.message);return}
  if(r[1].error){box.innerHTML="<div class='status err'>"+FALTA_SQL_PAGOS+"</div><div class='btns'><button class='btn o' id='ppVolver'>Volver</button></div>";
   document.getElementById("ppVolver").onclick=volverDePago;return}
  var p=r[0].data,o=p.ordenes||{},cli=o.clientes||{},pagos=r[1].data||[];
  var total=Number(p.total)||0,pagado=pagos.reduce(function(a,x){return a+(Number(x.monto)||0)},0),saldo=Math.round((total-pagado)*100)/100;
  var h="<div class='card'><div class='lr'><span><b>OT "+String(o.numero||"").padStart(6,"0")+"</b> · "+esc(cli.nombre||"Sin cliente")+(cli.dni_cuit?"<br><span class='muted' style='font-size:.88rem'>DNI/CUIT "+esc(cli.dni_cuit)+"</span>":"")+"</span><span class='tag "+clsEstadoPresu(estadoPresu(p))+"'>"+esc(estadoPresu(p))+"</span></div>"+
   "<div class='lr' style='margin-top:10px'><span class='muted'>Total del presupuesto</span><b>"+money(total)+"</b></div>"+
   "<div class='lr'><span class='muted'>Pagado a cuenta</span><b style='color:var(--ok)'>"+money(pagado)+"</b></div>"+
   "<div class='lr' style='font-size:1.2rem;font-weight:700;margin-top:4px'><span>Saldo</span><span style='color:"+(saldo>0?"var(--br)":"var(--ok)")+"'>"+money(saldo)+"</span></div></div>";
  h+="<div class='card'><h2>Nuevo pago a cuenta</h2><p class='muted' style='margin-top:0'>Entra como ingreso en la <b>Caja 1</b>, en efectivo, transferencia o tarjeta según lo que elijas.</p>"+
   "<label for='ppMonto'>Importe</label><input id='ppMonto' inputmode='decimal' value='"+(saldo>0?String(saldo).replace(".",","):"")+"'>"+
   "<label for='ppMedio'>Medio de pago</label><select id='ppMedio'>"+MEDIOS_PAGO_PRESU.map(function(md){return "<option value='"+md[0]+"'>"+md[1]+"</option>"}).join("")+"</select>"+
   "<div id='ppBancoBox' class='hide'><label for='ppBanco' id='ppBancoLbl'>Banco o billetera</label><input id='ppBanco' list='ppBancos' autocomplete='off' placeholder='Mercado Pago, Galicia, Visa…'><datalist id='ppBancos'>"+BANCOS.map(function(b){return "<option value=\""+esc(b)+"\">"}).join("")+"</datalist></div>"+
   "<label for='ppFecha'>Fecha y hora</label><input id='ppFecha' type='datetime-local' value='"+ahoraLocal()+"'>"+
   "<label for='ppNota'>Nota</label><input id='ppNota' placeholder='Opcional: seña, segunda cuota…'>"+
   "<label class='lr' style='justify-content:flex-start;gap:10px;margin-top:14px;text-transform:none;letter-spacing:0;font-family:var(--f-body);font-size:1rem;color:var(--ink)'><input type='checkbox' id='ppFact' style='width:24px;min-height:24px'> <span><b>Facturado</b></span></label>"+
   "<div id='ppSt' class='status hide'></div><div class='btns'><button class='btn' id='ppGuardar'>"+ic("wallet")+" Registrar pago</button><button class='btn o' id='ppPresu'>"+ic("receipt")+" Ver presupuesto</button><button class='btn o' id='ppVolver'>Volver</button></div></div>";
  h+="<h2 style='margin-top:20px'>Pagos registrados</h2>"+(pagos.map(function(x){
   return "<div class='card' style='padding:10px 16px'><div class='lr'><span><b>"+money(x.monto)+"</b> · "+medioTxt(x.medio_pago)+(x.banco?" · "+esc(x.banco):"")+
    "<br><span class='muted' style='font-size:.85rem'>"+new Date(x.fecha).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})+(x.nota?" · "+esc(x.nota):"")+"</span>"+
    (x.facturado?" <span class='tag g'>Facturado</span>":"")+"</span>"+
    "<button class='btn o icon del' data-del-pago='"+x.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar pago' title='Eliminar (también se saca de la caja)'>"+ic("trash")+"</button></div></div>"}).join("")||"<p class='muted'>Todavía no hay pagos a cuenta en este presupuesto.</p>");
  box.outerHTML="<div id='box'>"+h+"</div>";
  var md=document.getElementById("ppMedio");
  md.onchange=function(){document.getElementById("ppBancoBox").classList.toggle("hide",md.value==="efectivo");
   document.getElementById("ppBancoLbl").textContent=md.value==="tarjeta"?"Tarjeta o banco (Visa, Mastercard, Naranja…)":"Banco o billetera de la transferencia"};
  document.getElementById("ppVolver").onclick=volverDePago;
  document.getElementById("ppPresu").onclick=function(){S.volverPresu="presupuestos";abrirPresupuesto(o.id)};
  document.getElementById("ppGuardar").onclick=async function(){
   var monto=numAR(document.getElementById("ppMonto").value);
   if(!(monto>0)){say("ppSt","Poné un importe mayor a 0.",true);return}
   if(saldo>0&&monto>saldo+0.009&&!confirm("El importe ("+money(monto)+") es mayor que el saldo ("+money(saldo)+"). ¿Lo registro igual?"))return;
   var f=document.getElementById("ppFecha").value,medio=md.value,bn=document.getElementById("ppBanco").value.trim();
   var d={taller_id:S.taller.id,presupuesto_id:p.id,monto:monto,medio_pago:medio,banco:medio!=="efectivo"&&bn?bn:null,
    facturado:document.getElementById("ppFact").checked,fecha:f?new Date(f).toISOString():new Date().toISOString(),nota:document.getElementById("ppNota").value.trim()||null};
   this.disabled=true;var ri=await sb.from("pagos_presupuesto").insert(d);this.disabled=false;
   if(ri.error){say("ppSt",ri.error.message,true);return}
   await renderPagoPresu();say("ppSt","Pago registrado. Ya figura como ingreso en la Caja 1.");
  };
  m.querySelectorAll("[data-del-pago]").forEach(function(b){b.onclick=function(){
   borrarConDeshacer("Pago eliminado (también de la caja)",tarjetaDe("[data-del-pago='"+b.dataset.delPago+"']"),function(){return sb.from("pagos_presupuesto").delete().eq("id",b.dataset.delPago)},renderPagoPresu)}});
}
function volverDePago(){S.vista=S.volverPago||"presupuestos";route()}

/* ---------- presupuestos de un cliente (desde Clientes) ---------- */
async function renderPresuCliente(){
  m.innerHTML="<h1>Presupuestos del cliente</h1><div id='box'>"+skel()+"</div>";
  var r=await Promise.all([sb.from("clientes").select("id,nombre,dni_cuit").eq("id",S.presuCliente).single(),
   sb.from("ordenes").select("id,numero,creado,estado,equipos(nombre,marca,modelo,matricula_patente)").eq("cliente_id",S.presuCliente)]);
  var box=document.getElementById("box");if(!box)return;
  if(r[0].error||r[1].error){box.innerHTML=esc((r[0].error||r[1].error).message);return}
  var c=r[0].data,ords={};(r[1].data||[]).forEach(function(o){ords[o.id]=o});
  var ids=Object.keys(ords),lista=[];
  if(ids.length){var rp=await sb.from("presupuestos").select("*").in("orden_id",ids).order("creado",{ascending:false});
   if(rp.error){box.innerHTML=esc(rp.error.message);return}lista=rp.data||[]}
  var pag=await pagadoPorPresupuesto(lista.map(function(p){return p.id}));
  var tot=0,totPag=0;
  var h="<p class='muted' style='margin-top:-6px'>"+esc(c.nombre)+(c.dni_cuit?" · DNI/CUIT "+esc(c.dni_cuit):"")+"</p>";
  if(pag===null)h+="<div class='status err'>"+FALTA_SQL_PAGOS+"</div>";
  h+=lista.map(function(p){var o=ords[p.orden_id]||{},eq=o.equipos,st=subtotalesPresu(p),pg=pag&&pag[p.id]||0;tot+=st.total;totPag+=pg;
   return "<div class='card'><button class='item' data-presu-o='"+o.id+"'><span><b>N° "+String(o.numero).padStart(6,"0")+"</b> · "+fechaAR(p.creado||o.creado)+
    (eq?"<br><span class='muted'>"+esc(vehTitulo(eq))+(eq.matricula_patente?" "+esc(eq.matricula_patente):"")+"</span>":"")+"</span><span class='tag "+clsEstadoPresu(estadoPresu(p))+"'>"+esc(estadoPresu(p))+"</span></button>"+
    "<div class='lr' style='margin-top:6px'><span class='muted'>Total</span><b style='color:var(--ac)'>"+plata(st.total)+"</b></div>"+saldoPresuHtml(st.total,pg)+
    "<div class='btns' style='margin-top:8px'><button class='btn o' data-pago-presu='"+p.id+"' style='padding:6px 12px;min-height:0'>"+ic("wallet")+" Pago a cuenta</button></div></div>"}).join("")||
   vacio("receipt","Este cliente no tiene presupuestos","Se arman desde cada orden con el botón Presupuesto.");
  if(lista.length)h="<div class='tiles'><div class='tile'><span>Presupuestado</span><b>"+pesos(tot)+"</b></div><div class='tile'><span>Pagado a cuenta</span><b>"+pesos(totPag)+"</b></div><div class='tile'><span>Saldo</span><b>"+pesos(tot-totPag)+"</b></div></div>"+h;
  h+="<div class='btns'><button class='btn o' id='pcVolver'>Volver a clientes</button></div>";
  box.outerHTML="<div id='box'>"+h+"</div>";
  document.getElementById("pcVolver").onclick=function(){S.vista="clientes";route()};
  m.querySelectorAll("[data-presu-o]").forEach(function(b){b.onclick=function(){S.volverPresu="presuCliente";abrirPresupuesto(b.dataset.presuO)}});
  m.querySelectorAll("[data-pago-presu]").forEach(function(b){b.onclick=function(){abrirPagoACuenta(b.dataset.pagoPresu,"presuCliente")}});
}
