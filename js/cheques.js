// Cheques: división del módulo Cajas, independiente de las 3 cajas (no suma ni resta saldo).
// Cada cheque guarda el titular, el cliente que lo entregó, las fechas de emisión y de vencimiento
// y si es común o de pago diferido. Los que están en cartera se pintan según los días que faltan:
// verde (más de 7 días), amarillo (de 4 a 7 días) y rojo (3 días o menos, o vencido).
// Los rojos aparecen como aviso en el Panel.

var FALTA_SQL_CHEQUES="Para usar los cheques falta correr en Supabase el SQL nuevo (sql/2026-10-15_cheques.sql).";
var TIPOS_CHEQUE=[["comun","Común"],["diferido","Pago diferido"]];
var ESTADOS_CHEQUE=[["cartera","En cartera"],["depositado","Depositado"],["cobrado","Cobrado"],["endosado","Entregado a un tercero"],["rechazado","Rechazado"]];
var DIAS_ROJO=3,DIAS_AMARILLO=7;
function txtDe(lista,v){var x=lista.filter(function(e){return e[0]===v})[0];return x?x[1]:(v||"")}
function diasParaVencer(f){if(!f)return null;var h=new Date(hoyISO()+"T12:00:00"),d=new Date(String(f).slice(0,10)+"T12:00:00");return Math.round((d-h)/864e5)}
// Color del semáforo: solo para los cheques que siguen en cartera
function colorCheque(c){
  if((c.estado||"cartera")!=="cartera")return null;
  var d=diasParaVencer(c.fecha_vencimiento);if(d==null)return null;
  return d<=DIAS_ROJO?"rojo":d<=DIAS_AMARILLO?"amarillo":"verde";
}
var COLOR_CHEQUE={verde:["g","var(--ok)"],amarillo:["w","var(--br)"],rojo:["bad","var(--bad)"]};
function diasTxt(d){return d<0?"Vencido hace "+(-d)+(d===-1?" día":" días"):d===0?"Vence hoy":d===1?"Vence mañana":"Faltan "+d+" días"}
function sumarDias(f,n){var d=new Date(f+"T12:00:00");d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}

