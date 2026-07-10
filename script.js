import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVHOUG46CIy9uoQb6yJmsC-OOTNEkBzVs",
  authDomain: "gestorboletas.firebaseapp.com",
  databaseURL: "https://gestorboletas-default-rtdb.firebaseio.com",
  projectId: "gestorboletas",
  storageBucket: "gestorboletas.firebasestorage.app",
  messagingSenderId: "296918379486",
  appId: "1:296918379486:web:cc711e932d43388f140b4f",
  measurementId: "G-SSF2LYT03B"
};

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

let boletas = [], semanas = [], meses = [], empresas = [], recargas = [], cajas = [];
let pagoCtePendienteId = null;
let unsubBoletas, unsubSemanas, unsubMeses, unsubEmpresas, unsubRecargas, unsubCajas;

// ── AUTH ──
onAuthStateChanged(auth, user => {
  if(user){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app-screen').style.display='flex';
    document.getElementById('user-email-badge').textContent = user.email;
    iniciarListeners();
  } else {
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('app-screen').style.display='none';
    [unsubBoletas,unsubSemanas,unsubMeses,unsubEmpresas,unsubRecargas,unsubCajas].forEach(u=>u&&u());
  }
});

window.doLogin = async function(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const btn=document.getElementById('btn-login-do');
  const err=document.getElementById('login-error');
  err.style.display='none'; btn.textContent='Ingresando...'; btn.disabled=true;
  try{ await signInWithEmailAndPassword(auth,email,pass); }
  catch(e){ err.style.display='block'; btn.textContent='Ingresar'; btn.disabled=false; }
};
window.doLogout = () => signOut(auth);

// ── LISTENERS ──
function iniciarListeners(){
  unsubBoletas = onSnapshot(query(collection(db,'boletas'),orderBy('fechaHora','desc')), snap=>{
    boletas = snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  });
  unsubSemanas = onSnapshot(query(collection(db,'semanas'),orderBy('num','asc')), snap=>{
    semanas = snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  });
  unsubMeses = onSnapshot(query(collection(db,'meses'),orderBy('inicio','asc')), snap=>{
    meses = snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  });
  unsubEmpresas = onSnapshot(query(collection(db,'empresas'),orderBy('nombre','asc')), snap=>{
    empresas = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderEmpresas();
  });
  unsubRecargas = onSnapshot(query(collection(db,'recargas'),orderBy('fechaHora','asc')), snap=>{
    recargas = snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  });
  unsubCajas = onSnapshot(query(collection(db,'cajas'),orderBy('fecha','desc')), snap=>{
    cajas = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderCajas();
  });
}

