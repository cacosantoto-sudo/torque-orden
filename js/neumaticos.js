// Neumáticos (estado y vida útil de cada cubierta, cambios) y alineaciones del vehículo.
var VISTAS=window.VISTAS||(window.VISTAS={}),GRUPOS=window.GRUPOS||(window.GRUPOS={});
VISTAS.neuForm=renderNeuForm;VISTAS.aliForm=renderAliForm;GRUPOS.neuForm="clientes";GRUPOS.aliForm="clientes";

function usaNeumaticos(){return rubroTaller()!=="nautica"}
function posicionesNeu(){return rubroTaller()==="motos"?["Delantera","Trasera"]:["Delantera izq.","Delantera der.","Trasera izq.","Trasera der.","Auxilio"]}
var CAMPOS_ALI=[["del_caida_izq","Caída izquierda","Delantero"],["del_caida_der","Caída derecha","Delantero"],["del_conv","Convergencia total","Delantero"],["del_avance_izq","Avance izquierdo","Delantero"],["del_avance_der","Avance derecho","Delantero"],
  ["tra_caida_izq","Caída izquierda","Trasero"],["tra_caida_der","Caída derecha","Trasero"],["tra_conv","Convergencia total","Trasero"]];
function nivelVida(v){if(v==null||v==="")return null;v=Number(v);return v<=15?{cls:"bad",txt:"Reemplazar"}:v<=30?{cls:"w",txt:"Cambiar pronto"}:{cls:"g",txt:"Bien"}}
// Último registro de cada posición = estado actual
function estadoNeumaticos(neus){
  var act={};(neus||[]).slice().sort(function(a,b){return String(b.fecha).localeCompare(String(a.fecha))||String(b.creado||"").localeCompare(String(a.creado||""))})
   .forEach(function(n){if(!act[n.posicion])act[n.posicion]=n});
  return act;
}
function barraVida(v){var n=nivelVida(v);if(!n)return "";var col=n.cls==="bad"?"var(--bad)":n.cls==="w"?"var(--br)":"var(--ok)";
  return "<div style='height:8px;border-radius:4px;background:var(--line2);overflow:hidden;margin-top:4px'><i style='display:block;height:100%;width:"+Math.max(0,Math.min(100,Number(v)))+"%;background:"+col+"'></i></div>"}