async function cargarCheques(){
  var r=await sb.from("cheques").select("*").order("fecha_vencimiento",{ascending:true});
  S.chequesErr=r.error?(/cheques|schema cache|does not exist/i.test(r.error.message)?FALTA_SQL_CHEQUES:r.error.message):null;
  S.cheques=r.error?[]:(r.data||[]);
}
function htmlCheques(){
  if(!S.cheques)return skel(2);
  if(S.chequesErr)return "<div class='status err'>"+esc(S.chequesErr)+"</div>";
  var cart=S.cheques.filter(function(c){return (c.estado||"cartera")==="cartera"}),tot=0,n={verde:0,amarillo:0,rojo:0};
  cart.forEach(function(c){tot+=Number(c.importe)||0;var k=colorCheque(c);if(k)n[k]++});
  var h="<div class='card'><h2 style='margin:0'>Cheques en cartera</h2>"+
   "<div class='lr' style='margin-top:10px;font-size:1.35rem;font-weight:700'><span>Total</span><span style='font-family:var(--f-mono)'>"+money(tot)+"</span></div>"+
   "<div class='lr'><span class='muted'>Cantidad</span><b>"+cart.length+"</b></div>"+
   "<p style='margin:10px 0 0;display:flex;gap:6px;flex-wrap:wrap'><span class='tag g'>"+n.verde+" más de "+DIAS_AMARILLO+" días</span><span class='tag w'>"+n.amarillo+" de "+(DIAS_ROJO+1)+" a "+DIAS_AMARILLO+" días</span><span class='tag bad'>"+n.rojo+" "+DIAS_ROJO+" días o menos</span></p>"+
   "<p class='muted' style='margin:8px 0 0;font-size:.88rem'>Los cheques van aparte: no suman ni restan en el saldo de las cajas.</p></div>";
  h+=formCheque(S.chequeEdit?S.cheques.filter(function(c){return c.id===S.chequeEdit})[0]||{}:{});
  var fe=S.chequeFiltro||"cartera";
  var lista=S.cheques.filter(function(c){return fe==="todos"||(c.estado||"cartera")===fe});
  h+="<h2 style='margin-top:20px'>Cheques</h2><select id='chFiltro' aria-label='Estado' style='margin-bottom:12px'><option value='todos'"+(fe==="todos"?" selected":"")+">Todos</option>"+ESTADOS_CHEQUE.map(function(e){return "<option value='"+e[0]+"'"+(e[0]===fe?" selected":"")+">"+e[1]+"</option>"}).join("")+"</select>";
  h+=lista.map(function(c){var k=colorCheque(c),col=k?COLOR_CHEQUE[k]:null,d=diasParaVencer(c.fecha_vencimiento);
   return "<div class='card' style='padding:10px 16px;border-left:6px solid "+(col?col[1]:"var(--line2)")+"'><div class='lr' style='align-items:flex-start'>"+
    "<button class='item' data-ch='"+c.id+"' style='padding:0;min-height:44px;text-align:left;flex:1'><span><b style='font-family:var(--f-body)'>"+money(c.importe)+"</b> · "+esc([c.banco,c.numero?"N° "+c.numero:""].filter(Boolean).join(" · ")||"Cheque")+
    "<br><span class='muted' style='font-size:.88rem'>Titular: "+esc(c.titular_nombre||"—")+(c.titular_cuit?" ("+esc(c.titular_cuit)+")":"")+"<br>Lo entregó: "+esc(c.cliente_nombre||"—")+"</span>"+
    "<br><span class='muted' style='font-size:.85rem'>"+(c.fecha_emision?"Emitido "+fechaAR(c.fecha_emision)+" · ":"")+"Vence "+fechaAR(c.fecha_vencimiento)+"</span>"+
    "<br><span class='tag' style='display:inline-block;margin-top:4px'>"+esc(txtDe(TIPOS_CHEQUE,c.tipo))+"</span> <span class='tag' style='display:inline-block'>"+esc(txtDe(ESTADOS_CHEQUE,c.estado||"cartera"))+"</span>"+
    (col&&d!=null?" <span class='tag "+col[0]+"' style='display:inline-block'>"+diasTxt(d)+"</span>":"")+"</span></button>"+
    "<button class='btn o icon del' data-del-ch='"+c.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar cheque' title='Eliminar'>"+ic("trash")+"</button></div></div>"}).join("")||
   vacio("wallet","No hay cheques",fe==="cartera"?"No hay cheques en cartera.":"No hay cheques con ese estado.");
  return h;
}
function formCheque(c){
  var v=function(k){return esc(c[k]==null?"":c[k])};
  var cli="<datalist id='chCliLista'>"+(S.cajaClientes||[]).map(function(x){return "<option value=\""+esc(x.nombre)+"\">"}).join("")+"</datalist>";
  var bancos="<datalist id='chBancos'>"+BANCOS.filter(function(b){return /^Banco|BBVA|ICBC|HSBC/.test(b)}).map(function(b){return "<option value=\""+esc(b)+"\">"}).join("")+"</datalist>";
  return "<div class='card' id='chForm'><h2>"+(c.id?"Editar cheque":"Cargar cheque")+"</h2>"+
   "<label for='ch_tipo'>Tipo de cheque</label><select id='ch_tipo'>"+TIPOS_CHEQUE.map(function(t){return "<option value='"+t[0]+"'"+((c.tipo||"comun")===t[0]?" selected":"")+">"+t[1]+"</option>"}).join("")+"</select>"+
   "<div class='g2'><div><label for='ch_importe'>Importe</label><input id='ch_importe' inputmode='decimal' value='"+(c.importe!=null?String(c.importe).replace(".",","):"")+"'></div>"+
   "<div><label for='ch_numero'>N° de cheque</label><input id='ch_numero' inputmode='numeric' value=\""+v("numero")+"\"></div></div>"+
   "<label for='ch_banco'>Banco</label><input id='ch_banco' list='chBancos' autocomplete='off' placeholder='Banco Nación, Galicia…' value=\""+v("banco")+"\">"+bancos+
   "<h3 style='margin:16px 0 0'>Titular del cheque</h3>"+
   "<div class='g2'><div><label for='ch_tit'>Nombre o razón social</label><input id='ch_tit' value=\""+v("titular_nombre")+"\"></div>"+
   "<div><label for='ch_titcuit'>CUIT / CUIL</label><input id='ch_titcuit' inputmode='numeric' placeholder='20-12345678-9' value=\""+v("titular_cuit")+"\"></div></div>"+
   "<h3 style='margin:16px 0 0'>Cliente que lo entregó</h3>"+
   "<div class='g2'><div><label for='ch_cli'>Cliente</label><input id='ch_cli' list='chCliLista' autocomplete='off' placeholder='Elegí o escribí el nombre' value=\""+v("cliente_nombre")+"\">"+cli+"</div>"+
   "<div><label for='ch_clitel'>Teléfono (opcional)</label><input id='ch_clitel' inputmode='tel' value=\""+v("cliente_telefono")+"\"></div></div>"+
   "<h3 style='margin:16px 0 0'>Fechas</h3>"+
   "<div class='g2'><div><label for='ch_emi'>Fecha de emisión</label><input id='ch_emi' type='date' value='"+v("fecha_emision")+"'></div>"+
   "<div><label for='ch_venc'>Fecha de vencimiento</label><input id='ch_venc' type='date' value='"+v("fecha_vencimiento")+"'></div></div>"+
   "<p class='muted' id='chAyuda' style='margin:6px 0 0;font-size:.85rem'></p>"+
   "<div class='g2'><div><label for='ch_estado'>Estado</label><select id='ch_estado'>"+ESTADOS_CHEQUE.map(function(e){return "<option value='"+e[0]+"'"+((c.estado||"cartera")===e[0]?" selected":"")+">"+e[1]+"</option>"}).join("")+"</select></div><div></div></div>"+
   "<label for='ch_obs'>Observaciones</label><textarea id='ch_obs'>"+v("observaciones")+"</textarea>"+
   "<div id='stch' class='status hide'></div>"+
   "<div class='btns'><button class='btn' id='chGuardar'>"+(c.id?"Guardar cambios":"Guardar cheque")+"</button>"+(c.id?"<button class='btn o' id='chCancelar'>Cancelar</button>":"")+"</div></div>";
}
function conectarCheques(){
  var f=document.getElementById("chFiltro");if(f)f.onchange=function(){S.chequeFiltro=this.value;pintarCaja()};
  m.querySelectorAll("[data-ch]").forEach(function(b){b.onclick=function(){S.chequeEdit=b.dataset.ch;pintarCaja();var fm=document.getElementById("chForm");if(fm)fm.scrollIntoView({behavior:"smooth",block:"start"})}});
  m.querySelectorAll("[data-del-ch]").forEach(function(b){b.onclick=function(){var id=b.dataset.delCh;
   borrarConDeshacer("Cheque eliminado",tarjetaDe("[data-del-ch='"+id+"']"),function(){return sb.from("cheques").delete().eq("id",id)},function(){if(S.chequeEdit===id)S.chequeEdit=null;S.cheques=null;renderCaja()})}});
  var cc=document.getElementById("chCancelar");if(cc)cc.onclick=function(){S.chequeEdit=null;pintarCaja()};
  var tipo=document.getElementById("ch_tipo"),emi=document.getElementById("ch_emi"),venc=document.getElementById("ch_venc"),ay=document.getElementById("chAyuda");
  if(!tipo)return;
  // El cheque común se cobra desde la emisión y tiene 30 días para presentarse: se sugiere ese vencimiento
  var ayuda=function(){ay.textContent=tipo.value==="comun"?"Cheque común: se puede cobrar desde la fecha de emisión y vence a los 30 días. Si dejás el vencimiento vacío se completa solo.":"Pago diferido: poné como vencimiento la fecha de pago que figura en el cheque."};
  var sugerir=function(){if(tipo.value==="comun"&&emi.value&&(!venc.value||venc.dataset.auto)){venc.value=sumarDias(emi.value,30);venc.dataset.auto="1"}};
  tipo.onchange=function(){ayuda();sugerir()};emi.onchange=sugerir;venc.oninput=function(){venc.dataset.auto=""};ayuda();
  var cli=document.getElementById("ch_cli");cli.oninput=function(){var c=clienteCaja(cli.value),tel=document.getElementById("ch_clitel");if(c&&c.telefono&&!tel.value)tel.value=c.telefono};
  document.getElementById("chGuardar").onclick=guardarCheque;
}
async function guardarCheque(){
  var val=function(id){return document.getElementById(id).value.trim()};
  var importe=numAR(val("ch_importe")),venc=val("ch_venc"),tipo=val("ch_tipo"),emi=val("ch_emi");
  if(!venc&&tipo==="comun"&&emi)venc=sumarDias(emi,30);
  if(!(importe>0)){say("stch","Poné el importe del cheque.",true);return}
  if(!venc){say("stch","Poné la fecha de vencimiento.",true);return}
  if(emi&&venc<emi){say("stch","El vencimiento no puede ser anterior a la emisión.",true);return}
  var cliTxt=val("ch_cli"),cliObj=clienteCaja(cliTxt);
  var data={tipo:tipo,importe:importe,numero:val("ch_numero")||null,banco:val("ch_banco")||null,
   titular_nombre:val("ch_tit")||null,titular_cuit:val("ch_titcuit")||null,
   cliente_id:cliObj?cliObj.id:null,cliente_nombre:cliObj?cliObj.nombre:(cliTxt||null),cliente_telefono:val("ch_clitel")||null,
   fecha_emision:emi||null,fecha_vencimiento:venc,estado:val("ch_estado")||"cartera",observaciones:val("ch_obs")||null};
  var btn=document.getElementById("chGuardar");btn.disabled=true;say("stch","Guardando…");
  var r=S.chequeEdit?await sb.from("cheques").update(data).eq("id",S.chequeEdit):await sb.from("cheques").insert(Object.assign({taller_id:S.taller.id},data));
  btn.disabled=false;
  if(r.error){say("stch",/cheques|schema cache|does not exist/i.test(r.error.message)?FALTA_SQL_CHEQUES:r.error.message,true);return}
  S.chequeEdit=null;S.cheques=null;renderCaja();
}

/* ---------- aviso en el Panel: cheques en rojo ---------- */
async function cargarChequesPanel(){
  var box=document.getElementById("chqBox");if(!box)return;
  var r=await sb.from("cheques").select("id,importe,banco,numero,titular_nombre,cliente_nombre,fecha_vencimiento,estado").eq("estado","cartera").lte("fecha_vencimiento",sumarDias(hoyISO(),DIAS_ROJO)).order("fecha_vencimiento",{ascending:true});
  if(!document.getElementById("chqBox"))return;
  if(r.error||!(r.data||[]).length){box.remove();return}
  var tot=r.data.reduce(function(a,c){return a+(Number(c.importe)||0)},0);
  box.innerHTML="<div class='lr'><h2 style='margin:0;color:var(--bad)'>"+ic("bell")+" Cheques por vencer</h2><span class='tag bad'>"+r.data.length+"</span></div>"+
   "<p style='margin:6px 0 4px'>"+(r.data.length===1?"Hay un cheque":"Hay "+r.data.length+" cheques")+" en cartera que vence"+(r.data.length===1?"":"n")+" en "+DIAS_ROJO+" días o menos, por "+money(tot)+".</p>"+
   r.data.map(function(c){var d=diasParaVencer(c.fecha_vencimiento);
    return "<div class='lr' style='border-top:1px solid var(--line);padding:8px 0'><span>"+money(c.importe)+" · "+esc(c.cliente_nombre||c.titular_nombre||c.banco||"Cheque")+"<br><span class='muted' style='font-size:.85rem'>Vence "+fechaAR(c.fecha_vencimiento)+"</span></span><span class='tag bad'>"+diasTxt(d)+"</span></div>"}).join("")+
   "<div class='btns'><button class='btn o' id='irCheques'>Ver los cheques</button></div>";
  box.classList.remove("hide");
  document.getElementById("irCheques").onclick=function(){S.vista="caja";S.cajaSel="cheques";S.chequeFiltro="cartera";route();window.scrollTo(0,0)};
}
