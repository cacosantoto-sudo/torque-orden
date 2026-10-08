// Proveedores: datos de cada proveedor, facturas de compra (con lectura automática del
// comprobante), repuestos comprados y sus costos, pagos y cuenta corriente.
// Usa las variables y funciones globales de index.html (sb, S, m, esc, ic, money, say...).
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.proveedores=renderProveedores;VISTAS.provForm=renderProvForm;VISTAS.provDetalle=renderProvDetalle;
VISTAS.compraForm=renderCompraForm;VISTAS.pagoForm=renderPagoForm;
["proveedores","provForm","provDetalle","compraForm","pagoForm"].forEach(function(v){GRUPOS[v]="mas"});

var FALTA_SQL_PROV="Falta correr el SQL nuevo en Supabase (sql/2026-10-06_6_proveedores.sql) para usar proveedores.";
function irProv(vista,extra){Object.assign(S,extra||{});S.vista=vista;route()}
function redondo(n){return Math.round((Number(n)||0)*100)/100}
// Cuánto se pagó de cada factura y en qué estado está
async function cuentaProveedores(provId){
  var qc=sb.from("compras").select("*").order("fecha"),qp=sb.from("pagos_proveedor").select("*").order("fecha"),qa=sb.from("pago_aplicaciones").select("*");
  if(provId){qc=qc.eq("proveedor_id",provId);qp=qp.eq("proveedor_id",provId)}
  var r=await Promise.all([qc,qp,qa]);
  var err=r.filter(function(x){return x.error})[0];if(err)throw new Error(err.error.message);
  var pagado={};(r[2].data||[]).forEach(function(a){pagado[a.compra_id]=(pagado[a.compra_id]||0)+(Number(a.importe)||0)});
  var hoy=hoyISO();
  var compras=(r[0].data||[]).map(function(c){var p=redondo(pagado[c.id]),s=redondo((Number(c.total)||0)-p);
   return Object.assign({},c,{pagado:p,saldo:s>0?s:0,estadoPago:s<=0?"Pagada":p>0?"Parcialmente pagada":"Pendiente",vencida:s>0&&c.vencimiento&&c.vencimiento<hoy})});
  return {compras:compras,pagos:r[1].data||[],aplic:r[2].data||[]};
}
function tagPago(c){return "<span class='tag "+(c.estadoPago==="Pagada"?"g":c.vencida?"bad":"w")+"'>"+(c.vencida?"Vencida":c.estadoPago)+"</span>"}

/* ---------- lista de proveedores ---------- */
async function renderProveedores(){
  m.innerHTML="<h1>Proveedores</h1><div id='box'>"+skel()+"</div>";
  var rp=await sb.from("proveedores").select("*").order("nombre");
  var box=document.getElementById("box");
  if(rp.error){box.innerHTML="<div class='status err'>"+FALTA_SQL_PROV+"</div>";return}
  var cta;try{cta=await cuentaProveedores()}catch(e){box.innerHTML="<div class='status err'>"+esc(e.message)+"</div>";return}
  var saldo={},venc={};
  cta.compras.forEach(function(c){saldo[c.proveedor_id]=(saldo[c.proveedor_id]||0)+(Number(c.total)||0);if(c.vencida)venc[c.proveedor_id]=(venc[c.proveedor_id]||0)+1});
  cta.pagos.forEach(function(p){saldo[p.proveedor_id]=(saldo[p.proveedor_id]||0)-(Number(p.importe)||0)});
  var total=Object.keys(saldo).reduce(function(a,k){return a+saldo[k]},0);
  var h="<div class='btns' style='margin:0 0 12px'><button class='btn' id='pvNueva'>"+ic("receipt")+" Cargar factura de compra</button><button class='btn o' id='pvIA'>"+ic("image")+" Cargar con IA"+(esOro()?"":" <span class='tag'>ORO</span>")+"</button><button class='btn o' id='pvNuevo'>"+ic("plus")+" Proveedor</button></div>";
  if(S.avisoProv){h="<div class='status'>"+esc(S.avisoProv)+"</div>"+h;S.avisoProv=null}
  if(rp.data.length)h+="<div class='tiles'><div class='tile'><span class='muted'>Les debés en total</span><br><b style='font-size:1.2rem'>"+money(total)+"</b></div>"+
   "<div class='tile'><span class='muted'>Facturas vencidas</span><br><b style='font-size:1.2rem;color:"+(Object.keys(venc).length?"var(--bad)":"var(--ink)")+"'>"+cta.compras.filter(function(c){return c.vencida}).length+"</b></div></div>"+
   buscadorHtml("Nombre, CUIT o teléfono",S.qProv);
  h+=rp.data.map(function(p){var s=redondo(saldo[p.id]);
   return "<div class='card' data-q=\""+esc(norm([p.nombre,p.cuit,p.telefono,p.contacto].join(" ")))+"\" style='padding:12px 16px'><button class='item' data-prov='"+p.id+"'><span><b style='font-family:var(--f-body);font-size:1.05rem'>"+esc(p.nombre)+"</b>"+
    (p.cuit||p.telefono?"<br><span class='muted'>"+esc([p.cuit&&"CUIT "+p.cuit,p.telefono].filter(Boolean).join(" · "))+"</span>":"")+
    (venc[p.id]?"<br><span class='tag bad' style='display:inline-block;margin-top:4px'>"+venc[p.id]+" vencida"+(venc[p.id]>1?"s":"")+"</span>":"")+"</span>"+
    "<span style='text-align:right'><span class='muted' style='font-size:.8rem'>"+(s<0?"A favor":"Saldo")+"</span><br><b style='color:"+(s>0?"var(--bad)":"var(--ok)")+"'>"+money(Math.abs(s))+"</b></span></button></div>"}).join("")||
   vacio("package","Todavía no hay proveedores","Cargá uno, o cargá directamente una factura de compra: el proveedor se crea solo.");
  box.innerHTML=h;
  document.getElementById("pvIA").onclick=function(){irProvIA("")};
  document.getElementById("pvNuevo").onclick=function(){irProv("provForm",{provEdit:null,volverProvForm:"proveedores"})};
  document.getElementById("pvNueva").onclick=function(){irProv("compraForm",{compraProv:null,volverCompra:"proveedores"})};
  var b=document.getElementById("buscar");if(b){b.oninput=function(){S.qProv=this.value;filtrarLista(this.value)};if(S.qProv)filtrarLista(S.qProv)}
  m.querySelectorAll("[data-prov]").forEach(function(x){x.onclick=function(){irProv("provDetalle",{provSel:x.dataset.prov})}});
}