/* ---------- tarjetas para la ficha ---------- */
function fichaNeumaticosHtml(neus,alis){
  var act=estadoNeumaticos(neus),pos=posicionesNeu().concat(Object.keys(act).filter(function(p){return posicionesNeu().indexOf(p)<0}));
  var filas=pos.filter(function(p){return act[p]}).map(function(p){var n=act[p],nv=nivelVida(n.vida_pct);
   return "<div style='border-top:1px solid var(--line);padding:10px 0'><div class='lr'><b style='font-family:var(--f-head);text-transform:uppercase;letter-spacing:.04em'>"+esc(p)+"</b>"+(nv?"<span class='tag "+nv.cls+"'>"+nv.txt+"</span>":"")+"</div>"+
    "<span>"+esc([n.marca,n.modelo].filter(Boolean).join(" ")||"Sin marca")+"</span>"+(n.medida?" · <span class='ot'>"+esc(n.medida)+"</span>":"")+
    (n.vida_pct!=null?"<div style='font-size:.9rem;margin-top:2px'>Vida útil estimada: <b>"+n.vida_pct+"%</b>"+(n.desgaste_mm?" · dibujo "+String(n.desgaste_mm).replace(".",",")+" mm":"")+"</div>"+barraVida(n.vida_pct):"")+
    "<div class='muted' style='font-size:.85rem;margin-top:2px'>"+(n.evento==="colocacion"?"Colocada":"Control")+" el "+fechaAR(n.fecha)+(n.km?" · "+kmTxt(n.km):"")+(n.observaciones?" · "+esc(n.observaciones):"")+"</div></div>"}).join("");
  var h="<div class='card'><div class='lr'><h2 style='margin:0'>Neumáticos</h2><button class='btn' id='fNeu' style='padding:6px 12px;min-height:0'>"+ic("plus")+" Control / cambio</button></div>"+
   (filas||"<p class='muted' style='margin:10px 0 0'>Todavía no hay datos de las cubiertas.</p>");
  if((neus||[]).length)h+="<details style='margin-top:8px'><summary class='muted'>Historial de neumáticos ("+neus.length+")</summary>"+neus.map(function(n){
    return "<button class='item' data-neu='"+n.id+"' style='border-top:1px solid var(--line);padding:8px 0;font-size:.92rem'><span><b style='font-family:var(--f-body)'>"+fechaAR(n.fecha)+" · "+esc(n.posicion)+"</b> <span class='muted'>"+(n.evento==="colocacion"?"Colocación":"Control")+"</span><br>"+
     "<span class='muted'>"+esc([n.marca,n.modelo,n.medida,n.vida_pct!=null?n.vida_pct+"%":"",n.km?kmTxt(n.km):""].filter(Boolean).join(" · "))+"</span></span><span class='muted'>›</span></button>"}).join("")+"</details>";
  h+="</div>";
  h+="<div class='card'><div class='lr'><h2 style='margin:0'>Alineaciones</h2><button class='btn o' id='fAli' style='padding:6px 12px;min-height:0'>"+ic("plus")+" Alineación</button></div>"+
   ((alis||[]).length?alis.map(function(a){var v=a.valores||{},vals=CAMPOS_ALI.filter(function(c){return v[c[0]]!=null&&v[c[0]]!==""}).map(function(c){return (c[2]==="Delantero"?"Del. ":"Tras. ")+c[1].toLowerCase()+": "+v[c[0]]});
    return "<button class='item' data-ali='"+a.id+"' style='border-top:1px solid var(--line);padding:10px 0;margin-top:6px'><span><b style='font-family:var(--f-body)'>"+fechaAR(a.fecha)+"</b>"+(a.km?" <span class='muted'>· "+kmTxt(a.km)+"</span>":"")+
     (vals.length?"<br><span style='font-size:.88rem'>"+esc(vals.join(" · "))+"</span>":"")+(a.observaciones?"<br><span class='muted' style='font-size:.88rem'>"+esc(a.observaciones)+"</span>":"")+"</span><span class='muted'>›</span></button>"}).join(""):"<p class='muted' style='margin:10px 0 0'>Todavía no hay alineaciones registradas.</p>")+"</div>";
  return h;
}
function conectarFichaNeu(e,kmActual,neus){
  var b=document.getElementById("fNeu");if(b)b.onclick=function(){S.neu={equipo:e,km:kmActual,neus:neus};S.vista="neuForm";route();window.scrollTo(0,0)};
  var a=document.getElementById("fAli");if(a)a.onclick=function(){S.ali={equipo:e,datos:{equipo_id:e.id,km:kmActual}};S.vista="aliForm";route();window.scrollTo(0,0)};
  m.querySelectorAll("[data-ali]").forEach(function(x){x.onclick=function(){S.ali={equipo:e,datos:{id:x.dataset.ali}};S.vista="aliForm";route();window.scrollTo(0,0)}});
  m.querySelectorAll("[data-neu]").forEach(function(x){x.onclick=function(){editarRegistroNeu(x.dataset.neu,e)}});
}
function volverAFicha(e){S.fichaId=e.id;S.vista="ficha";route()}