// ── HELPERS ──
function fmt(n){ return '$'+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtF(s){ return s ? new Date(s+'T12:00:00').toLocaleDateString('es-AR') : '—'; }
function fmtFH(iso){ return iso ? new Date(iso).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'; }
function hoy() {
    const d = new Date();

    const año = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
}
function semanaActiva(){ return semanas.find(s=>!s.cerrada)||null; }

// Determina a qué semana pertenece un pago de cta cte (por fecha de pago)
function semanaDelPago(fechaPago){
  if(!fechaPago) return null;
  // Buscamos la semana cuyo rango contiene la fecha de pago
  for(const s of semanas){
    const desde = s.inicio;
    const hasta = s.fin || hoy();
    if(fechaPago >= desde && fechaPago <= hasta) return s;
  }
  return null;
}

// ── NAV ──
window.showSection = function(s, el){
  document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('sec-'+s).classList.add('active');
  el.classList.add('active');
};

window.toggleCamposCarga = function(){
  const esCte = document.getElementById('inp-tipo').value==='cte';
  document.getElementById('field-fecha-cte').style.display  = esCte?'block':'none';
  document.getElementById('field-medio-pago').style.display = esCte?'none':'block';
};

// ── BOLETAS ──
window.agregarBoleta = async function(){
  const sem = semanaActiva();
  const prov   = document.getElementById('inp-prov').value.trim();
  const empresa= document.getElementById('inp-empresa').value;
  const cat    = document.getElementById('inp-cat').value;
  const monto  = parseFloat(document.getElementById('inp-monto').value)||0;
  const tipo   = document.getElementById('inp-tipo').value;
  const medio  = tipo==='contado'?document.getElementById('inp-medio').value:null;
  const fechaCte = document.getElementById('inp-fecha-cte').value;
  // Fecha manual de la boleta: si se llenó se usa, sino fecha de hoy
  const fechaBoleta = (document.getElementById('inp-fecha-boleta')||{value:''}).value || hoy();
  if(!prov)  { alert('Ingresá el concepto'); return; }
  if(!empresa){ alert('Seleccioná una empresa'); return; }
  if(!monto)  { alert('Ingresá un monto válido'); return; }
  if(tipo==='cte'&&!fechaCte){ alert('Ingresá la fecha de vencimiento'); return; }
  const ahora = new Date().toISOString();
  await addDoc(collection(db,'boletas'),{
    fecha: fechaBoleta, fechaHora: ahora,
    semanaId: sem?sem.id:null, semanaNum: sem?sem.num:null,
    proveedor: prov, empresa, categoria: cat,
    monto, tipo, medio: medio||null,
    fechaCte: fechaCte||null,
    pagadaCte: false, fechaPagoCte: null, medioPagoCte: null,
    semanaIdPago: null, semanaNumPago: null
  });
  document.getElementById('inp-prov').value='';
  document.getElementById('inp-monto').value='';
  document.getElementById('inp-fecha-cte').value='';
  document.getElementById('inp-fecha-boleta').value='';
  document.getElementById('inp-tipo').value='contado';
  document.getElementById('field-fecha-cte').style.display='none';
  document.getElementById('field-medio-pago').style.display='block';
};

window.eliminarBoleta = async function(id){
  if(!confirm('¿Eliminar esta boleta?')) return;
  await deleteDoc(doc(db,'boletas',id));
};

window.abrirModalPago = function(id){
  pagoCtePendienteId = id;
  document.getElementById('modal-fecha-pago').value = hoy();
  document.getElementById('modal-pago').classList.add('open');
};
window.cerrarModal = function(){
  document.getElementById('modal-pago').classList.remove('open');
  pagoCtePendienteId = null;
};
window.confirmarPago = async function(){
  if(!pagoCtePendienteId) return;
  const fecha = document.getElementById('modal-fecha-pago').value;
  const medio = document.getElementById('modal-medio-pago').value;
  if(!fecha){ alert('Seleccioná la fecha de pago'); return; }
  // Determinar a qué semana pertenece el pago
  const semPago = semanaDelPago(fecha);
  await updateDoc(doc(db,'boletas',pagoCtePendienteId),{
    pagadaCte: true,
    fechaPagoCte: fecha,
    medioPagoCte: medio,
    semanaIdPago: semPago?semPago.id:null,
    semanaNumPago: semPago?semPago.num:null
  });
  cerrarModal();
};

// ── SEMANAS ──
async function _crearSemana(){
  await addDoc(collection(db,'semanas'),{
    num: semanas.length+1, inicio: hoy(), fin: null, cerrada: false
  });
}

async function _iniciarSemana(){
  const act = semanaActiva();
  if(act){ alert('Hay una semana activa. Cerrala primero desde la sección Semanal.'); return false; }
  await _crearSemana();
  // Si estamos entre el 1 y el 5 del mes, preguntar si abrir mes también
  const diaDelMes = new Date().getDate();
  if(diaDelMes >= 1 && diaDelMes <= 5){
    const mesActivo = meses.find(m=>!m.cerrado);
    if(!mesActivo){
      const quiereMes = confirm(
        `Estamos a ${diaDelMes} del mes.\n\n¿Querés abrir también el mes junto con la semana?`
      );
      if(quiereMes){
        const nombre = new Date().toLocaleString('es-AR',{month:'long',year:'numeric'});
        await addDoc(collection(db,'meses'),{ mes:nombre, inicio:hoy(), fin:null, cerrado:false });
      }
    }
  }
  return true;
}

window.iniciarSemana = async function(){
  if(!confirm('¿Iniciar una nueva semana?')) return;
  await _iniciarSemana();
};

window.cerrarSemana = async function(){
  const act = semanaActiva();
  if(!act){ alert('No hay semana activa'); return; }
  if(!confirm(`¿Cerrar la Semana ${act.num}? Se registrará el cierre con la fecha de hoy.`)) return;
  await updateDoc(doc(db,'semanas',act.id),{ cerrada:true, fin:hoy() });
  // Si es la semana 4 o 5 (contando desde el mes activo), preguntar si cerrar el mes
  const mesActivo = meses.find(m=>!m.cerrado);
  if(mesActivo){
    // Contar cuántas semanas pertenecen a este mes
    const semanasMes = semanas.filter(s=>s.inicio >= mesActivo.inicio).length;
    if(semanasMes >= 4){
      const quiereCerrar = confirm(
        `Esta es la semana ${semanasMes} del mes.\n\n¿Querés cerrar también el mes actual?`
      );
      if(quiereCerrar){
        await updateDoc(doc(db,'meses',mesActivo.id),{ cerrado:true, fin:hoy() });
      }
    }
  }
};

window.agregarSaldo = async function(){
  const act = semanaActiva();
  if(!act){ alert('No hay semana activa. Iniciá una semana primero.'); return; }
  const monto = parseFloat(document.getElementById('inp-recarga').value)||0;
  if(!monto){ alert('Ingresá un monto válido'); return; }
  const motivo = document.getElementById('inp-recarga-motivo').value.trim();
  await addDoc(collection(db,'recargas'),{
    semanaId: act.id, semanaNum: act.num,
    monto, motivo: motivo||'Recarga de saldo',
    fechaHora: new Date().toISOString(), fecha: hoy()
  });
  document.getElementById('inp-recarga').value='';
  document.getElementById('inp-recarga-motivo').value='';
};

// ── MESES ──
window.abrirMes = async function(){
  const activo = meses.find(m=>!m.cerrado);
  if(activo){ alert('Ya hay un mes activo. Cerralo primero.'); return; }
  const nombre = new Date().toLocaleString('es-AR',{month:'long',year:'numeric'});
  await addDoc(collection(db,'meses'),{ mes:nombre, inicio:hoy(), fin:null, cerrado:false });
};
window.cerrarMes = async function(){
  let activo = meses.find(m=>!m.cerrado);
  if(!activo){ alert('No hay mes activo. Iniciá uno primero.'); return; }
  if(!confirm('¿Cerrar el mes actual?')) return;
  await updateDoc(doc(db,'meses',activo.id),{ cerrado:true, fin:hoy() });
};

// ── CAJAS ──
window.guardarCaja = async function(){
  const cajera      = document.getElementById('cj-cajera').value.trim();
  const fecha       = document.getElementById('cj-fecha').value;
  const fechaCierre = (document.getElementById('cj-fecha-cierre')||{value:null}).value||null;
  const hInicio     = document.getElementById('cj-hora-inicio').value;
  const hCierre  = document.getElementById('cj-hora-cierre').value;
  const efectivo = parseFloat(document.getElementById('cj-efectivo').value)||0;
  const pyDeb    = parseFloat(document.getElementById('cj-py-debito').value)||0;
  const pyEfec   = parseFloat(document.getElementById('cj-py-efectivo').value)||0;
  const mp       = parseFloat(document.getElementById('cj-mp').value)||0;
  const tarjeta  = parseFloat(document.getElementById('cj-tarjeta').value)||0;
  const difTipo  = document.getElementById('cj-dif-tipo').value;
  const difMonto = difTipo!=='ninguna' ? (parseFloat(document.getElementById('cj-dif-monto').value)||0) : 0;
  const comentario = document.getElementById('cj-comentario').value.trim();

  if(!cajera){ alert('Ingresá el nombre de la cajera'); return; }
  if(!fecha) { alert('Ingresá la fecha de la caja'); return; }

  const total = efectivo + pyDeb + pyEfec + mp + tarjeta;
  const diferencia = difTipo==='falta' ? -difMonto : difTipo==='sobra' ? difMonto : 0;

  await addDoc(collection(db,'cajas'),{
    cajera, fecha, fechaCierre,
    horaInicio: hInicio||null, horaCierre: hCierre||null,
    efectivo, pyDebito: pyDeb, pyEfectivo: pyEfec, mercadoPago: mp, tarjeta,
    total, difTipo, difMonto, diferencia,
    comentario: comentario||null,
    creadoEn: new Date().toISOString()
  });

  // Limpiar form
  ['cj-cajera','cj-fecha-cierre','cj-hora-inicio','cj-hora-cierre','cj-efectivo',
   'cj-py-debito','cj-py-efectivo','cj-mp','cj-tarjeta','cj-dif-monto','cj-comentario'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  document.getElementById('cj-dif-tipo').value='ninguna';
  document.getElementById('cj-dif-monto-wrap').style.display='none';
  document.getElementById('cj-fecha').value = hoy();
};

document.addEventListener('DOMContentLoaded', ()=>{
  const difSel = document.getElementById('cj-dif-tipo');
  if(difSel){
    difSel.addEventListener('change', function(){
      document.getElementById('cj-dif-monto-wrap').style.display =
        this.value!=='ninguna' ? 'block' : 'none';
    });
  }
  const fechaEl = document.getElementById('cj-fecha');
  if(fechaEl) fechaEl.value = hoy();
  // Fecha boleta se deja vacía (opcional — si no se llena usa hoy)
  // Filtro cajas: iniciar en modo "todas", sin fecha prefijada
  const modoEl = document.getElementById('filtro-caja-modo');
  if(modoEl) {
    modoEl.value = 'todas';
    modoEl.addEventListener('change', renderCajas);
  }
  const fechaFiltro = document.getElementById('filtro-caja-fecha');
  if(fechaFiltro) fechaFiltro.value = hoy();
});

// ── LIMPIAR FILTROS CAJAS ──
window.limpiarFiltrosCajas = function(){
  const modoEl = document.getElementById('filtro-caja-modo');
  if(modoEl) modoEl.value = 'todas';
  const fechaEl = document.getElementById('filtro-caja-fecha');
  if(fechaEl) { fechaEl.value = hoy(); fechaEl.style.display='none'; }
  const cajeraEl = document.getElementById('filtro-caja-cajera');
  if(cajeraEl) cajeraEl.value = '';
  renderCajas();
};

window.eliminarCaja = async function(id){
  if(!confirm('¿Eliminar esta caja?')) return;
  await deleteDoc(doc(db,'cajas',id));
};

window.toggleCajaBody = function(id, chevId){
  const b=document.getElementById(id);
  const ch=document.getElementById(chevId);
  if(!b) return;
  b.classList.toggle('open');
  if(ch) ch.classList.toggle('open');
};

window.renderCajas = function(){
  const modoEl = document.getElementById('filtro-caja-modo');
  const modo = modoEl ? modoEl.value : 'todas';
  const fechaEl = document.getElementById('filtro-caja-fecha');
  // Mostrar/ocultar campo fecha según modo
  if(fechaEl) fechaEl.style.display = modo==='dia' ? 'inline-block' : 'none';
  const fechaFiltro  = modo==='dia' ? ((fechaEl||{}).value || hoy()) : '';
  const cajeraFiltro = ((document.getElementById('filtro-caja-cajera')||{}).value||'').toLowerCase().trim();

  // Badge resumen
  const badge = document.getElementById('fecha-cajas-badge');
  if(badge) badge.textContent = modo==='dia' ? fmtF(fechaFiltro) : 'Todas las cajas';

  let cajasVistas = cajas.filter(cj=>{
    const okFecha   = !fechaFiltro || cj.fecha===fechaFiltro;
    const okCajera  = !cajeraFiltro || cj.cajera.toLowerCase().includes(cajeraFiltro);
    return okFecha && okCajera;
  });

  // Resumen del día filtrado
  const totalEfec    = cajasVistas.reduce((a,b)=>a+(b.efectivo||0),0);
  const totalPYDebito = cajasVistas.reduce((a,b)=>a+(b.pyDebito||0),0);
  const totalPYEfectivo = cajasVistas.reduce((a,b)=>a+(b.pyEfectivo||0),0);
  const totalMP      = cajasVistas.reduce((a,b)=>a+(b.mercadoPago||0),0);
  const totalTarjeta = cajasVistas.reduce((a,b)=>a+(b.tarjeta||0),0);
  const totalGen     = cajasVistas.reduce((a,b)=>a+(b.total||0),0);
  const totalDif     = cajasVistas.reduce((a,b)=>a+(b.diferencia||0),0);

  const setM = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  setM('mc-cantidad', cajasVistas.length);
  setM('mc-efectivo', fmt(totalEfec));
  setM('mc-py-debito', fmt(totalPYDebito));
  setM('mc-py-efectivo', fmt(totalPYEfectivo));
  setM('mc-mp',       fmt(totalMP));
  setM('mc-tarjeta',  fmt(totalTarjeta));
  setM('mc-total',    fmt(totalGen));
  const difEl = document.getElementById('mc-dif');
  if(difEl){
    difEl.textContent = (totalDif>=0?'+':'')+fmt(totalDif);
    difEl.className   = 'metric-value '+(totalDif<0?'red':totalDif>0?'amber':'green');
  }

  const lista = document.getElementById('lista-cajas');
  if(!lista) return;

  if(!cajasVistas.length){
    lista.innerHTML='<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic;font-size:13px">Sin cajas registradas para este filtro.</div>';
    return;
  }

  lista.innerHTML = cajasVistas.map((cj,i)=>{
    const inicial = cj.cajera.trim().charAt(0).toUpperCase();
    const horario = [cj.horaInicio, cj.horaCierre].filter(Boolean).join(' → ') || 'Sin horario';
    const difHtml = cj.diferencia===0
      ? '<span class="diferencia-ok">✓ Sin diferencia</span>'
      : cj.diferencia<0
        ? `<span class="diferencia-neg">▼ Falta ${fmt(Math.abs(cj.diferencia))}</span>`
        : `<span class="diferencia-ok">▲ Sobra ${fmt(cj.diferencia)}</span>`;
    const uid = 'caja-'+cj.id;
    const chid = 'chev-'+cj.id;
    return `<div class="caja-card">
      <div class="caja-header" onclick="toggleCajaBody('${uid}','${chid}')">
        <div class="caja-avatar">${inicial}</div>
        <div class="caja-info-main">
          <div class="caja-cajera">${cj.cajera}</div>
          <div class="caja-meta">${fmtF(cj.fecha)}${cj.fechaCierre&&cj.fechaCierre!==cj.fecha?' → '+fmtF(cj.fechaCierre):''} &nbsp;·&nbsp; ${horario}</div>
        </div>
        <div class="caja-total-wrap">
          <div class="caja-total-label">Total</div>
          <div class="caja-total-val" style="color:var(--success)">${fmt(cj.total||0)}</div>
        </div>
        <span class="caja-chevron" id="${chid}">▼</span>
      </div>
      <div class="caja-body" id="${uid}">
        <div class="medios-grid">
          <div class="medio-item">
            <div class="medio-label">💵 Efectivo</div>
            <div class="medio-val">${fmt(cj.efectivo||0)}</div>
          </div>
          <div class="medio-item">
            <div class="medio-label">🛵 PY Débito</div>
            <div class="medio-val">${fmt(cj.pyDebito||0)}</div>
          </div>
          <div class="medio-item">
            <div class="medio-label">🛵 PY Efectivo</div>
            <div class="medio-val">${fmt(cj.pyEfectivo||0)}</div>
          </div>
          <div class="medio-item">
            <div class="medio-label">💙 Mercado Pago</div>
            <div class="medio-val">${fmt(cj.mercadoPago||0)}</div>
          </div>
          <div class="medio-item">
            <div class="medio-label">💳 Tarjeta</div>
            <div class="medio-val">${fmt(cj.tarjeta||0)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:.5rem">
          ${difHtml}
          <button class="btn-sm" onclick="abrirEditarCaja('${cj.id}')">✏ Editar</button>
          <button class="icon-btn danger" onclick="eliminarCaja('${cj.id}')" title="Eliminar">✕</button>
        </div>
        ${cj.comentario?`<div class="caja-comentario">💬 ${cj.comentario}</div>`:''}
      </div>
    </div>`;
  }).join('');
};


// ── EDITAR CAJA ──
window.abrirEditarCaja = function(id){
  const cj = cajas.find(c=>c.id===id);
  if(!cj) return;
  document.getElementById('edit-caja-id').value        = id;
  document.getElementById('edit-cajera').value         = cj.cajera||'';
  document.getElementById('edit-fecha').value          = cj.fecha||'';
  document.getElementById('edit-fecha-cierre').value   = cj.fechaCierre||'';
  document.getElementById('edit-hora-inicio').value    = cj.horaInicio||'';
  document.getElementById('edit-hora-cierre').value    = cj.horaCierre||'';
  document.getElementById('edit-efectivo').value       = cj.efectivo||0;
  document.getElementById('edit-py-debito').value      = cj.pyDebito||0;
  document.getElementById('edit-py-efectivo').value    = cj.pyEfectivo||0;
  document.getElementById('edit-mp').value             = cj.mercadoPago||0;
  document.getElementById('edit-tarjeta').value        = cj.tarjeta||0;
  document.getElementById('edit-dif-tipo').value       = cj.difTipo||'ninguna';
  document.getElementById('edit-dif-monto').value      = cj.difMonto||0;
  document.getElementById('edit-comentario').value     = cj.comentario||'';
  document.getElementById('modal-editar-caja').classList.add('open');
};

window.cerrarModalEditarCaja = function(){
  document.getElementById('modal-editar-caja').classList.remove('open');
};

window.guardarEdicionCaja = async function(){
  const id          = document.getElementById('edit-caja-id').value;
  const cajera      = document.getElementById('edit-cajera').value.trim();
  const fecha       = document.getElementById('edit-fecha').value;
  const fechaCierre = document.getElementById('edit-fecha-cierre').value||null;
  const hInicio     = document.getElementById('edit-hora-inicio').value;
  const hCierre     = document.getElementById('edit-hora-cierre').value;
  const efectivo    = parseFloat(document.getElementById('edit-efectivo').value)||0;
  const pyDeb       = parseFloat(document.getElementById('edit-py-debito').value)||0;
  const pyEfec      = parseFloat(document.getElementById('edit-py-efectivo').value)||0;
  const mp          = parseFloat(document.getElementById('edit-mp').value)||0;
  const tarjeta     = parseFloat(document.getElementById('edit-tarjeta').value)||0;
  const difTipo     = document.getElementById('edit-dif-tipo').value;
  const difMonto    = parseFloat(document.getElementById('edit-dif-monto').value)||0;
  const diferencia  = difTipo==='falta'?-difMonto:difTipo==='sobra'?difMonto:0;
  const total       = efectivo+pyDeb+pyEfec+mp+tarjeta;
  const comentario  = document.getElementById('edit-comentario').value.trim()||null;
  if(!cajera){ alert('Ingresá el nombre de la cajera'); return; }
  await updateDoc(doc(db,'cajas',id),{
    cajera, fecha, fechaCierre,
    horaInicio: hInicio||null, horaCierre: hCierre||null,
    efectivo, pyDebito:pyDeb, pyEfectivo:pyEfec, mercadoPago:mp, tarjeta,
    total, difTipo, difMonto, diferencia, comentario
  });
  cerrarModalEditarCaja();
};


// ── HISTORIAL DE GASTOS ──
window.renderHistorial = function(){
  const buscar = (document.getElementById('hist-buscar')||{value:''}).value.toLowerCase().trim();
  const tipoFiltro = (document.getElementById('hist-tipo')||{value:''}).value;

  let bFiltradas = [...boletas];
  if(buscar) bFiltradas = bFiltradas.filter(b=>
    (b.proveedor||'').toLowerCase().includes(buscar) ||
    (b.empresa||'').toLowerCase().includes(buscar)
  );
  if(tipoFiltro) bFiltradas = bFiltradas.filter(b=>b.tipo===tipoFiltro);

  // Métricas globales del filtro
  const totCont = bFiltradas.filter(b=>b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
  const totCte  = bFiltradas.filter(b=>b.tipo==='cte').reduce((a,b)=>a+b.monto,0);
  const setM = (id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setM('hist-total-n',    bFiltradas.length);
  setM('hist-total-cont', fmt(totCont));
  setM('hist-total-cte',  fmt(totCte));
  setM('hist-total-gen',  fmt(totCont+totCte));

  const lista = document.getElementById('lista-historial');
  if(!lista) return;
  if(!bFiltradas.length){
    lista.innerHTML='<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic;font-size:13px">Sin boletas que coincidan con el filtro.</div>';
    return;
  }

  // Agrupar por semana (semanaNum) — sin semana va al grupo "Sin semana asignada"
  const grupos = {};
  bFiltradas.forEach(b=>{
    const key = b.semanaId || '__sin_semana__';
    if(!grupos[key]) grupos[key] = { semanaNum: b.semanaNum||null, semanaId: b.semanaId||null, boletas: [] };
    grupos[key].boletas.push(b);
  });

  // Ordenar grupos: primero semanas (desc por num), luego sin semana
  const gruposOrdenados = Object.values(grupos).sort((a,b)=>{
    if(!a.semanaNum && !b.semanaNum) return 0;
    if(!a.semanaNum) return 1;
    if(!b.semanaNum) return -1;
    return b.semanaNum - a.semanaNum;
  });

  lista.innerHTML = gruposOrdenados.map(g=>{
    const sem = g.semanaId ? semanas.find(s=>s.id===g.semanaId) : null;
    const titulo = sem ? `Semana ${sem.num}` : 'Sin semana asignada';
    const subtitulo = sem ? `${fmtF(sem.inicio)} → ${sem.fin?fmtF(sem.fin):'En curso'}` : '';
    const bOrdenadas = [...g.boletas].sort((a,b)=>((b.fechaHora||b.fecha)>(a.fechaHora||a.fecha)?1:-1));
    const totGrupo = bOrdenadas.reduce((a,b)=>a+b.monto,0);
    const uid = 'hist-body-'+(g.semanaId||'sin');
    const chid = 'hist-chev-'+(g.semanaId||'sin');
    const h = hoy();

    const filas = bOrdenadas.map(b=>{
      const medioTexto = b.tipo==='cte'
        ? (b.pagadaCte ? (b.medioPagoCte==='Transferencia'?'🏦 Transf.':b.medioPagoCte==='Tarjeta'?'💳 Tarjeta':'💵 Efectivo') : '—')
        : (b.medio==='Transferencia'?'🏦 Transf.':b.medio==='Tarjeta'?'💳 Tarjeta':'💵 Efectivo');
      const venc = b.fechaCte && !b.pagadaCte && b.fechaCte < h;
      const rowBg = venc ? 'background:var(--danger-bg)' : (b.tipo==='cte' && !b.pagadaCte ? 'background:var(--warning-bg)' : '');
      const pagarBtn = (b.tipo==='cte' && !b.pagadaCte)
        ? '<button class="btn-sm success" onclick="abrirModalPago(\'' + b.id + '\')">✓ Pagar</button>'
        : '';
      return '<tr style="' + rowBg + '">'
        + '<td style="font-size:12px;color:var(--text3);white-space:nowrap">' + fmtFH(b.fechaHora) + '</td>'
        + '<td style="font-size:11px;color:var(--text3)">' + fmtF(b.fecha) + '</td>'
        + '<td><strong>' + (b.proveedor||'') + '</strong></td>'
        + '<td>' + (b.empresa||'—') + '</td>'
        + '<td>' + (b.categoria||'—') + '</td>'
        + '<td><span class="badge ' + b.tipo + '">' + (b.tipo==='contado'?'Contado':'Cta. Cte.') + '</span></td>'
        + '<td style="font-size:12px">' + medioTexto + '</td>'
        + '<td><strong>' + fmt(b.monto) + '</strong></td>'
        + '<td>' + (b.tipo==='contado' ? '<span class="badge contado">Pagada</span>' : (b.pagadaCte ? '<span class="badge pagada-cte">Pagada</span>' : '<span class="badge cte">Pendiente</span>')) + '</td>'
        + '<td style="font-size:11px;color:var(--text3)">' + (b.fechaCte ? fmtF(b.fechaCte) : '—') + '</td>'
        + '<td><div class="row-actions">'
        + pagarBtn
        + '<button class="btn-sm" onclick="abrirEditarBoleta(\'' + b.id + '\')">✏</button>'
        + '<button class="icon-btn danger" onclick="eliminarBoleta(\'' + b.id + '\')">✕</button>'
        + '</div></td>'
        + '</tr>';
    }).join('');

    return `<div class="mes-card" style="margin-bottom:.75rem">
      <div class="mes-header" onclick="toggleMes('${uid}','${chid}')">
        <div class="mes-header-left">
          <div class="mes-num" style="background:${sem&&sem.cerrada?'var(--text3)':'var(--accent)'}">${g.semanaNum||'—'}</div>
          <div>
            <div class="mes-titulo">${titulo}</div>
            ${subtitulo?'<div class="mes-subtitulo">'+subtitulo+'</div>':''}
          </div>
        </div>
        <div class="mes-header-right">
          <div style="text-align:right">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px">Total egresado</div>
            <div style="font-size:16px;font-weight:700;color:var(--danger)">${fmt(totGrupo)}</div>
          </div>
          <span class="badge ${sem?(sem.cerrada?'cerrada':'activa'):'cerrada'}">${bOrdenadas.length} boleta${bOrdenadas.length!==1?'s':''}</span>
          <span class="mes-chevron" id="${chid}">▼</span>
        </div>
      </div>
      <div class="mes-body" id="${uid}">
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Cargada</th><th>Fecha boleta</th><th>Concepto</th><th>Empresa</th><th>Categoría</th><th>Tipo</th><th>Medio</th><th>Monto</th><th>Estado</th><th>Vencimiento</th><th></th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');
};

// ── EDITAR BOLETA ──
window.abrirEditarBoleta = function(id){
  const b = boletas.find(x=>x.id===id);
  if(!b) return;
  document.getElementById('edit-boleta-id').value    = id;
  document.getElementById('edit-boleta-prov').value  = b.proveedor||'';
  document.getElementById('edit-boleta-monto').value = b.monto||0;
  document.getElementById('edit-boleta-fecha').value = b.fecha||hoy();
  document.getElementById('edit-boleta-tipo').value  = b.tipo||'contado';
  document.getElementById('edit-boleta-cat').value   = b.categoria||'';
  document.getElementById('edit-boleta-fecha-cte').value = b.fechaCte||'';
  // Poblar select empresa
  const selEmp = document.getElementById('edit-boleta-empresa');
  selEmp.innerHTML = '<option value="">— Seleccionar —</option>' +
    empresas.map(e=>`<option value="${e.nombre}"${b.empresa===e.nombre?' selected':''}>${e.nombre}</option>`).join('');
  // Medio
  const selMed = document.getElementById('edit-boleta-medio');
  selMed.value = b.medio||'Efectivo';
  toggleEditMedio();
  document.getElementById('modal-editar-boleta').classList.add('open');
};

window.cerrarModalEditarBoleta = function(){
  document.getElementById('modal-editar-boleta').classList.remove('open');
};

window.toggleEditMedio = function(){
  const tipo = (document.getElementById('edit-boleta-tipo')||{}).value;
  const esCte = tipo==='cte';
  const fMed = document.getElementById('edit-field-medio');
  const fCte = document.getElementById('edit-field-fecha-cte');
  if(fMed) fMed.style.display = esCte?'none':'block';
  if(fCte) fCte.style.display = esCte?'block':'none';
};

window.guardarEdicionBoleta = async function(){
  const id      = document.getElementById('edit-boleta-id').value;
  const prov    = document.getElementById('edit-boleta-prov').value.trim();
  const empresa = document.getElementById('edit-boleta-empresa').value;
  const cat     = document.getElementById('edit-boleta-cat').value;
  const monto   = parseFloat(document.getElementById('edit-boleta-monto').value)||0;
  const fecha   = document.getElementById('edit-boleta-fecha').value||hoy();
  const tipo    = document.getElementById('edit-boleta-tipo').value;
  const medio   = tipo==='contado'?document.getElementById('edit-boleta-medio').value:null;
  const fechaCte= tipo==='cte'?document.getElementById('edit-boleta-fecha-cte').value:null;
  if(!prov)  { alert('Ingresá el concepto'); return; }
  if(!empresa){ alert('Seleccioná una empresa'); return; }
  if(!monto)  { alert('Ingresá un monto válido'); return; }
  if(tipo==='cte'&&!fechaCte){ alert('Ingresá la fecha de vencimiento'); return; }
  await updateDoc(doc(db,'boletas',id),{
    proveedor:prov, empresa, categoria:cat,
    monto, fecha, tipo, medio:medio||null,
    fechaCte:fechaCte||null
  });
  cerrarModalEditarBoleta();
};


// ── EMPRESAS ──
window.agregarEmpresa = async function(){
  const nombre = document.getElementById('inp-empresa-nueva').value.trim();
  if(!nombre){ alert('Ingresá el nombre de la empresa'); return; }
  if(empresas.find(e=>e.nombre.toLowerCase()===nombre.toLowerCase())){ alert('Esa empresa ya existe'); return; }
  await addDoc(collection(db,'empresas'),{nombre});
  document.getElementById('inp-empresa-nueva').value='';
};
window.eliminarEmpresa = async function(id){
  if(!confirm('¿Eliminar esta empresa?')) return;
  await deleteDoc(doc(db,'empresas',id));
};

// ── RENDER PRINCIPAL ──
function render(){
  const h   = hoy();
  const sem = semanaActiva();

  // ── DIARIO ──
  document.getElementById('semana-info-badge').textContent =
    sem ? `Semana ${sem.num} — desde ${fmtF(sem.inicio)}` : 'Sin semana activa';

  const alertDiario = document.getElementById('alert-semana-diario');
  if(!sem){
    alertDiario.innerHTML='<div class="alert info">ℹ Sin semana activa. Podés cargar boletas igual; se asignarán cuando inicies una semana.</div>';
  } else {
    alertDiario.innerHTML='';
  }

  // Boletas de la semana actual (o todas si no hay semana)
  const bSem = sem ? boletas.filter(b=>b.semanaId===sem.id) : boletas.filter(b=>b.fecha===h);
  const gastadoContado = bSem.filter(b=>b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
  const ctePendMonto = boletas.filter(b=>b.tipo==='cte'&&!b.pagadaCte).reduce((a,b)=>a+b.monto,0);

  // Totales por medio de pago (boletas contado de la semana)
  const boletasContadoSem = bSem.filter(b=>b.tipo==='contado');
  const totEfectivo = boletasContadoSem.filter(b=>b.medio==='Efectivo').reduce((a,b)=>a+b.monto,0);
  const totTransf   = boletasContadoSem.filter(b=>b.medio==='Transferencia').reduce((a,b)=>a+b.monto,0);
  const totTarjeta  = boletasContadoSem.filter(b=>b.medio==='Tarjeta').reduce((a,b)=>a+b.monto,0);
  // Cta cte pagada esta semana por medio
  const ctePagSemEf = sem?boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===sem.id&&b.medioPagoCte==='Efectivo').reduce((a,b)=>a+b.monto,0):0;
  const ctePagSemTr = sem?boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===sem.id&&b.medioPagoCte==='Transferencia').reduce((a,b)=>a+b.monto,0):0;
  const ctePagSemTj = sem?boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===sem.id&&b.medioPagoCte==='Tarjeta').reduce((a,b)=>a+b.monto,0):0;
  // Ingresos de la semana (cajas de la semana)
  const ingresosSemana = cajas.filter(cj=>cj.semanaId===sem?.id).reduce((a,cj)=>a+(cj.total||0),0);
  // const ingresosHoy = cajas.reduce((a,cj)=>a+(cj.total||0),0);
  document.getElementById('m-gastado-sem').textContent  = fmt(gastadoContado);
  document.getElementById('m-tot-efectivo').textContent = fmt(totEfectivo+ctePagSemEf);
  document.getElementById('m-tot-transf').textContent   = fmt(totTransf+ctePagSemTr);
  document.getElementById('m-tot-tarjeta').textContent  = fmt(totTarjeta+ctePagSemTj);
  document.getElementById('m-cte-pend-sem').textContent = fmt(ctePendMonto);
  document.getElementById('m-tot-ingresos').textContent = fmt(ingresosSemana);

    // Tabla: boletas de la semana actual + cta cte pendientes de semanas anteriores
    const ctePendAnteriores = boletas.filter(b=>b.tipo==='cte'&&!b.pagadaCte&&(!sem || b.semanaId!==sem.id));
    const todasVisibles = [...bSem, ...ctePendAnteriores]
      .sort((a,b)=>((b.fechaHora||b.fecha)>(a.fechaHora||a.fecha)?1:-1));

    document.getElementById('count-hoy').textContent=
      bSem.length+' boleta'+(bSem.length!==1?'s':'')+
      (ctePendAnteriores.length>0?` + ${ctePendAnteriores.length} cta. cte. pendiente${ctePendAnteriores.length!==1?'s':''} de semanas anteriores`:'');

    const tbB=document.getElementById('tbl-boletas');
    if(!todasVisibles.length) tbB.innerHTML='<tr class="empty-row"><td colspan="10">Sin boletas esta semana</td></tr>';
    else tbB.innerHTML=todasVisibles.map(b=>{
      const esPendAnterior = b.tipo==='cte'&&!b.pagadaCte&&(!sem || b.semanaId!==sem.id);
      const medioTexto = b.tipo==='cte'
        ? (b.pagadaCte?(b.medioPagoCte==='Transferencia'?'🏦 Transf.':'💵 Efectivo'):'—')
        : (b.medio==='Transferencia'?'🏦 Transf.':'💵 Efectivo');
      return `<tr style="${esPendAnterior?'background:var(--warning-bg)':''}">
        <td style="font-size:12px;color:var(--text3);white-space:nowrap">${fmtFH(b.fechaHora)}</td>
        <td><strong>${b.proveedor}</strong>${esPendAnterior?` <span class="badge vencida" style="font-size:9px">Sem.${b.semanaNum||'?'}</span>`:''}</td>
        <td>${b.empresa||'—'}</td>
        <td>${b.categoria||'—'}</td>
        <td><span class="badge ${b.tipo}">${b.tipo==='contado'?'Contado':'Cta. Cte.'}</span></td>
        <td style="font-size:12px">${medioTexto}</td>
        <td><strong>${fmt(b.monto)}</strong></td>
        <td>${b.tipo==='contado'?'<span class="badge contado">Pagada</span>':b.pagadaCte?'<span class="badge pagada-cte">Pagada</span>':'<span class="badge cte">Pendiente</span>'}</td>
        <td style="font-size:11px;color:var(--text3)">${esPendAnterior?'Vence: '+fmtF(b.fechaCte):''}</td>
        <td><div class="row-actions">
          ${b.tipo==='cte'&&!b.pagadaCte?`<button class="btn-sm success" onclick="abrirModalPago('${b.id}')">✓ Pagar</button>`:''}
          <button class="btn-sm" onclick="abrirEditarBoleta('${b.id}')">✏</button>
          <button class="icon-btn danger" onclick="eliminarBoleta('${b.id}')">✕</button>
        </div></td>
      </tr>`;
    }).join('');
  
  
  // ── SEMANAL ──
  document.getElementById('m-cant-semanas').textContent=semanas.length;
  // Métricas de semana activa
  if(sem){
    const contSemAct = boletas.filter(b=>b.semanaId===sem.id&&b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
    const ctePagSemAct = boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===sem.id).reduce((a,b)=>a+b.monto,0);
    const ingSemAct = cajas.filter(cj=>cj.fecha>=sem.inicio&&cj.fecha<=(sem.fin||hoy())).reduce((a,cj)=>a+(cj.total||0),0);
    document.getElementById('m-sem-eg').textContent       = fmt(contSemAct+ctePagSemAct);
    document.getElementById('m-sem-ingresos').textContent = fmt(ingSemAct);
    document.getElementById('m-sem-cte-pag').textContent  = fmt(ctePagSemAct);
    document.getElementById('sem-activa-info').textContent= `Semana ${sem.num} activa desde ${fmtF(sem.inicio)}`;
  } else {
    ['m-sem-eg','m-sem-ingresos','m-sem-cte-pag'].forEach(id=>document.getElementById(id).textContent='$0');
    document.getElementById('sem-activa-info').textContent='Sin semana activa';
  }

  // Acordeón por semana
  const listaSemanas = document.getElementById('lista-semanas');
  if(!semanas.length){
    listaSemanas.innerHTML='<div style="text-align:center;color:var(--text3);padding:2rem;font-size:13px;font-style:italic">Sin semanas registradas. Usá el botón "Nueva semana" para iniciar.</div>';
  } else {
    listaSemanas.innerHTML=[...semanas].reverse().map(s=>{
      const cont    = boletas.filter(b=>b.semanaId===s.id&&b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
      const ctePag  = boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===s.id).reduce((a,b)=>a+b.monto,0);
      const egTotal = cont+ctePag;
      const ingSem  = cajas.filter(cj=>cj.fecha>=s.inicio&&cj.fecha<=(s.fin||hoy())).reduce((a,cj)=>a+(cj.total||0),0);
      const balance = ingSem - egTotal;
      const balColor = balance>=0?'var(--success)':'var(--danger)';

      // Por medio de pago
      const efec  = boletas.filter(b=>b.semanaId===s.id&&b.tipo==='contado'&&b.medio==='Efectivo').reduce((a,b)=>a+b.monto,0)
                  + boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===s.id&&b.medioPagoCte==='Efectivo').reduce((a,b)=>a+b.monto,0);
      const transf= boletas.filter(b=>b.semanaId===s.id&&b.tipo==='contado'&&b.medio==='Transferencia').reduce((a,b)=>a+b.monto,0)
                  + boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===s.id&&b.medioPagoCte==='Transferencia').reduce((a,b)=>a+b.monto,0);
      const tarj  = boletas.filter(b=>b.semanaId===s.id&&b.tipo==='contado'&&b.medio==='Tarjeta').reduce((a,b)=>a+b.monto,0)
                  + boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===s.id&&b.medioPagoCte==='Tarjeta').reduce((a,b)=>a+b.monto,0);

      const uid = 'sem-body-'+s.id;
      const chid = 'sem-chev-'+s.id;
      return `<div class="mes-card">
        <div class="mes-header" onclick="toggleMes('${uid}','${chid}')">
          <div class="mes-header-left">
            <div class="mes-num" style="background:${s.cerrada?'var(--text3)':'var(--accent)'}">${s.num}</div>
            <div>
              <div class="mes-titulo">Semana ${s.num}</div>
              <div class="mes-subtitulo">${fmtF(s.inicio)} → ${s.fin?fmtF(s.fin):'En curso'}</div>
            </div>
          </div>
          <div class="mes-header-right">
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px">Balance</div>
              <div style="font-size:16px;font-weight:700;color:${balColor}">${balance>=0?'+':''}${fmt(balance)}</div>
            </div>
            <span class="badge ${s.cerrada?'cerrada':'activa'}">${s.cerrada?'Cerrada':'Activa'}</span>
            <span class="mes-chevron" id="${chid}">▼</span>
          </div>
        </div>
        <div class="mes-body" id="${uid}">
          <div class="mes-semanas" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
            <div class="mes-sem-card">
              <div class="mes-sem-titulo">📥 Ingresos</div>
              <div class="mes-sem-fila"><span>Total cajas</span><strong style="color:var(--success)">${fmt(ingSem)}</strong></div>
            </div>
            <div class="mes-sem-card">
              <div class="mes-sem-titulo">📤 Egresos</div>
              <div class="mes-sem-fila"><span>Contado</span><span>${fmt(cont)}</span></div>
              <div class="mes-sem-fila"><span>Cta. Cte. pag.</span><span>${fmt(ctePag)}</span></div>
              <div class="mes-sem-fila" style="border-top:1px solid var(--border);margin-top:3px;padding-top:3px"><span>Total</span><strong style="color:var(--danger)">${fmt(egTotal)}</strong></div>
            </div>
            <div class="mes-sem-card">
              <div class="mes-sem-titulo">💳 Por medio</div>
              <div class="mes-sem-fila"><span>💵 Efectivo</span><span>${fmt(efec)}</span></div>
              <div class="mes-sem-fila"><span>🏦 Transf.</span><span>${fmt(transf)}</span></div>
              <div class="mes-sem-fila"><span>💳 Tarjeta</span><span>${fmt(tarj)}</span></div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── MENSUAL ──
  const mesActivo = meses.find(m=>!m.cerrado);
  document.getElementById('m-cant-meses').textContent=meses.length;
  if(mesActivo){
    const fin0 = mesActivo.fin||hoy();
    const eg0  = boletas.filter(b=>b.tipo==='contado'&&b.fecha>=mesActivo.inicio&&b.fecha<=fin0).reduce((a,b)=>a+b.monto,0)
               + boletas.filter(b=>b.tipo==='cte'&&b.pagadaCte&&b.fechaPagoCte>=mesActivo.inicio&&b.fechaPagoCte<=fin0).reduce((a,b)=>a+b.monto,0);
    const ing0 = cajas.filter(cj=>cj.fecha>=mesActivo.inicio&&cj.fecha<=fin0).reduce((a,cj)=>a+(cj.total||0),0);
    const bal0 = ing0-eg0;
    document.getElementById('m-mes-eg').textContent      = fmt(eg0);
    document.getElementById('m-mes-ingresos').textContent= fmt(ing0);
    const balEl = document.getElementById('m-mes-balance');
    balEl.textContent = (bal0>=0?'+':'')+fmt(bal0);
    balEl.className   = 'metric-value '+(bal0>=0?'green':'red');
  } else {
    document.getElementById('m-mes-eg').textContent='$0';
    document.getElementById('m-mes-ingresos').textContent='$0';
    document.getElementById('m-mes-balance').textContent='$0';
    document.getElementById('m-mes-balance').className='metric-value';
  }

  // Acordeón de meses
  const listaMeses = document.getElementById('lista-meses');
  if(!meses.length){
    listaMeses.innerHTML='<div style="text-align:center;color:var(--text3);padding:2rem;font-size:13px;font-style:italic">Sin meses registrados. Iniciá el primer mes con el botón de arriba.</div>';
  } else {
    listaMeses.innerHTML=[...meses].reverse().map((m,idx)=>{
      const mesNum = meses.indexOf(m)+1;
      const fin = m.fin||hoy();
      const bMes = boletas.filter(b=>b.tipo==='contado'&&b.fecha>=m.inicio&&b.fecha<=fin);
      const cteMes = boletas.filter(b=>b.tipo==='cte'&&b.pagadaCte&&b.fechaPagoCte>=m.inicio&&b.fechaPagoCte<=fin);
      const cont   = bMes.reduce((a,b)=>a+b.monto,0);
      const ctePag = cteMes.reduce((a,b)=>a+b.monto,0);
      const total  = cont+ctePag;
      // Ingresos del mes (cajas)
      const ingresosMes = cajas.filter(cj=>cj.fecha>=m.inicio&&cj.fecha<=fin).reduce((a,cj)=>a+(cj.total||0),0);
      const balanceMes  = ingresosMes - total;

      // Semanas del mes
      const semMes = semanas.filter(s=>s.inicio>=m.inicio&&s.inicio<=fin);

      // Por categoría
      const cats = {};
      [...bMes,...cteMes].forEach(b=>{
        const k = b.categoria||'Sin categoría';
        if(!cats[k]) cats[k]={cont:0,cte:0,total:0};
        if(b.tipo==='contado') cats[k].cont+=b.monto;
        else cats[k].cte+=b.monto;
        cats[k].total+=b.monto;
      });

      // Por empresa
      const emps = {};
      [...bMes,...cteMes].forEach(b=>{
        const k = b.empresa||'Sin empresa';
        if(!emps[k]) emps[k]={cont:0,cte:0,total:0};
        if(b.tipo==='contado') emps[k].cont+=b.monto;
        else emps[k].cte+=b.monto;
        emps[k].total+=b.monto;
      });

      const semCardsHTML = semMes.length ? semMes.map(s=>{
        const recSem = recargas.filter(r=>r.semanaId===s.id).reduce((a,r)=>a+r.monto,0);
        const fondoR = s.fondo+recSem;
        const contSem = boletas.filter(b=>b.semanaId===s.id&&b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
        const cteSem = boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===s.id).reduce((a,b)=>a+b.monto,0);
        return `<div class="mes-sem-card">
          <div class="mes-sem-titulo">Semana ${s.num} ${!s.cerrada?'<span class="badge activa" style="font-size:9px">Activa</span>':''}</div>
          <div class="mes-sem-fila"><span>${fmtF(s.inicio)} → ${s.fin?fmtF(s.fin):'hoy'}</span></div>
          <div class="mes-sem-fila"><span>Fondo</span><strong>${fmt(fondoR)}</strong></div>
          <div class="mes-sem-fila"><span>Contado</span><span style="color:var(--danger)">${fmt(contSem)}</span></div>
          <div class="mes-sem-fila"><span>Cta. Cte. pagada</span><span style="color:var(--warning)">${fmt(cteSem)}</span></div>
          <div class="mes-sem-fila" style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span>Saldo</span><strong style="color:${fondoR-(contSem+cteSem)<0?'var(--danger)':'var(--success)'}">${fmt(fondoR-contSem-cteSem)}</strong></div>
        </div>`;
      }).join('') : '<p style="font-size:12px;color:var(--text3)">Sin semanas en este mes.</p>';

      const catRows = Object.entries(cats).sort((a,b)=>b[1].total-a[1].total)
        .map(([k,v])=>`<div class="mes-sem-fila"><span>${k}</span><strong>${fmt(v.total)}</strong></div>`).join('');
      const empRows = Object.entries(emps).sort((a,b)=>b[1].total-a[1].total)
        .map(([k,v])=>`<div class="mes-sem-fila"><span>${k}</span><strong>${fmt(v.total)}</strong></div>`).join('');

      return `<div class="mes-card">
        <div class="mes-header" onclick="toggleMes('mes-body-${mesNum}','chevron-${mesNum}')">
          <div class="mes-header-left">
            <div class="mes-num">${mesNum}</div>
            <div>
              <div class="mes-titulo">${m.mes}</div>
              <div class="mes-subtitulo">${fmtF(m.inicio)} → ${m.fin?fmtF(m.fin):'En curso'} &nbsp;·&nbsp; ${semMes.length} semana${semMes.length!==1?'s':''}</div>
            </div>
          </div>
          <div class="mes-header-right">
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px">Balance</div>
              <div style="font-size:16px;font-weight:700;color:${balanceMes>=0?'var(--success)':'var(--danger)'}">${balanceMes>=0?'+':''}${fmt(balanceMes)}</div>
            </div>
            <span class="badge ${m.cerrado?'cerrada':'activa'}">${m.cerrado?'Cerrado':'Activo'}</span>
            <span class="mes-chevron" id="chevron-${mesNum}">▼</span>
          </div>
        </div>
        <div class="mes-body" id="mes-body-${mesNum}">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:.85rem">
            <div class="mes-sem-card">
              <div class="mes-sem-titulo">📥 Ingresos</div>
              <div class="mes-sem-fila"><span>Total cajas</span><strong style="color:var(--success)">${fmt(ingresosMes)}</strong></div>
            </div>
            <div class="mes-sem-card">
              <div class="mes-sem-titulo">📤 Egresos</div>
              <div class="mes-sem-fila"><span>Contado</span><span>${fmt(cont)}</span></div>
              <div class="mes-sem-fila"><span>Cta. Cte.</span><span>${fmt(ctePag)}</span></div>
              <div class="mes-sem-fila" style="border-top:1px solid var(--border);margin-top:3px;padding-top:3px"><span>Total</span><strong style="color:var(--danger)">${fmt(total)}</strong></div>
            </div>
            <div class="mes-sem-card">
              <div class="mes-sem-titulo">⚖️ Balance</div>
              <div class="mes-sem-fila"><span style="font-weight:600;color:${balanceMes>=0?'var(--success)':'var(--danger)'}">${balanceMes>=0?'✓ Positivo':'✗ Negativo'}</span><strong style="color:${balanceMes>=0?'var(--success)':'var(--danger)'}">${balanceMes>=0?'+':''}${fmt(balanceMes)}</strong></div>
            </div>
          </div>
          <div class="mes-semanas">${semCardsHTML}</div>
          <button class="ver-mas-btn" onclick="toggleDetalle('detalle-${mesNum}',this)">▶ Ver detalle por categoría y empresa</button>
          <div class="detalle-mes" id="detalle-${mesNum}">
            <div class="detalle-grid">
              <div>
                <div class="detalle-subtitulo">Por categoría</div>
                ${catRows||'<div style="font-size:12px;color:var(--text3)">Sin datos</div>'}
              </div>
              <div>
                <div class="detalle-subtitulo">Por empresa</div>
                ${empRows||'<div style="font-size:12px;color:var(--text3)">Sin datos</div>'}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── HISTORIAL ──
  renderHistorial();

  // ── CTA CTE ──
  const ctes     = boletas.filter(b=>b.tipo==='cte');
  const ctePend  = ctes.filter(b=>!b.pagadaCte);
  const cteVenc  = ctePend.filter(b=>b.fechaCte&&b.fechaCte<h);
  const ctePagArr= ctes.filter(b=>b.pagadaCte);
  document.getElementById('m-cte-n').textContent  =ctePend.length;
  document.getElementById('m-cte-tot').textContent=fmt(ctePend.reduce((a,b)=>a+b.monto,0));
  document.getElementById('m-cte-venc').textContent=cteVenc.length;
  document.getElementById('m-cte-pag').textContent=fmt(ctePagArr.reduce((a,b)=>a+b.monto,0));
  const tbC=document.getElementById('tbl-cte');
  if(!ctes.length) tbC.innerHTML='<tr class="empty-row"><td colspan="11">Sin boletas en cuenta corriente</td></tr>';
  else tbC.innerHTML=[...ctes].sort((a,b)=>(a.pagadaCte?1:-1)||(a.fechaCte>b.fechaCte?1:-1)).map(b=>{
    const venc = b.fechaCte&&!b.pagadaCte&&b.fechaCte<h;
    return `<tr style="${venc?'background:var(--danger-bg)':''}">
      <td style="font-size:12px;color:var(--text3);white-space:nowrap">${fmtFH(b.fechaHora)}</td>
      <td><strong>${b.proveedor}</strong></td>
      <td>${b.empresa||'—'}</td>
      <td>${b.categoria||'—'}</td>
      <td><strong>${fmt(b.monto)}</strong></td>
      <td>${fmtF(b.fechaCte)}${venc?' <span class="badge vencida">VENCIDA</span>':''}</td>
      <td>${b.pagadaCte?'<span class="badge pagada-cte">Pagada</span>':'<span class="badge cte">Pendiente</span>'}</td>
      <td>${fmtF(b.fechaPagoCte)}</td>
      <td style="font-size:12px">${b.medioPagoCte?(b.medioPagoCte==='Transferencia'?'🏦 Transf.':'💵 Efectivo'):'—'}</td>
      <td style="font-size:12px">${b.semanaNumPago?'Sem. '+b.semanaNumPago:'—'}</td>
      <td><div class="row-actions">
        ${!b.pagadaCte?`<button class="btn-sm success" onclick="abrirModalPago('${b.id}')">✓ Pagar</button>`:''}
        <button class="icon-btn danger" onclick="eliminarBoleta('${b.id}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderEmpresas(){
  const sel=document.getElementById('inp-empresa');
  const prev=sel.value;
  sel.innerHTML='<option value="">— Seleccionar empresa —</option>'+
    empresas.map(e=>`<option value="${e.nombre}">${e.nombre}</option>`).join('');
  if(prev) sel.value=prev;

  const lista=document.getElementById('lista-empresas');
  if(!empresas.length) lista.innerHTML='<span style="color:var(--text3);font-size:13px">Sin empresas. Agregá la primera arriba.</span>';
  else lista.innerHTML=empresas.map(e=>`
    <div class="empresa-tag">${e.nombre}<button onclick="eliminarEmpresa('${e.id}')" title="Eliminar">×</button></div>`).join('');

  const tbRE=document.getElementById('tbl-resumen-empresas');
  if(!empresas.length){ tbRE.innerHTML='<tr class="empty-row"><td colspan="5">Sin empresas</td></tr>'; return; }
  const rows=empresas.map(e=>{
    const bs  =boletas.filter(b=>b.empresa===e.nombre);
    const cont=bs.filter(b=>b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
    const cte =bs.filter(b=>b.tipo==='cte').reduce((a,b)=>a+b.monto,0);
    return {nombre:e.nombre,n:bs.length,cont,cte,total:cont+cte};
  }).sort((a,b)=>b.total-a.total);
  tbRE.innerHTML=rows.map(r=>`<tr>
    <td><strong>${r.nombre}</strong></td><td>${r.n}</td>
    <td>${fmt(r.cont)}</td><td>${fmt(r.cte)}</td><td><strong>${fmt(r.total)}</strong></td>
  </tr>`).join('');
}

// ── EXPORTAR EXCEL ──
window.exportarExcel = function(){
  if(!boletas.length){ alert('No hay boletas para exportar'); return; }
  const wb=XLSX.utils.book_new();

  // Hoja 1: Detalle
  const det=[['Fecha','Hora','Semana carga','Concepto','Empresa','Categoría','Tipo','Medio pago','Monto','Estado','Vencimiento','Fecha pago','Medio pago cte.','Semana pago']];
  [...boletas].sort((a,b)=>(a.fechaHora||a.fecha)>(b.fechaHora||b.fecha)?1:-1).forEach(b=>{
    const hora=b.fechaHora?new Date(b.fechaHora).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
    det.push([
      b.fecha, hora, b.semanaNum?'Sem. '+b.semanaNum:'',
      b.proveedor, b.empresa||'', b.categoria||'',
      b.tipo==='contado'?'Contado':'Cuenta Corriente',
      b.tipo==='contado'?(b.medio||''):'—',
      b.monto,
      b.tipo==='contado'?'Pagada':b.pagadaCte?'Pagada':'Pendiente',
      b.fechaCte||'', b.fechaPagoCte||'', b.medioPagoCte||'',
      b.semanaNumPago?'Sem. '+b.semanaNumPago:''
    ]);
  });
  const ws1=XLSX.utils.aoa_to_sheet(det);
  ws1['!cols']=[{wch:12},{wch:7},{wch:13},{wch:28},{wch:22},{wch:14},{wch:18},{wch:14},{wch:12},{wch:12},{wch:14},{wch:14},{wch:16},{wch:13}];
  XLSX.utils.book_append_sheet(wb,ws1,'Detalle');

  // Hoja 2: Por semana
  const sem2=[['Semana','Inicio','Cierre','Fondo','Contado','Cta. Cte. pagada','Total egresado','Saldo']];
  semanas.forEach(s=>{
    const cont  =boletas.filter(b=>b.semanaId===s.id&&b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
    const ctePag=boletas.filter(b=>b.tipo==='cte'&&b.semanaIdPago===s.id).reduce((a,b)=>a+b.monto,0);
    const total=cont+ctePag;
    sem2.push(['Sem. '+s.num, s.inicio, s.fin||'Activa', s.fondo, cont, ctePag, total, s.fondo-total]);
  });
  const ws2=XLSX.utils.aoa_to_sheet(sem2);
  ws2['!cols']=[{wch:8},{wch:12},{wch:12},{wch:12},{wch:14},{wch:18},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws2,'Por semana');

  // Hoja 3: Por empresa
  const emp3=[['Empresa','Boletas','Total contado','Total cta. cte.','Total general']];
  const totC=boletas.filter(b=>b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
  const totCTE=boletas.filter(b=>b.tipo==='cte').reduce((a,b)=>a+b.monto,0);
  empresas.forEach(e=>{
    const bs=boletas.filter(b=>b.empresa===e.nombre);
    const c=bs.filter(b=>b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
    const ct=bs.filter(b=>b.tipo==='cte').reduce((a,b)=>a+b.monto,0);
    emp3.push([e.nombre,bs.length,c,ct,c+ct]);
  });
  emp3.push(['TOTAL',boletas.length,totC,totCTE,totC+totCTE]);
  const ws3=XLSX.utils.aoa_to_sheet(emp3);
  ws3['!cols']=[{wch:28},{wch:10},{wch:16},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws3,'Por empresa');

  // Hoja 4: Por categoría
  const cats=[...new Set(boletas.map(b=>b.categoria||'Sin categoría'))];
  const cat4=[['Categoría','Boletas','Total contado','Total cta. cte.','Total']];
  cats.forEach(c=>{
    const bs=boletas.filter(b=>(b.categoria||'Sin categoría')===c);
    const co=bs.filter(b=>b.tipo==='contado').reduce((a,b)=>a+b.monto,0);
    const ct=bs.filter(b=>b.tipo==='cte').reduce((a,b)=>a+b.monto,0);
    cat4.push([c,bs.length,co,ct,co+ct]);
  });
  const ws4=XLSX.utils.aoa_to_sheet(cat4);
  ws4['!cols']=[{wch:20},{wch:10},{wch:16},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws4,'Por categoría');

  // Hoja 5: Cajas
  const caj5=[['Fecha','Cajera','Hora inicio','Hora cierre','Efectivo','PY Débito','PY Efectivo','Mercado Pago','Tarjeta','Total','Diferencia tipo','Diferencia $','Comentario']];
  [...cajas].sort((a,b)=>a.fecha>b.fecha?1:-1).forEach(cj=>{
    caj5.push([
      cj.fecha, cj.cajera, cj.horaInicio||'', cj.horaCierre||'',
      cj.efectivo||0, cj.pyDebito||0, cj.pyEfectivo||0, cj.mercadoPago||0,
      cj.tarjeta||0, cj.total||0, cj.difTipo||'ninguna', cj.diferencia||0, cj.comentario||''
    ]);
  });
  const ws5=XLSX.utils.aoa_to_sheet(caj5);
  ws5['!cols']=[{wch:12},{wch:18},{wch:11},{wch:11},{wch:12},{wch:12},{wch:14},{wch:14},{wch:12},{wch:12},{wch:15},{wch:13},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws5,'Cajas');

  const fecha=new Date().toLocaleDateString('es-AR').replace(/\//g,'-');
  XLSX.writeFile(wb,`boletas_${fecha}.xlsx`);
};
window.toggleMes = function(bodyId, chevronId){
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevronId);
  if(!body) return;
  body.classList.toggle('open');
  if(chev) chev.classList.toggle('open');
};

window.toggleDetalle = function(detalleId, btn){
  const det = document.getElementById(detalleId);
  if(!det) return;
  det.classList.toggle('open');
  btn.textContent = det.classList.contains('open')
    ? '▼ Ocultar detalle'
    : '▶ Ver detalle por categoría y empresa';
};