/* ---------- alta / edición de proveedor ---------- */
var CAMPOS_PROV=[["nombre","Nombre o razón social"],["cuit","CUIT"],["telefono","Teléfono","tel"],["email","Email","email"],["direccion","Dirección"],["contacto","Contacto comercial"],["condiciones_pago","Condiciones de pago","","Contado, cuenta corriente 30 días…"],["observaciones","Observaciones","t"]];
async function renderProvForm(){
  var p={};
  if(S.provEdit){var r=await sb.from("proveedores").select("*").eq("id",S.provEdit).single();if(r.error){m.innerHTML=esc(r.error.message);return}p=r.data}
  m.innerHTML="<h1>"+(p.id?"Editar proveedor":"Nuevo proveedor")+"</h1><div class='card'>"+CAMPOS_PROV.map(function(c){
   return "<label for='pv_"+c[0]+"'>"+c[1]+"</label>"+(c[2]==="t"?"<textarea id='pv_"+c[0]+"'>"+esc(p[c[0]])+"</textarea>":"<input id='pv_"+c[0]+"'"+(c[2]?" type='"+c[2]+"'":"")+(c[3]?" placeholder='"+c[3]+"'":"")+" value=\""+esc(p[c[0]])+"\">")}).join("")+
   "<div id='pvSt' class='status hide'></div><div class='btns'><button class='btn' id='pvGuardar'>Guardar</button><button class='btn o' id='pvVolver'>Volver</button>"+
   (p.id?"<button class='btn o del' id='pvBorrar'>"+ic("trash")+" Eliminar</button>":"")+"</div></div>";
  document.getElementById("pvVolver").onclick=function(){irProv(S.volverProvForm||"proveedores")};
  document.getElementById("pvGuardar").onclick=async function(){
   var d={taller_id:S.taller.id};CAMPOS_PROV.forEach(function(c){d[c[0]]=document.getElementById("pv_"+c[0]).value.trim()||null});
   if(!d.nombre){say("pvSt","Poné el nombre del proveedor.",true);return}
   this.disabled=true;
   var r=p.id?await sb.from("proveedores").update(d).eq("id",p.id):await sb.from("proveedores").insert(d).select().single();
   this.disabled=false;
   if(r.error){say("pvSt",/relation|does not exist/i.test(r.error.message)?FALTA_SQL_PROV:r.error.message,true);return}
   irProv("provDetalle",{provSel:p.id||r.data.id});
  };
  var bb=document.getElementById("pvBorrar");if(bb)bb.onclick=async function(){
   if(!confirm("¿Eliminar este proveedor?"))return;
   var r=await sb.from("proveedores").delete().eq("id",p.id);
   if(r.error){say("pvSt","No se puede eliminar porque tiene facturas o pagos cargados.",true);return}
   irProv("proveedores");
  };
}