/* ---------- control / cambio de cubiertas ---------- */
function renderNeuForm(){
  var N=S.neu||{},e=N.equipo||{},act=estadoNeumaticos(N.neus);
  var h="<h1>Neumáticos</h1><p class='muted'>"+esc(vehTitulo(e))+(e.matricula_patente?" · "+esc(e.matricula_patente):"")+"</p>"+
   "<div class='card'><label for='nf_evento' style='margin-top:0'>Qué hiciste</label><select id='nf_evento'><option value='control'>Control del estado de las cubiertas</option><option value='colocacion'>Colocación de cubiertas nuevas</option></select>"+
   "<div class='g2'><div><label for='nf_fecha'>Fecha</label><input id='nf_fecha' type='date' value='"+hoyISO()+"'></div><div><label for='nf_km'>"+medidorLabel()+"</label><input id='nf_km' inputmode='numeric' value='"+esc(N.km||"")+"'></div></div>"+
   "<p class='muted' style='margin:10px 0 0'>Marcá las cubiertas que revisaste o cambiaste. La vida útil se calcula sola si cargás la profundidad del dibujo (nueva ≈ 8 mm, mínimo legal 1,6 mm).</p></div>";
  h+=posicionesNeu().map(function(p,i){var a=act[p]||{},on=p!=="Auxilio";
   return "<div class='card'><label class='lr' style='justify-content:flex-start;gap:10px;margin:0;text-transform:none;letter-spacing:0;font-size:1.05rem;color:var(--ink)'><input type='checkbox' data-pos='"+i+"'"+(on?" checked":"")+" style='width:24px;min-height:24px'> <b style='font-family:var(--f-head);text-transform:uppercase;letter-spacing:.05em'>"+esc(p)+"</b>"+
    (a.vida_pct!=null?"<span class='muted' style='margin-left:auto;font-size:.88rem'>antes: "+a.vida_pct+"%</span>":"")+"</label>"+
    "<div id='nfp_"+i+"' class='"+(on?"":"hide")+"'><div class='g2'><div><label for='nf_marca_"+i+"'>Marca</label><input id='nf_marca_"+i+"' value=\""+esc(a.marca||"")+"\"></div><div><label for='nf_medida_"+i+"'>Medida</label><input id='nf_medida_"+i+"' value=\""+esc(a.medida||"")+"\" placeholder='205/55 R16'></div></div>"+
    "<label for='nf_modelo_"+i+"'>Modelo (opcional)</label><input id='nf_modelo_"+i+"' value=\""+esc(a.modelo||"")+"\">"+
    "<div class='g2'><div><label for='nf_mm_"+i+"'>Dibujo (mm)</label><input id='nf_mm_"+i+"' inputmode='decimal' data-mm='"+i+"'></div><div><label for='nf_vida_"+i+"'>Vida útil (%)</label><input id='nf_vida_"+i+"' inputmode='numeric' data-vida='"+i+"'></div></div>"+
    "<label for='nf_obs_"+i+"'>Observaciones</label><input id='nf_obs_"+i+"' placeholder='Desgaste parejo, golpe en el flanco…'></div></div>"}).join("");
  h+="<div id='st' class='status hide'></div><div class='btns'><button class='btn' id='nfGuardar'>Guardar</button><button class='btn o' id='nfVolver'>Volver</button></div>";
  m.innerHTML=h;
  var ev=document.getElementById("nf_evento");
  ev.onchange=function(){if(ev.value==="colocacion")m.querySelectorAll("[data-vida]").forEach(function(x){if(!x.value)x.value=100})};
  m.querySelectorAll("[data-pos]").forEach(function(c){c.onchange=function(){document.getElementById("nfp_"+c.dataset.pos).classList.toggle("hide",!c.checked)}});
  m.querySelectorAll("[data-vida]").forEach(function(x){x.oninput=function(){x.dataset.tocado=x.value?"1":""}});
  m.querySelectorAll("[data-mm]").forEach(function(x){x.oninput=function(){var v=document.getElementById("nf_vida_"+x.dataset.mm),mm=Number(x.value.replace(",","."));
   if(v.dataset.tocado||!mm)return;v.value=Math.max(0,Math.min(100,Math.round((mm-1.6)/(8-1.6)*100)))}});
  document.getElementById("nfVolver").onclick=function(){volverAFicha(e)};
  document.getElementById("nfGuardar").onclick=async function(){
   var filas=[],fecha=document.getElementById("nf_fecha").value||hoyISO(),km=Number(document.getElementById("nf_km").value.replace(/\./g,""))||null;
   posicionesNeu().forEach(function(p,i){if(!m.querySelector("[data-pos='"+i+"']").checked)return;
    function v(k){return document.getElementById("nf_"+k+"_"+i).value.trim()}
    var vida=v("vida")===""?null:Math.max(0,Math.min(100,Math.round(Number(v("vida").replace(",",".")))));
    filas.push({taller_id:S.taller.id,equipo_id:e.id,fecha:fecha,km:km,evento:ev.value,posicion:p,marca:v("marca")||null,medida:v("medida").toUpperCase()||null,modelo:v("modelo")||null,
     vida_pct:isNaN(vida)?null:vida,desgaste_mm:Number(v("mm").replace(",","."))||null,observaciones:v("obs")||null})});
   if(!filas.length){say("st","Marcá al menos una cubierta.",true);return}
   this.disabled=true;say("st","Guardando…");
   var r=await sb.from("neumaticos").insert(filas);this.disabled=false;
   if(r.error){say("st",/neumaticos|schema cache|does not exist/i.test(r.error.message)?"Falta correr el SQL nuevo en Supabase (sql/2026-10-06_4_neumaticos.sql).":r.error.message,true);return}
   volverAFicha(e);
  };
}
async function editarRegistroNeu(id,e){
  var r=await sb.from("neumaticos").select("*").eq("id",id).single();if(r.error){alert(r.error.message);return}
  var n=r.data,txt=prompt("Vida útil (%) de "+n.posicion+" del "+fechaAR(n.fecha)+".\nDejalo vacío y aceptá para ELIMINAR este registro.",n.vida_pct==null?"":n.vida_pct);
  if(txt==null)return;
  if(txt.trim()===""){if(!confirm("¿Eliminar este registro de neumáticos?"))return;var d=await sb.from("neumaticos").delete().eq("id",id);if(d.error){alert(d.error.message);return}}
  else{var u=await sb.from("neumaticos").update({vida_pct:Math.max(0,Math.min(100,Math.round(Number(txt.replace(",",".")))||0))}).eq("id",id);if(u.error){alert(u.error.message);return}}
  volverAFicha(e);
}