/* ---------- cuenta corriente de un proveedor ---------- */
async function renderProvDetalle(){
  m.innerHTML="<div id='box'>"+skel()+"</div>";
  var rp=await sb.from("proveedores").select("*").eq("id",S.provSel).single();
  if(rp.error){m.innerHTML=esc(rp.error.message);return}
  var p=rp.data,cta;try{cta=await cuentaProveedores(p.id)}catch(e){m.innerHTML=esc(e.message);return}
  var tc=cta.compras.reduce(function(a,c){return a+(Number(c.total)||0)},0),tp=cta.pagos.reduce(function(a,x){return a+(Number(x.importe)||0)},0),saldo=redondo(tc-tp);
  var h="<h1>"+esc(p.nombre)+"</h1>"+(S.avisoProv?"<div class='status'>"+esc(S.avisoProv)+"</div>":"")+
   "<div class='btns' style='margin:0 0 12px'><button class='btn' id='pdCompra'>"+ic("receipt")+" Factura de compra</button><button class='btn o' id='pdPago'>"+ic("wallet")+" Registrar pago</button><button class='btn o' id='pdIA'>"+ic("image")+" Cargar con IA"+(esOro()?"":" <span class='tag'>ORO</span>")+"</button><button class='btn o' id='pdEditar'>"+ic("pencil")+" Datos</button></div>"+
   "<div class='tiles'><div class='tile'><span class='muted'>Compras</span><br><b>"+money(tc)+"</b></div><div class='tile'><span class='muted'>Pagado</span><br><b style='color:var(--ok)'>"+money(tp)+"</b></div>"+
   "<div class='tile'><span class='muted'>"+(saldo<0?"Saldo a favor":"Saldo a pagar")+"</span><br><b style='font-size:1.2rem;color:"+(saldo>0?"var(--bad)":"var(--ok)")+"'>"+money(Math.abs(saldo))+"</b></div></div>";
  var datos=[["CUIT",p.cuit],["Teléfono",p.telefono],["Email",p.email],["Dirección",p.direccion],["Contacto",p.contacto],["Condiciones de pago",p.condiciones_pago],["Observaciones",p.observaciones]].filter(function(x){return x[1]});
  if(datos.length)h+="<div class='card'><h2>Datos</h2>"+datos.map(function(x){return "<div class='lr'><span class='muted'>"+x[0]+"</span><span style='text-align:right'>"+esc(x[1])+"</span></div>"}).join("")+"</div>";
  var pend=cta.compras.filter(function(c){return c.saldo>0});
  h+="<div class='card'><h2>Facturas a pagar ("+pend.length+")</h2>"+(pend.map(function(c){
   return "<div class='lr' style='padding:8px 0;border-top:1px solid var(--line)'><span>"+(c.numero?"Nº "+esc(c.numero):"Sin número")+" · "+fechaAR(c.fecha)+
    "<br><span class='muted' style='font-size:.85rem'>"+(c.vencimiento?"Vence "+fechaAR(c.vencimiento):"Sin vencimiento")+"</span> "+tagPago(c)+"</span><b>"+money(c.saldo)+"</b></div>"}).join("")||"<p class='muted' style='margin:0'>No hay facturas pendientes.</p>")+"</div>";
  // historial con saldo acumulado
  var mov=cta.compras.map(function(c){return {f:c.fecha,o:String(c.creado||""),tipo:"c",x:c,imp:Number(c.total)||0}}).concat(cta.pagos.map(function(x){return {f:x.fecha,o:String(x.creado||""),tipo:"p",x:x,imp:-(Number(x.importe)||0)}}));
  mov.sort(function(a,b){return String(a.f).localeCompare(String(b.f))||a.o.localeCompare(b.o)});
  var acum=0;mov.forEach(function(v){acum+=v.imp;v.saldo=acum});mov.reverse();
  h+="<h2 style='margin-top:20px'>Movimientos</h2>"+(mov.map(function(v){var x=v.x;
   if(v.tipo==="c")return "<div class='card' style='padding:10px 16px'><div class='lr'><span>"+ic("receipt")+" <b>Factura "+(x.numero?esc(x.numero):"")+"</b> "+tagPago(x)+"<br><span class='muted' style='font-size:.85rem'>"+fechaAR(x.fecha)+(x.condicion_pago?" · "+esc(x.condicion_pago):"")+"</span></span>"+
    "<span style='text-align:right'><b style='color:var(--bad);white-space:nowrap'>+"+money(x.total)+"</b><br><span class='muted' style='font-size:.8rem'>Saldo "+money(v.saldo)+"</span></span></div>"+
    "<div class='btns' style='margin-top:6px'><button class='btn o' data-ver-compra='"+x.id+"' style='padding:6px 12px;min-height:0'>Ver detalle</button>"+(x.comprobante_ruta?"<button class='btn o' data-comp='"+esc(x.comprobante_ruta)+"' style='padding:6px 12px;min-height:0'>"+ic("image")+" Comprobante</button>":"")+"</div></div>";
   return "<div class='card' style='padding:10px 16px'><div class='lr'><span>"+ic("wallet")+" <b>"+(x.medio_pago==="nota_credito"?"Nota de crédito":"Pago")+"</b> <span class='tag'>"+medioProvTxt(x.medio_pago)+"</span><br><span class='muted' style='font-size:.85rem'>"+fechaAR(x.fecha)+(x.observaciones?" · "+esc(x.observaciones):"")+"</span></span>"+
    "<span class='lr' style='gap:10px'><span style='text-align:right'><b style='color:var(--ok);white-space:nowrap'>−"+money(x.importe)+"</b><br><span class='muted' style='font-size:.8rem'>Saldo "+money(v.saldo)+"</span></span>"+
    "<button class='btn o icon del' data-del-pago='"+x.id+"' style='padding:4px 10px;min-height:0' aria-label='Eliminar pago' title='Eliminar pago'>"+ic("trash")+"</button></span></div></div>"}).join("")||vacio("receipt","Sin movimientos","Todavía no hay facturas ni pagos de este proveedor."));
  S.avisoProv=null;
  m.innerHTML=h+"<div class='btns'><button class='btn o' id='pdVolver'>Volver</button></div>";
  document.getElementById("pdVolver").onclick=function(){irProv("proveedores")};
  document.getElementById("pdEditar").onclick=function(){irProv("provForm",{provEdit:p.id,volverProvForm:"provDetalle"})};
  document.getElementById("pdCompra").onclick=function(){irProv("compraForm",{compraProv:p.id,compraEdit:null,volverCompra:"provDetalle"})};
  document.getElementById("pdIA").onclick=function(){irProvIA(p.id)};
  document.getElementById("pdPago").onclick=function(){irProv("pagoForm",{pagoProv:p.id})};
  m.querySelectorAll("[data-ver-compra]").forEach(function(b){b.onclick=function(){irProv("compraForm",{compraEdit:b.dataset.verCompra,compraProv:p.id,volverCompra:"provDetalle"})}});
  m.querySelectorAll("[data-comp]").forEach(function(b){b.onclick=function(){abrirDocumento(b.dataset.comp)}});
  m.querySelectorAll("[data-del-pago]").forEach(function(b){b.onclick=async function(){
   var pg=cta.pagos.filter(function(x){return x.id===b.dataset.delPago})[0];
   if(!confirm("¿Eliminar este pago?"+(pg&&pg.movimiento_id?" También se borra el egreso de la caja.":"")))return;
   var r=await sb.from("pagos_proveedor").delete().eq("id",b.dataset.delPago);if(r.error){alert(r.error.message);return}
   if(pg&&pg.movimiento_id)await sb.from("movimientos_caja").delete().eq("id",pg.movimiento_id);
   renderProvDetalle()}});
}

/* ---------- factura de compra ---------- */
function itemCompraVacio(){return {descripcion:"",marca:"",codigo:"",cantidad:1,costo_unitario:0,total:0}}
async function renderCompraForm(){
  m.innerHTML="<h1>"+(S.compraEdit?"Factura de compra":"Cargar factura de compra")+"</h1><div id='box'>"+skel()+"</div>";
  var rp=await sb.from("proveedores").select("*").order("nombre");
  if(rp.error){document.getElementById("box").innerHTML="<div class='status err'>"+FALTA_SQL_PROV+"</div>";return}
  S.provs=rp.data||[];
  var c={proveedor_id:S.compraProv||"",fecha:hoyISO(),items:[itemCompraVacio()]};
  if(S.compraEdit){
   var rc=await sb.from("compras").select("*").eq("id",S.compraEdit).single();if(rc.error){m.innerHTML=esc(rc.error.message);return}
   var ri=await sb.from("compra_items").select("*").eq("compra_id",S.compraEdit);
   c=Object.assign(rc.data,{items:(ri.data||[]).length?ri.data:[]});
  }
  S.compra=c;S.compraArchivo=null;pintarCompra();
}
function pintarCompra(){
  var c=S.compra,ver=!!c.id;
  var h="";
  if(!ver)h+="<div class='card'><h2>Comprobante</h2><p class='muted' style='margin-top:0'>Sacale una foto a la factura o subí el PDF. "+(esOro()?"Con <b>Leer automáticamente</b> se completan los datos solos y vos los revisás antes de guardar.":"Leer los datos automáticamente es una función del plan Oro; igual queda guardado el comprobante.")+"</p>"+
   "<input type='file' id='cArchivo' accept='image/*,application/pdf' aria-label='Foto o PDF del comprobante'>"+
   "<div id='cArchNom' class='muted' style='margin-top:6px'>"+(S.compraArchivo?esc(S.compraArchivo.name):"")+"</div>"+
   (esOro()?"<div class='btns'><button class='btn o' id='cLeer'"+(S.compraArchivo?"":" disabled")+">"+ic("image")+" Leer automáticamente</button></div>":"")+
   "<div id='cLeerSt' class='status hide'></div></div>";
  h+="<div class='card'><h2>Datos de la factura</h2>"+
   "<label for='cProv'>Proveedor</label><select id='cProv'"+(ver?" disabled":"")+"><option value=''>Elegí un proveedor…</option>"+S.provs.map(function(p){return "<option value='"+p.id+"'"+(p.id===c.proveedor_id?" selected":"")+">"+esc(p.nombre)+"</option>"}).join("")+"<option value='nuevo'>+ Proveedor nuevo…</option></select>"+
   "<div id='cProvNuevo'></div>"+
   "<div class='g2'><div><label for='cNum'>Número de comprobante</label><input id='cNum' value=\""+esc(c.numero)+"\" placeholder='A 0001-00012345'></div><div><label for='cCond'>Condición de pago</label><input id='cCond' value=\""+esc(c.condicion_pago)+"\" placeholder='Contado, cuenta corriente…'></div></div>"+
   "<div class='g2'><div><label for='cFecha'>Fecha</label><input id='cFecha' type='date' value='"+esc(c.fecha)+"'></div><div><label for='cVenc'>Vencimiento</label><input id='cVenc' type='date' value='"+esc(c.vencimiento)+"'></div></div></div>";
  h+="<div class='card'><h2>Repuestos y productos</h2><div id='cItems'></div>"+(ver?"":"<div class='btns'><button class='btn o' id='cAddItem'>"+ic("plus")+" Agregar renglón</button></div>")+
   "<div class='lr' style='margin-top:12px'><span class='muted'>Suma de los renglones</span><span id='cSuma'></span></div>"+
   "<label for='cTotal'>Total de la factura</label><input id='cTotal' inputmode='decimal' value=\""+(c.total!=null?esc(String(c.total).replace(".",",")):"")+"\">"+
   "<p class='muted' style='font-size:.85rem;margin:4px 0 0'>Si lo dejás vacío se usa la suma de los renglones.</p>"+
   (ver?"":"<label style='display:flex;gap:8px;align-items:center;margin-top:14px;text-transform:none;letter-spacing:normal;font-size:1rem;color:var(--ink);font-family:var(--f-body)'><input type='checkbox' id='cStock' checked style='width:auto;min-height:0'> Sumar al stock y actualizar el precio de costo</label>")+
   "<label for='cObs'>Observaciones</label><textarea id='cObs'>"+esc(c.observaciones)+"</textarea></div>";
  if(ver&&c.comprobante_ruta)h+="<div class='btns'><button class='btn o' id='cVerComp'>"+ic("image")+" Ver comprobante</button></div>";
  h+="<div id='cSt' class='status hide'></div><div class='btns'>"+(ver?"<button class='btn' id='cGuardar'>Guardar cambios</button><button class='btn o del' id='cBorrar'>"+ic("trash")+" Eliminar factura</button>":"<button class='btn' id='cGuardar'>Guardar factura</button>")+"<button class='btn o' id='cVolver'>Volver</button></div>";
  document.getElementById("box").innerHTML=h;
  pintarItemsCompra();
  var sel=document.getElementById("cProv");sel.onchange=function(){pintarProvNuevo(this.value==="nuevo"?{}:null)};
  if(S.compraProvNuevo){sel.value="nuevo";pintarProvNuevo(S.compraProvNuevo)}
  var fa=document.getElementById("cArchivo");if(fa)fa.onchange=function(){S.compraArchivo=this.files[0]||null;document.getElementById("cArchNom").textContent=S.compraArchivo?S.compraArchivo.name:"";var l=document.getElementById("cLeer");if(l)l.disabled=!S.compraArchivo};
  var bl=document.getElementById("cLeer");if(bl)bl.onclick=leerComprobante;
  var ad=document.getElementById("cAddItem");if(ad)ad.onclick=function(){leerItemsCompra();S.compra.items.push(itemCompraVacio());pintarItemsCompra()};
  document.getElementById("cGuardar").onclick=guardarCompra;
  document.getElementById("cVolver").onclick=function(){S.compraProvNuevo=null;irProv(S.volverCompra||"proveedores")};
  var vc=document.getElementById("cVerComp");if(vc)vc.onclick=function(){abrirDocumento(c.comprobante_ruta)};
  var bo=document.getElementById("cBorrar");if(bo)bo.onclick=async function(){
   if(!confirm("¿Eliminar esta factura? Se borran también sus renglones y lo que se le haya aplicado de los pagos (los pagos quedan como saldo a favor). El stock no se modifica."))return;
   var r=await sb.from("compras").delete().eq("id",c.id);if(r.error){say("cSt",r.error.message,true);return}
   irProv("provDetalle",{provSel:c.proveedor_id})};
}
function pintarProvNuevo(d){
  var box=document.getElementById("cProvNuevo");
  if(!d){box.innerHTML="";return}
  box.innerHTML="<div class='card' style='background:var(--card2);margin-top:10px'><label for='npNombre'>Nombre del proveedor nuevo</label><input id='npNombre' value=\""+esc(d.nombre)+"\">"+
   "<div class='g2'><div><label for='npCuit'>CUIT</label><input id='npCuit' value=\""+esc(d.cuit)+"\"></div><div><label for='npTel'>Teléfono</label><input id='npTel' type='tel' value=\""+esc(d.telefono)+"\"></div></div>"+
   "<input type='hidden' id='npEmail' value=\""+esc(d.email)+"\"><input type='hidden' id='npDir' value=\""+esc(d.direccion)+"\"></div>";
}
function pintarItemsCompra(){
  var ver=!!S.compra.id,its=S.compra.items;
  document.getElementById("cItems").innerHTML=its.map(function(it,i){
   return "<div class='card' style='background:var(--card2);padding:10px 12px' data-it='"+i+"'>"+
    "<label for='ci_d"+i+"'>Descripción</label><input id='ci_d"+i+"' data-k='descripcion' value=\""+esc(it.descripcion)+"\""+(ver?" readonly":"")+">"+
    "<div class='g2'><div><label for='ci_m"+i+"'>Marca</label><input id='ci_m"+i+"' data-k='marca' value=\""+esc(it.marca)+"\""+(ver?" readonly":"")+"></div><div><label for='ci_c"+i+"'>Código</label><input id='ci_c"+i+"' data-k='codigo' value=\""+esc(it.codigo)+"\""+(ver?" readonly":"")+"></div></div>"+
    "<div class='g3'><div><label for='ci_q"+i+"'>Cantidad</label><input id='ci_q"+i+"' data-k='cantidad' inputmode='decimal' value=\""+esc(String(it.cantidad).replace(".",","))+"\""+(ver?" readonly":"")+"></div>"+
    "<div><label for='ci_u"+i+"'>Costo unitario</label><input id='ci_u"+i+"' data-k='costo_unitario' inputmode='decimal' value=\""+esc(String(it.costo_unitario||"").replace(".",","))+"\""+(ver?" readonly":"")+"></div>"+
    "<div><label>Total</label><div style='padding:10px 0;font-weight:700' data-tot='"+i+"'>"+money(it.total)+"</div></div></div>"+
    (ver||its.length<2?"":"<div class='btns' style='margin-top:6px'><button class='btn o' data-quitar='"+i+"' style='padding:4px 10px;min-height:0'>"+ic("trash")+" Quitar</button></div>")+"</div>"}).join("")||"<p class='muted'>Sin renglones.</p>";
  recalcCompra();
  if(ver)return;
  m.querySelectorAll("#cItems input").forEach(function(inp){inp.oninput=function(){leerItemsCompra();recalcCompra()}});
  m.querySelectorAll("[data-quitar]").forEach(function(b){b.onclick=function(){leerItemsCompra();S.compra.items.splice(Number(b.dataset.quitar),1);pintarItemsCompra()}});
}
function leerItemsCompra(){
  if(S.compra.id)return;
  m.querySelectorAll("[data-it]").forEach(function(card){var i=Number(card.dataset.it),it=S.compra.items[i];if(!it)return;
   card.querySelectorAll("[data-k]").forEach(function(inp){var k=inp.dataset.k;it[k]=(k==="cantidad"||k==="costo_unitario")?(inp.value.trim()===""?0:numAR(inp.value)):inp.value});
   it.total=redondo((Number(it.cantidad)||0)*(Number(it.costo_unitario)||0))});
}
function recalcCompra(){
  var s=0;S.compra.items.forEach(function(it,i){s+=Number(it.total)||0;var t=m.querySelector("[data-tot='"+i+"']");if(t)t.textContent=money(it.total)});
  document.getElementById("cSuma").textContent=money(s);
  var tot=document.getElementById("cTotal");if(tot&&!S.compra.id)tot.placeholder=String(redondo(s)).replace(".",",");
}
function aBase64(blob){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res(String(fr.result).split(",")[1])};fr.onerror=rej;fr.readAsDataURL(blob)})}
async function leerComprobante(){
  var f=S.compraArchivo;if(!f)return;
  var bt=document.getElementById("cLeer");bt.disabled=true;
  try{
   var pdf=f.type==="application/pdf"||/\.pdf$/i.test(f.name),blob=f,tipo="application/pdf";
   if(pdf){if(f.size>3.5*1024*1024)throw "El PDF pesa mucho para leerlo automáticamente (máx. 3,5 MB). Cargá los datos a mano o subí una foto."}
   else{say("cLeerSt","Preparando la foto…");blob=await shrink(f);tipo="image/jpeg"}
   say("cLeerSt","Leyendo el comprobante… puede tardar unos segundos.");
   var resp=await fetch("/api/leer-comprobante",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({archivo:await aBase64(blob),tipo:tipo,taller_id:S.taller.id,access_token:S.session.access_token})});
   var r=await resp.json();if(r.error)throw r.error;
   aplicarLectura(r);
   say("cLeerSt","Listo. Revisá todos los datos antes de guardar.");
  }catch(e){say("cLeerSt",typeof e==="string"?e:"No se pudo leer el comprobante. Cargá los datos a mano.",true)}
  bt.disabled=false;
}
function aplicarLectura(r){
  var c=S.compra;leerItemsCompra();
  ["numero","condicion_pago","vencimiento","observaciones"].forEach(function(k){c[k]=document.getElementById({numero:"cNum",condicion_pago:"cCond",vencimiento:"cVenc",observaciones:"cObs"}[k]).value||null});
  c.fecha=document.getElementById("cFecha").value;
  var pv=document.getElementById("cProv").value;if(pv&&pv!=="nuevo")c.proveedor_id=pv;
  var tv=document.getElementById("cTotal").value.trim();if(tv)c.total=numAR(tv);
  if(r.numero)c.numero=r.numero;if(r.condicion_pago)c.condicion_pago=r.condicion_pago;
  if(/^\d{4}-\d\d-\d\d$/.test(r.fecha||""))c.fecha=r.fecha;if(/^\d{4}-\d\d-\d\d$/.test(r.vencimiento||""))c.vencimiento=r.vencimiento;
  if(Number(r.total)>0)c.total=Number(r.total);
  var its=(r.items||[]).filter(function(it){return it&&it.descripcion}).map(function(it){var q=Number(it.cantidad)||1,u=Number(it.costo_unitario)||0,t=Number(it.total)||0;if(!u&&t)u=redondo(t/q);
   return {descripcion:String(it.descripcion),marca:it.marca||"",codigo:it.codigo||"",cantidad:q,costo_unitario:u,total:redondo(q*u)}});
  if(its.length)c.items=its;
  // proveedor: por CUIT o por nombre; si no existe, se propone crearlo
  S.compraProvNuevo=null;
  var cuit=String(r.cuit||"").replace(/\D/g,""),prov=null;
  if(cuit)prov=S.provs.filter(function(p){return String(p.cuit||"").replace(/\D/g,"")===cuit})[0];
  if(!prov&&r.proveedor)prov=S.provs.filter(function(p){return norm(p.nombre)===norm(r.proveedor)})[0];
  if(prov)c.proveedor_id=prov.id;
  else if(r.proveedor)S.compraProvNuevo={nombre:r.proveedor,cuit:r.cuit,telefono:r.telefono,email:r.email,direccion:r.direccion};
  pintarCompra();
}
// Busca el repuesto en el stock por código o por nombre
function normCodigo(s){return norm(s).replace(/[^a-z0-9]/g,"")}
function buscarRepuesto(lista,it){
  var cod=normCodigo(it.codigo);
  if(cod){var x=lista.filter(function(r){return normCodigo(r.codigo)===cod})[0];if(x)return x}
  var n=norm(it.descripcion).trim();return lista.filter(function(r){return norm(r.nombre).trim()===n})[0]||null;
}
async function guardarCompra(){
  var c=S.compra,bt=document.getElementById("cGuardar");
  if(c.id){
   var d={numero:document.getElementById("cNum").value.trim()||null,condicion_pago:document.getElementById("cCond").value.trim()||null,
    fecha:document.getElementById("cFecha").value||hoyISO(),vencimiento:document.getElementById("cVenc").value||null,observaciones:document.getElementById("cObs").value.trim()||null};
   var tv=document.getElementById("cTotal").value.trim();if(tv){d.total=numAR(tv);if(!(d.total>=0)){say("cSt","Revisá el total.",true);return}}
   bt.disabled=true;var ru=await sb.from("compras").update(d).eq("id",c.id);bt.disabled=false;
   if(ru.error){say("cSt",ru.error.message,true);return}
   irProv("provDetalle",{provSel:c.proveedor_id});return;
  }
  leerItemsCompra();
  var its=c.items.filter(function(it){return String(it.descripcion||"").trim()});
  var suma=redondo(its.reduce(function(a,it){return a+(Number(it.total)||0)},0));
  var tv2=document.getElementById("cTotal").value.trim(),total=tv2?numAR(tv2):suma;
  if(!(total>0)){say("cSt","Cargá al menos un renglón con costo, o el total de la factura.",true);return}
  var provId=document.getElementById("cProv").value;
  if(!provId){say("cSt","Elegí el proveedor.",true);return}
  bt.disabled=true;
  try{
   if(provId==="nuevo"){
    var nom=document.getElementById("npNombre").value.trim();if(!nom)throw "Poné el nombre del proveedor nuevo.";
    var rn=await sb.from("proveedores").insert({taller_id:S.taller.id,nombre:nom,cuit:document.getElementById("npCuit").value.trim()||null,telefono:document.getElementById("npTel").value.trim()||null,
     email:document.getElementById("npEmail").value||null,direccion:document.getElementById("npDir").value||null}).select().single();
    if(rn.error)throw rn.error.message;provId=rn.data.id;S.compraProvNuevo=null;
   }
   var datos={taller_id:S.taller.id,proveedor_id:provId,numero:document.getElementById("cNum").value.trim()||null,fecha:document.getElementById("cFecha").value||hoyISO(),
    vencimiento:document.getElementById("cVenc").value||null,condicion_pago:document.getElementById("cCond").value.trim()||null,total:redondo(total),observaciones:document.getElementById("cObs").value.trim()||null};
   var f=S.compraArchivo;
   if(f){
    if(f.size>10*1024*1024)throw "El comprobante pesa más de 10 MB.";
    say("cSt","Subiendo el comprobante…");
    var ruta=S.taller.id+"/compras/"+Date.now()+"_"+nombreSeguro(f.name);
    var up=await sb.storage.from("documentos").upload(ruta,f,{contentType:f.type||"application/octet-stream"});
    if(up.error)throw /bucket/i.test(up.error.message)?FALTA_SQL_PROV:"No se pudo subir el comprobante: "+up.error.message;
    datos.comprobante_ruta=ruta;datos.comprobante_nombre=f.name;
   }
   say("cSt","Guardando…");
   var rc=await sb.from("compras").insert(datos).select().single();if(rc.error)throw rc.error.message;
   var stock=document.getElementById("cStock").checked,actualizados=0,nuevos=0;
   if(stock&&its.length){
    var rr=await sb.from("repuestos").select("*");var reps=rr.data||[];
    for(var i=0;i<its.length;i++){var it=its[i],q=Number(it.cantidad)||0,u=Number(it.costo_unitario)||0,rep=buscarRepuesto(reps,it);
     if(rep){var upd={cantidad:redondo((Number(rep.cantidad)||0)+q)};if(u>0)upd.precio_costo=u;
      var ra=await sb.from("repuestos").update(upd).eq("id",rep.id);if(!ra.error){Object.assign(rep,upd);it.repuesto_id=rep.id;actualizados++}}
     else{var ri=await sb.from("repuestos").insert({taller_id:S.taller.id,nombre:String(it.descripcion).trim()+(it.marca?" "+it.marca:""),codigo:it.codigo||null,cantidad:q,stock_minimo:0,precio_costo:u||null}).select().single();
      if(!ri.error){reps.push(ri.data);it.repuesto_id=ri.data.id;nuevos++}}}
   }
   if(its.length){
    var ins=await sb.from("compra_items").insert(its.map(function(it){return {taller_id:S.taller.id,compra_id:rc.data.id,repuesto_id:it.repuesto_id||null,descripcion:String(it.descripcion).trim(),marca:it.marca||null,codigo:it.codigo||null,
     cantidad:Number(it.cantidad)||0,costo_unitario:Number(it.costo_unitario)||0,total:Number(it.total)||0}}));
    if(ins.error){await sb.from("compras").delete().eq("id",rc.data.id);throw ins.error.message}
   }
   S.compraArchivo=null;
   if(stock&&(actualizados||nuevos))S.avisoProv=("Factura guardada. Stock: "+actualizados+" repuesto"+(actualizados===1?"":"s")+" actualizado"+(actualizados===1?"":"s")+", "+nuevos+" nuevo"+(nuevos===1?"":"s")+".");
   irProv("provDetalle",{provSel:provId});
  }catch(e){bt.disabled=false;say("cSt",typeof e==="string"?(/relation|does not exist/i.test(e)?FALTA_SQL_PROV:e):"No se pudo guardar.",true)}
}