/* ---------- alineación ---------- */
async function renderAliForm(){
  var A=S.ali||{},e=A.equipo||{},x=Object.assign({fecha:hoyISO(),valores:{}},A.datos||{});
  m.innerHTML="<h1>"+(x.id?"Editar alineación":"Alineación")+"</h1><p class='muted'>"+esc(vehTitulo(e))+(e.matricula_patente?" · "+esc(e.matricula_patente):"")+"</p><div id='box'>"+skel(2)+"</div>";
  if(x.id){var r=await sb.from("alineaciones").select("*").eq("id",x.id).single();if(r.error){document.getElementById("box").innerHTML=esc(r.error.message);return}x=r.data;x.valores=x.valores||{}}
  var grupos=rubroTaller()==="motos"?[]:["Delantero","Trasero"];
  var h="<div class='card'><div class='g2'><div><label for='al_fecha' style='margin-top:0'>Fecha</label><input id='al_fecha' type='date' value='"+esc(x.fecha)+"'></div><div><label for='al_km' style='margin-top:0'>"+medidorLabel()+"</label><input id='al_km' inputmode='numeric' value='"+esc(x.km||"")+"'></div></div></div>";
  h+=grupos.map(function(g){return "<div class='card'><h2>Tren "+g.toLowerCase()+"</h2><div class='g2'>"+CAMPOS_ALI.filter(function(c){return c[2]===g}).map(function(c){
   return "<div><label for='al_"+c[0]+"'>"+c[1]+"</label><input id='al_"+c[0]+"' data-al='"+c[0]+"' value=\""+esc(x.valores[c[0]]||"")+"\" placeholder='"+(/conv/.test(c[0])?"0°10′ / 1 mm":"-0°30′")+"'></div>"}).join("")+"</div></div>"}).join("");
  h+="<div class='card'><label for='al_obs' style='margin-top:0'>Observaciones</label><textarea id='al_obs' placeholder='Valores antes / después, piezas con juego, recomendaciones…'>"+esc(x.observaciones||"")+"</textarea></div>";
  h+="<div id='st' class='status hide'></div><div class='btns'><button class='btn' id='alGuardar'>Guardar</button><button class='btn o' id='alVolver'>Volver</button>"+(x.id?"<button class='btn d' id='alBorrar'>Eliminar</button>":"")+"</div>";
  document.getElementById("box").outerHTML=h;
  document.getElementById("alVolver").onclick=function(){volverAFicha(e)};
  var bb=document.getElementById("alBorrar");if(bb)bb.onclick=async function(){if(!confirm("¿Eliminar esta alineación?"))return;var d=await sb.from("alineaciones").delete().eq("id",x.id);if(d.error){say("st",d.error.message,true);return}volverAFicha(e)};
  document.getElementById("alGuardar").onclick=async function(){
   var vals={};m.querySelectorAll("[data-al]").forEach(function(i){if(i.value.trim())vals[i.dataset.al]=i.value.trim()});
   var data={fecha:document.getElementById("al_fecha").value||hoyISO(),km:Number(document.getElementById("al_km").value.replace(/\./g,""))||null,valores:vals,observaciones:document.getElementById("al_obs").value.trim()||null};
   if(!Object.keys(vals).length&&!data.observaciones){say("st","Cargá algún valor o una observación.",true);return}
   this.disabled=true;say("st","Guardando…");
   var r=x.id?await sb.from("alineaciones").update(data).eq("id",x.id):await sb.from("alineaciones").insert(Object.assign({taller_id:S.taller.id,equipo_id:e.id},data));
   this.disabled=false;
   if(r.error){say("st",/alineaciones|schema cache|does not exist/i.test(r.error.message)?"Falta correr el SQL nuevo en Supabase (sql/2026-10-06_4_neumaticos.sql).":r.error.message,true);return}
   volverAFicha(e);
  };
}