/* ---------- pago a proveedor ---------- */
async function renderPagoForm(){
  m.innerHTML="<h1>Registrar pago</h1><div id='box'>"+skel()+"</div>";
  var rp=await sb.from("proveedores").select("*").eq("id",S.pagoProv).single();if(rp.error){m.innerHTML=esc(rp.error.message);return}
  var cta;try{cta=await cuentaProveedores(S.pagoProv)}catch(e){m.innerHTML=esc(e.message);return}
  var rc=esDueno()?await sb.from("cajas").select("*").order("orden"):{error:true};
  var cajas=rc.error?[]:(rc.data||[]);
  var pend=cta.compras.filter(function(c){return c.saldo>0});
  var deuda=redondo(pend.reduce(function(a,c){return a+c.saldo},0));
  var saldoProv=redondo(cta.compras.reduce(function(a,c){return a+(Number(c.total)||0)},0)-cta.pagos.reduce(function(a,x){return a+(Number(x.importe)||0)},0));
  var h="<div class='card'><h2>"+esc(rp.data.nombre)+"</h2><div class='lr'><span class='muted'>Facturas pendientes</span><b>"+money(deuda)+"</b></div>"+
   "<div class='g2'><div><label for='pgFecha'>Fecha</label><input id='pgFecha' type='date' value='"+hoyISO()+"'></div><div><label for='pgImp'>Importe</label><input id='pgImp' inputmode='decimal' value=\""+(deuda?String(deuda).replace(".",","):"")+"\"></div></div>"+
   "<div class='g2'><div><label for='pgMedio'>Medio de pago</label><select id='pgMedio'>"+MEDIOS.map(function(md){return "<option value='"+md[0]+"'>"+md[1]+"</option>"}).join("")+"</select></div>"+
   "<div><label for='pgCaja'>Descontar de la caja</label><select id='pgCaja'><option value=''>No registrar en caja</option>"+cajas.map(function(c,i){return "<option value='"+c.id+"'"+(i===0?" selected":"")+">"+esc(c.nombre)+"</option>"}).join("")+"</select></div></div>"+
   "<label for='pgObs'>Observaciones</label><input id='pgObs' placeholder='Nº de transferencia, cheque, etc.'></div>";
  h+="<div class='card'><h2>¿Qué facturas cancela?</h2><p class='muted' style='margin-top:0'>Se aplica primero a las más viejas. Lo que sobre queda como saldo a favor.</p>"+(pend.map(function(c){
   return "<label style='display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line);margin:0;text-transform:none;letter-spacing:normal;font-size:1rem;color:var(--ink);font-family:var(--f-body)'><input type='checkbox' data-fc='"+c.id+"' checked style='width:auto;min-height:0'>"+
    "<span style='flex:1'>"+(c.numero?"Nº "+esc(c.numero):"Sin número")+" · "+fechaAR(c.fecha)+" "+tagPago(c)+"<br><span class='muted' style='font-size:.85rem' data-ap='"+c.id+"'></span></span><b>"+money(c.saldo)+"</b></label>"}).join("")||"<p class='muted' style='margin:0'>No hay facturas pendientes: el pago queda como saldo a favor.</p>")+
   "<div class='lr' style='margin-top:10px'><span class='muted'>Queda a favor</span><b id='pgSobra'>"+money(0)+"</b></div>"+
   "<div class='lr'><span class='muted'>Saldo con el proveedor después del pago</span><b id='pgResta'>"+money(deuda)+"</b></div></div>";
  h+="<div id='pgSt' class='status hide'></div><div class='btns'><button class='btn' id='pgGuardar'>Registrar pago</button><button class='btn o' id='pgVolver'>Volver</button></div>";
  document.getElementById("box").innerHTML=h;
  function repartir(){
   var resto=numAR(document.getElementById("pgImp").value)||0,ap=[];
   pend.forEach(function(c){var chk=m.querySelector("[data-fc='"+c.id+"']").checked,x=chk?Math.min(resto,c.saldo):0;x=redondo(x);resto=redondo(resto-x);
    if(x>0)ap.push({compra_id:c.id,importe:x});
    m.querySelector("[data-ap='"+c.id+"']").textContent=chk?(x>=c.saldo?"Se paga completa":x>0?"Se pagan "+money(x):"No alcanza el importe"):""});
   document.getElementById("pgSobra").textContent=money(resto>0?resto:0);
   var sal=redondo(saldoProv-(numAR(document.getElementById("pgImp").value)||0));document.getElementById("pgResta").textContent=sal<0?money(-sal)+" a favor":money(sal);
   return ap;
  }
  repartir();
  document.getElementById("pgImp").oninput=repartir;
  m.querySelectorAll("[data-fc]").forEach(function(x){x.onchange=repartir});
  document.getElementById("pgVolver").onclick=function(){irProv("provDetalle",{provSel:S.pagoProv})};
  document.getElementById("pgGuardar").onclick=async function(){
   var imp=redondo(numAR(document.getElementById("pgImp").value));
   if(!(imp>0)){say("pgSt","Poné un importe mayor a 0.",true);return}
   var ap=repartir(),bt=this,fecha=document.getElementById("pgFecha").value||hoyISO(),medio=document.getElementById("pgMedio").value,caja=document.getElementById("pgCaja").value,obs=document.getElementById("pgObs").value.trim();
   bt.disabled=true;
   var movId=null;
   if(caja){
    var hora=new Date(),f=new Date(fecha+"T"+String(hora.getHours()).padStart(2,"0")+":"+String(hora.getMinutes()).padStart(2,"0")+":00");
    var rm=await sb.from("movimientos_caja").insert({taller_id:S.taller.id,tipo:"egreso",concepto:"Pago a "+rp.data.nombre+(obs?" ("+obs+")":""),monto:imp,caja_id:caja,medio_pago:medio,fecha:f.toISOString()}).select().single();
    if(rm.error){bt.disabled=false;say("pgSt","No se pudo registrar en la caja: "+rm.error.message,true);return}
    movId=rm.data.id;
   }
   var rpg=await sb.from("pagos_proveedor").insert({taller_id:S.taller.id,proveedor_id:S.pagoProv,fecha:fecha,importe:imp,medio_pago:medio,observaciones:obs||null,movimiento_id:movId}).select().single();
   if(rpg.error){if(movId)await sb.from("movimientos_caja").delete().eq("id",movId);bt.disabled=false;say("pgSt",rpg.error.message,true);return}
   if(ap.length){var ra=await sb.from("pago_aplicaciones").insert(ap.map(function(a){return {taller_id:S.taller.id,pago_id:rpg.data.id,compra_id:a.compra_id,importe:a.importe}}));
    if(ra.error){bt.disabled=false;say("pgSt","El pago se guardó, pero no se pudo marcar qué facturas cancela: "+ra.error.message,true);return}}
   irProv("provDetalle",{provSel:S.pagoProv});
  };
}
