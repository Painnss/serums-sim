/* SERUMS Sim – banco y simulacros (sin servidor, sin cuentas).
   Datos: window.BANCO (preguntas.js, generado por scripts/correr_fase1.sh).
   Progreso: localStorage del navegador. */
(function () {
  "use strict";

  const BANCO = window.BANCO || [];
  const POR_ID = Object.fromEntries(BANCO.map(p => [p.id, p]));
  const BLOQUES = ["Salud pública", "Cuidado integral de salud", "Ética e interculturalidad",
                   "Investigación", "Gestión de servicios de salud"];
  const COLOR_BLOQUE = Object.fromEntries(BLOQUES.map((b, i) => [b, `var(--b${i + 1})`]));
  const PROCESOS = [...new Set(BANCO.map(p => p.proceso))].sort(ordenProceso);
  const CLAVE_LS = "serums-sim-v1";
  const POR_PAGINA = 20;
  const app = document.getElementById("app");

  /* ---------- utilidades ---------- */
  function ordenProceso(a, b) {
    const [ya, sa] = a.split("-"), [yb, sb] = b.split("-");
    return ya - yb || sa.length - sb.length;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function barajar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function pct(a, b) { return b ? Math.round((100 * a) / b) : 0; }
  function sinTildes(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function fmtTiempo(seg) {
    seg = Math.max(0, Math.round(seg));
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
  }
  function fecha(ts) { return new Date(ts).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }); }

  /* ---------- almacenamiento ---------- */
  let estado = cargar();
  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE_LS));
      if (d && d.resp) return d;
    } catch (e) { /* sin almacenamiento: se trabaja en memoria */ }
    return { resp: {}, sims: [], simEnCurso: null };
  }
  function guardar() {
    try { localStorage.setItem(CLAVE_LS, JSON.stringify(estado)); } catch (e) { /* ignorar */ }
  }
  function registrar(id, letra) {
    const p = POR_ID[id];
    const r = estado.resp[id] || { intentos: 0, aciertos: 0 };
    r.intentos++;
    if (letra === p.clave) r.aciertos++;
    r.ultima = letra;
    r.ultimaOk = letra === p.clave;
    r.fecha = Date.now();
    estado.resp[id] = r;
  }

  /* ---------- piezas comunes ---------- */
  function chips(p) {
    const c = [`<span class="chip">${esc(p.proceso)} · N.° ${p.numero}</span>`];
    if (p.bloque) c.push(`<span class="chip bloque" style="background:${COLOR_BLOQUE[p.bloque] || "var(--text-2)"}">${esc(p.bloque)}</span>`);
    if (p.subtema) c.push(`<span class="chip">${esc(p.subtema)}</span>`);
    if (p.clave_sugerida || p.estado === "revisar_norma") c.push(`<span class="chip alerta">Clave en discusión</span>`);
    if (p.estado === "anulada") c.push(`<span class="chip alerta">Anulada</span>`);
    return `<div class="meta">${c.join("")}</div>`;
  }

  function notas(p) {
    let h = "";
    if (p.clave_sugerida) {
      h += `<div class="nota"><b>Clave oficial: ${esc(p.clave)}.</b> Según la norma, la alternativa mejor sustentada sería
        <b>${esc(p.clave_sugerida)}</b>. ${esc(p.sustento || "")}
        ${p.sustento_url ? `<br><a href="${esc(p.sustento_url)}" target="_blank" rel="noopener">Ver norma</a>` : ""}
        <br><small>En el examen cuenta la clave oficial; aquí se califica con ella.</small></div>`;
    } else if (p.estado === "revisar_norma") {
      h += `<div class="nota"><b>Clave en discusión.</b> ${esc(p.observacion || "")}
        ${p.sustento ? `<br>${esc(p.sustento)}` : ""}
        ${p.sustento_url ? `<br><a href="${esc(p.sustento_url)}" target="_blank" rel="noopener">Ver fuente</a>` : ""}
        <br><small>Aquí se califica con la clave oficial.</small></div>`;
    } else if (p.sustento) {
      h += `<div class="nota info"><b>Clave oficial revisada y sostenida.</b> ${esc(p.sustento)}
        ${p.sustento_url ? ` <a href="${esc(p.sustento_url)}" target="_blank" rel="noopener">Ver fuente</a>` : ""}</div>`;
    } else if (p.observacion) {
      h += `<div class="nota"><b>Nota de revisión (no oficial):</b> ${esc(p.observacion)}</div>`;
    }
    if (p.norma_referencia && !p.sustento) {
      h += `<div class="fuente">Norma probable (sugerida por IA, sin verificar): ${esc(p.norma_referencia)}</div>`;
    }
    h += `<div class="fuente">Fuente: <a href="${esc(p.fuente_url)}" target="_blank" rel="noopener">MINSA – gob.pe</a>
      (pregunta ${p.numero}, pág. ${p.pagina_pdf} del PDF)</div>`;
    return h;
  }

  function htmlOpciones(p, { elegida = null, revelar = false, deshabilitar = false, accion = "" } = {}) {
    return `<div class="opciones">${Object.entries(p.opciones).map(([l, t]) => {
      let cls = "opcion";
      if (revelar && l === p.clave) cls += " correcta";
      else if (revelar && l === elegida) cls += " incorrecta";
      else if (!revelar && l === elegida) cls += " elegida";
      return `<button class="${cls}" data-${accion}="${l}" data-id="${p.id}" ${deshabilitar ? "disabled" : ""}>
        <span class="letra">${l}.</span><span>${esc(t)}</span></button>`;
    }).join("")}</div>`;
  }

  /* ---------- INICIO ---------- */
  function vistaInicio() {
    const resp = Object.values(estado.resp);
    const resueltas = resp.length, aciertos = resp.filter(r => r.ultimaOk).length;
    const enCurso = estado.simEnCurso;
    app.innerHTML = `
      <h1>Prepárate para el SERUMS con preguntas oficiales</h1>
      <p class="sub">${BANCO.length} preguntas de Medicina Humana de los exámenes ${PROCESOS.join(", ")},
        con la clave oficial publicada por el MINSA.</p>
      ${enCurso ? `<div class="tarjeta" style="margin-bottom:14px"><b>Tienes un simulacro sin terminar</b>
        (${enCurso.ids.length} preguntas).<div class="acciones"><a class="btn primario" href="#sim">Continuar</a>
        <button class="btn" id="descartar">Descartar</button></div></div>` : ""}
      <div class="rejilla">
        <div class="dato"><b>${BANCO.length}</b><span>preguntas oficiales</span></div>
        <div class="dato"><b>${PROCESOS.length}</b><span>exámenes</span></div>
        <div class="dato"><b>${resueltas}</b><span>resueltas por ti</span></div>
        <div class="dato"><b>${resueltas ? pct(aciertos, resueltas) + "%" : "—"}</b><span>de acierto (último intento)</span></div>
      </div>
      <div class="acciones">
        <a class="btn primario" href="#simulacro">Hacer un simulacro</a>
        <a class="btn" href="#banco">Explorar el banco</a>
        <a class="btn" href="#progreso">Ver mi progreso</a>
      </div>
      <h2>Preguntas por bloque</h2>
      <div class="tarjeta">${tablaBloques(BANCO)}</div>`;
    const d = document.getElementById("descartar");
    if (d) d.onclick = () => { estado.simEnCurso = null; guardar(); vistaInicio(); };
  }

  function tablaBloques(lista) {
    const filas = BLOQUES.map(b => {
      const n = lista.filter(p => p.bloque === b).length;
      return `<tr><td>${esc(b)}</td><td class="num">${n}</td>
        <td style="width:40%"><div class="barrita"><i style="width:${pct(n, lista.length)}%;background:${COLOR_BLOQUE[b]}"></i></div></td>
        <td class="num">${pct(n, lista.length)}%</td></tr>`;
    }).join("");
    return `<table class="tabla"><thead><tr><th>Bloque</th><th class="num">Preguntas</th><th></th><th class="num">%</th></tr></thead><tbody>${filas}</tbody></table>`;
  }

  /* ---------- BANCO ---------- */
  const filtros = { proceso: "", bloque: "", subtema: "", tipo: "", situacion: "", texto: "", pagina: 0 };
  const reveladas = {};

  function filtrar() {
    const q = sinTildes(filtros.texto.trim());
    return BANCO.filter(p => {
      if (filtros.proceso && p.proceso !== filtros.proceso) return false;
      if (filtros.bloque && p.bloque !== filtros.bloque) return false;
      if (filtros.subtema && p.subtema !== filtros.subtema) return false;
      if (filtros.tipo && p.tipo !== filtros.tipo) return false;
      const r = estado.resp[p.id];
      if (filtros.situacion === "nuevas" && r) return false;
      if (filtros.situacion === "falladas" && !(r && !r.ultimaOk)) return false;
      if (filtros.situacion === "discusion" && !(p.clave_sugerida || p.estado === "revisar_norma" || p.observacion)) return false;
      if (q && !sinTildes(p.enunciado + " " + Object.values(p.opciones).join(" ")).includes(q)) return false;
      return true;
    });
  }

  function opcionesSelect(lista, actual, todos) {
    return `<option value="">${todos}</option>` + lista.map(v => `<option ${v === actual ? "selected" : ""}>${esc(v)}</option>`).join("");
  }

  function vistaBanco() {
    const subtemas = [...new Set(BANCO.filter(p => !filtros.bloque || p.bloque === filtros.bloque).map(p => p.subtema).filter(Boolean))].sort();
    app.innerHTML = `
      <h1>Banco de preguntas</h1>
      <p class="sub">Elige una alternativa para ver si acertaste. Todo lo que respondes cuenta para tu progreso.</p>
      <div class="filtros">
        <label>Examen<select id="f-proceso">${opcionesSelect(PROCESOS, filtros.proceso, "Todos")}</select></label>
        <label>Bloque<select id="f-bloque">${opcionesSelect(BLOQUES, filtros.bloque, "Todos")}</select></label>
        <label>Subtema<select id="f-subtema">${opcionesSelect(subtemas, filtros.subtema, "Todos")}</select></label>
        <label>Tipo<select id="f-tipo">
          <option value="">Todos</option>
          <option value="caso_clinico" ${filtros.tipo === "caso_clinico" ? "selected" : ""}>Caso clínico</option>
          <option value="memoria" ${filtros.tipo === "memoria" ? "selected" : ""}>Memoria / concepto</option>
          <option value="calculo" ${filtros.tipo === "calculo" ? "selected" : ""}>Cálculo</option></select></label>
        <label>Mostrar<select id="f-situacion">
          <option value="">Todas</option>
          <option value="nuevas" ${filtros.situacion === "nuevas" ? "selected" : ""}>No respondidas</option>
          <option value="falladas" ${filtros.situacion === "falladas" ? "selected" : ""}>Las que fallé</option>
          <option value="discusion" ${filtros.situacion === "discusion" ? "selected" : ""}>Clave en discusión</option></select></label>
        <label>Buscar<input id="f-texto" type="search" placeholder="palabra clave…" value="${esc(filtros.texto)}"></label>
      </div>
      <div id="lista"></div>`;
    const enlazar = (id, campo) => {
      const el = document.getElementById(id);
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
        filtros[campo] = el.value; filtros.pagina = 0;
        if (campo === "bloque") { filtros.subtema = ""; vistaBanco(); } else pintarLista();
      });
    };
    enlazar("f-proceso", "proceso"); enlazar("f-bloque", "bloque"); enlazar("f-subtema", "subtema");
    enlazar("f-tipo", "tipo"); enlazar("f-situacion", "situacion"); enlazar("f-texto", "texto");
    pintarLista();
  }

  function pintarLista() {
    const lista = filtrar();
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    filtros.pagina = Math.min(filtros.pagina, paginas - 1);
    const trozo = lista.slice(filtros.pagina * POR_PAGINA, (filtros.pagina + 1) * POR_PAGINA);
    const cont = document.getElementById("lista");
    cont.innerHTML = `<div class="conteo">${lista.length} pregunta(s)</div>` +
      (trozo.length ? trozo.map(tarjetaBanco).join("") : `<div class="vacio">No hay preguntas con esos filtros.</div>`) +
      (paginas > 1 ? `<div class="paginacion">
        <button class="btn" id="ant" ${filtros.pagina === 0 ? "disabled" : ""}>← Anterior</button>
        <span>${filtros.pagina + 1} / ${paginas}</span>
        <button class="btn" id="sig" ${filtros.pagina >= paginas - 1 ? "disabled" : ""}>Siguiente →</button></div>` : "");
    enlazarTarjetas();
    const ant = document.getElementById("ant"), sig = document.getElementById("sig");
    if (ant) ant.onclick = () => { filtros.pagina--; pintarLista(); window.scrollTo(0, 0); };
    if (sig) sig.onclick = () => { filtros.pagina++; pintarLista(); window.scrollTo(0, 0); };
  }

  // Respuestas dentro del banco: solo se repinta la tarjeta tocada (no salta la página).
  function enlazarTarjetas() {
    const cont = document.getElementById("lista");
    cont.querySelectorAll("[data-banco]").forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      reveladas[id] = b.dataset.banco;
      registrar(id, b.dataset.banco); guardar();
      document.getElementById("q-" + id).outerHTML = tarjetaBanco(POR_ID[id]);
      enlazarTarjetas();
    });
    cont.querySelectorAll("[data-ver]").forEach(b => b.onclick = () => {
      const id = b.dataset.ver;
      reveladas[id] = "?";
      document.getElementById("q-" + id).outerHTML = tarjetaBanco(POR_ID[id]);
      enlazarTarjetas();
    });
  }

  function tarjetaBanco(p) {
    const elegida = reveladas[p.id];
    const revelar = !!elegida;
    const r = estado.resp[p.id];
    let res = "";
    if (revelar && elegida !== "?") res = elegida === p.clave
      ? `<div class="nota info" style="background:var(--ok-bg);color:var(--ok)"><b>¡Correcto!</b></div>`
      : `<div class="nota info" style="background:var(--mal-bg);color:var(--mal)"><b>Incorrecto.</b> La clave oficial es ${esc(p.clave)}.</div>`;
    return `<article class="pregunta" id="q-${p.id}">
      ${chips(p)}
      <p class="enunciado">${esc(p.enunciado)}</p>
      ${htmlOpciones(p, { elegida, revelar, deshabilitar: revelar, accion: "banco" })}
      ${revelar ? res + notas(p) : `<div class="acciones" style="margin-top:10px">
        <button class="btn" data-ver="${p.id}">Ver respuesta</button>
        ${r ? `<span class="fuente">Antes: ${r.aciertos}/${r.intentos} correctas</span>` : ""}</div>`}
    </article>`;
  }

  /* ---------- SIMULACRO: configuración ---------- */
  function vistaSimulacro() {
    if (estado.simEnCurso) { location.hash = "#sim"; return; }
    const falladas = BANCO.filter(p => estado.resp[p.id] && !estado.resp[p.id].ultimaOk).length;
    app.innerHTML = `
      <h1>Simulacros</h1>
      <p class="sub">Durante el simulacro no verás las respuestas; al terminar tendrás tu nota y la revisión.</p>
      <div class="opciones-sim">
        <div class="tarjeta">
          <h3>Examen completo</h3>
          <p>100 preguntas con cronómetro, como el día del examen.</p>
          <label for="c-proceso">Preguntas</label>
          <select id="c-proceso">
            <option value="mixto">Mixto: 100 al azar respetando el peso de cada bloque</option>
            ${PROCESOS.map(p => `<option value="${p}">Examen oficial ${p} (orden original)</option>`).join("")}
          </select>
          <label for="c-min">Tiempo</label>
          <select id="c-min">
            ${[90, 120, 150, 180].map(m => `<option value="${m}" ${m === 120 ? "selected" : ""}>${m} minutos</option>`).join("")}
          </select>
          <div class="acciones"><button class="btn primario" id="ini-completo">Empezar</button></div>
        </div>
        <div class="tarjeta">
          <h3>Por bloque</h3>
          <p>Practica un tema a la vez. Puedes elegir subtema.</p>
          <label for="c-bloque">Bloque</label>
          <select id="c-bloque">${BLOQUES.map(b => `<option>${esc(b)}</option>`).join("")}</select>
          <label for="c-sub">Subtema</label>
          <select id="c-sub"></select>
          <label for="c-n">Cantidad</label>
          <select id="c-n">${[10, 20, 30, 50].map(n => `<option>${n}</option>`).join("")}</select>
          <label class="check"><input type="checkbox" id="c-reloj" checked> Con cronómetro (72 s por pregunta)</label>
          <div class="acciones"><button class="btn primario" id="ini-bloque">Empezar</button></div>
        </div>
        <div class="tarjeta">
          <h3>Repasar lo que fallé</h3>
          <p>Vuelve a intentar las preguntas cuyo último intento fue incorrecto.</p>
          <p><b>${falladas}</b> pregunta(s) pendientes.</p>
          <div class="acciones"><button class="btn primario" id="ini-falladas" ${falladas ? "" : "disabled"}>Empezar</button></div>
        </div>
      </div>`;
    const selBloque = document.getElementById("c-bloque"), selSub = document.getElementById("c-sub");
    const llenarSub = () => {
      const subs = [...new Set(BANCO.filter(p => p.bloque === selBloque.value).map(p => p.subtema))].sort();
      selSub.innerHTML = `<option value="">Todos los subtemas</option>` +
        subs.map(s => `<option value="${esc(s)}">${esc(s)} (${BANCO.filter(p => p.subtema === s).length})</option>`).join("");
    };
    selBloque.onchange = llenarSub; llenarSub();

    document.getElementById("ini-completo").onclick = () => {
      const v = document.getElementById("c-proceso").value;
      const ids = v === "mixto" ? mixto(100) : BANCO.filter(p => p.proceso === v).sort((a, b) => a.numero - b.numero).map(p => p.id);
      iniciar(ids, +document.getElementById("c-min").value * 60, v === "mixto" ? "Completo mixto" : "Examen " + v);
    };
    document.getElementById("ini-bloque").onclick = () => {
      const pool = BANCO.filter(p => p.bloque === selBloque.value && (!selSub.value || p.subtema === selSub.value));
      const n = Math.min(+document.getElementById("c-n").value, pool.length);
      const ids = barajar(pool).slice(0, n).map(p => p.id);
      iniciar(ids, document.getElementById("c-reloj").checked ? n * 72 : 0, selBloque.value + (selSub.value ? " · " + selSub.value : ""));
    };
    document.getElementById("ini-falladas").onclick = () => {
      const ids = barajar(BANCO.filter(p => estado.resp[p.id] && !estado.resp[p.id].ultimaOk)).slice(0, 50).map(p => p.id);
      iniciar(ids, 0, "Repaso de falladas");
    };
  }

  function mixto(n) {
    const pesos = BLOQUES.map(b => BANCO.filter(p => p.bloque === b).length);
    const total = pesos.reduce((a, b) => a + b, 0);
    let cupos = pesos.map(w => Math.floor((n * w) / total));
    let resto = n - cupos.reduce((a, b) => a + b, 0);
    for (let i = 0; resto > 0; i = (i + 1) % cupos.length, resto--) cupos[i]++;
    return barajar(BLOQUES.flatMap((b, i) => barajar(BANCO.filter(p => p.bloque === b)).slice(0, cupos[i]).map(p => p.id)));
  }

  function iniciar(ids, segundos, titulo) {
    if (!ids.length) return;
    estado.simEnCurso = { ids, resp: {}, marcadas: {}, actual: 0, titulo, limite: segundos,
                          inicio: Date.now(), usado: 0 };
    guardar();
    location.hash = "#sim";
  }

  /* ---------- SIMULACRO: en curso ---------- */
  let tic = null;
  function tiempoRestante(s) {
    const usado = s.usado + (Date.now() - s.inicio) / 1000;
    return s.limite ? s.limite - usado : usado;
  }

  function vistaSim() {
    const s = estado.simEnCurso;
    if (!s) { location.hash = "#simulacro"; return; }
    const p = POR_ID[s.ids[s.actual]];
    const respondidas = Object.keys(s.resp).length;
    app.innerHTML = `
      <div class="barra-sim">
        <div><b>${esc(s.titulo)}</b><br><span class="fuente">Pregunta ${s.actual + 1} de ${s.ids.length} · ${respondidas} respondidas</span></div>
        <div class="reloj" id="reloj"></div>
        <button class="btn primario" id="terminar">Terminar</button>
      </div>
      <article class="pregunta">
        <div class="meta"><span class="chip">Pregunta ${s.actual + 1}</span>
          ${s.marcadas[p.id] ? `<span class="chip alerta">Marcada para revisar</span>` : ""}</div>
        <p class="enunciado">${esc(p.enunciado)}</p>
        ${htmlOpciones(p, { elegida: s.resp[p.id], accion: "sim" })}
        <div class="acciones">
          <button class="btn" id="prev" ${s.actual === 0 ? "disabled" : ""}>← Anterior</button>
          <button class="btn" id="marcar">${s.marcadas[p.id] ? "Desmarcar" : "Marcar para revisar"}</button>
          <button class="btn" id="next" ${s.actual === s.ids.length - 1 ? "disabled" : ""}>Siguiente →</button>
        </div>
      </article>
      <details class="tarjeta"><summary><b>Mapa de preguntas</b></summary>
        <div class="mapa">${s.ids.map((id, i) => `<button data-ir="${i}" class="${s.resp[id] ? "resp" : ""} ${i === s.actual ? "actual" : ""} ${s.marcadas[id] ? "marcada" : ""}">${i + 1}</button>`).join("")}</div>
      </details>`;

    const ir = i => { s.actual = Math.max(0, Math.min(s.ids.length - 1, i)); guardar(); vistaSim(); window.scrollTo(0, 0); };
    app.querySelectorAll("[data-sim]").forEach(b => b.onclick = () => {
      s.resp[b.dataset.id] = b.dataset.sim; guardar();
      app.querySelectorAll("[data-sim]").forEach(x => x.classList.toggle("elegida", x === b));
      const cont = app.querySelector(".fuente"); if (cont) cont.textContent = `Pregunta ${s.actual + 1} de ${s.ids.length} · ${Object.keys(s.resp).length} respondidas`;
      const m = app.querySelector(`[data-ir="${s.actual}"]`); if (m) m.classList.add("resp");
    });
    app.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => ir(+b.dataset.ir));
    document.getElementById("prev").onclick = () => ir(s.actual - 1);
    document.getElementById("next").onclick = () => ir(s.actual + 1);
    document.getElementById("marcar").onclick = () => { s.marcadas[p.id] = !s.marcadas[p.id]; guardar(); vistaSim(); };
    document.getElementById("terminar").onclick = () => {
      const faltan = s.ids.length - Object.keys(s.resp).length;
      if (!faltan || confirm(`Te faltan ${faltan} pregunta(s) sin responder. ¿Terminar de todos modos?`)) finalizar();
    };
    pintarReloj();
    clearInterval(tic);
    tic = setInterval(pintarReloj, 1000);
  }

  function pintarReloj() {
    const s = estado.simEnCurso, el = document.getElementById("reloj");
    if (!s || !el) { clearInterval(tic); return; }
    const t = tiempoRestante(s);
    if (s.limite && t <= 0) { finalizar(); return; }
    el.textContent = (s.limite ? "⏱ " : "") + fmtTiempo(t);
    el.classList.toggle("poco", !!s.limite && t < 300);
  }

  // Al salir de la página se guarda el tiempo usado, para no contarlo como transcurrido.
  window.addEventListener("pagehide", () => {
    const s = estado.simEnCurso;
    if (s) { s.usado += (Date.now() - s.inicio) / 1000; s.inicio = Date.now(); guardar(); }
  });

  function finalizar() {
    clearInterval(tic);
    const s = estado.simEnCurso;
    if (!s) return;
    const porBloque = {};
    let correctas = 0;
    s.ids.forEach(id => {
      const p = POR_ID[id], r = s.resp[id], ok = r === p.clave;
      if (r) registrar(id, r);
      if (ok) correctas++;
      const b = porBloque[p.bloque] || (porBloque[p.bloque] = { n: 0, ok: 0 });
      b.n++; if (ok) b.ok++;
    });
    const usado = s.usado + (Date.now() - s.inicio) / 1000;
    const resultado = { fecha: Date.now(), titulo: s.titulo, n: s.ids.length, correctas, porBloque,
                        segundos: Math.round(usado), ids: s.ids, resp: s.resp };
    estado.sims.unshift(resultado);
    estado.sims = estado.sims.slice(0, 30);
    estado.simEnCurso = null;
    guardar();
    location.hash = "#resultado/0";
  }

  /* ---------- RESULTADO ---------- */
  let soloErrores = true;
  function vistaResultado(i) {
    const r = estado.sims[i];
    if (!r) { location.hash = "#progreso"; return; }
    const lista = r.ids.map(id => POR_ID[id]).filter(Boolean);
    const mostrar = soloErrores ? lista.filter(p => r.resp[p.id] !== p.clave) : lista;
    app.innerHTML = `
      <h1>Resultado</h1>
      <p class="sub">${esc(r.titulo)} · ${fecha(r.fecha)} · ${fmtTiempo(r.segundos)} usados</p>
      <div class="rejilla">
        <div class="dato"><b class="grande">${r.correctas}/${r.n}</b><span>correctas</span></div>
        <div class="dato"><b>${pct(r.correctas, r.n)}%</b><span>de acierto</span></div>
        <div class="dato"><b>${r.n - Object.keys(r.resp).length}</b><span>sin responder</span></div>
      </div>
      <h2>Por bloque</h2>
      <div class="tarjeta">${tablaAcierto(r.porBloque)}</div>
      <h2>Revisión</h2>
      <label class="check"><input type="checkbox" id="solo-err" ${soloErrores ? "checked" : ""}> Mostrar solo errores y sin responder</label>
      <div style="margin-top:12px">${mostrar.map(p => `<article class="pregunta">${chips(p)}
          <p class="enunciado">${esc(p.enunciado)}</p>
          ${htmlOpciones(p, { elegida: r.resp[p.id], revelar: true, deshabilitar: true })}
          ${!r.resp[p.id] ? `<div class="nota info">No respondiste esta pregunta.</div>` : ""}
          ${notas(p)}</article>`).join("") || `<div class="vacio">¡Sin errores!</div>`}</div>
      <div class="acciones"><a class="btn primario" href="#simulacro">Otro simulacro</a><a class="btn" href="#progreso">Mi progreso</a></div>`;
    document.getElementById("solo-err").onchange = e => { soloErrores = e.target.checked; vistaResultado(i); };
  }

  function tablaAcierto(porBloque) {
    const filas = Object.entries(porBloque).sort((a, b) => BLOQUES.indexOf(a[0]) - BLOQUES.indexOf(b[0])).map(([b, v]) => `
      <tr><td>${esc(b)}</td><td class="num">${v.ok}/${v.n}</td>
      <td style="width:40%"><div class="barrita"><i style="width:${pct(v.ok, v.n)}%;background:${COLOR_BLOQUE[b] || "var(--acento)"}"></i></div></td>
      <td class="num">${pct(v.ok, v.n)}%</td></tr>`).join("");
    return `<table class="tabla"><thead><tr><th>Bloque</th><th class="num">Aciertos</th><th></th><th class="num">%</th></tr></thead><tbody>${filas}</tbody></table>`;
  }

  /* ---------- PROGRESO ---------- */
  function vistaProgreso() {
    const porBloque = {}, porSub = {};
    BANCO.forEach(p => {
      const r = estado.resp[p.id]; if (!r) return;
      const b = porBloque[p.bloque] || (porBloque[p.bloque] = { n: 0, ok: 0 });
      b.n++; if (r.ultimaOk) b.ok++;
      const s = porSub[p.subtema] || (porSub[p.subtema] = { n: 0, ok: 0, bloque: p.bloque });
      s.n++; if (r.ultimaOk) s.ok++;
    });
    const resueltas = Object.keys(estado.resp).length;
    const debiles = Object.entries(porSub).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 8);
    app.innerHTML = `
      <h1>Mi progreso</h1>
      <p class="sub">Guardado solo en este navegador. Se cuenta tu último intento de cada pregunta.</p>
      <div class="rejilla">
        <div class="dato"><b>${resueltas}/${BANCO.length}</b><span>preguntas resueltas</span></div>
        <div class="dato"><b>${estado.sims.length}</b><span>simulacros terminados</span></div>
        <div class="dato"><b>${estado.sims[0] ? pct(estado.sims[0].correctas, estado.sims[0].n) + "%" : "—"}</b><span>último simulacro</span></div>
      </div>
      <h2>Acierto por bloque</h2>
      <div class="tarjeta">${resueltas ? tablaAcierto(porBloque) : `<div class="vacio">Aún no respondes preguntas.</div>`}</div>
      <h2>Subtemas para reforzar</h2>
      <div class="tarjeta">${debiles.length ? `<table class="tabla"><thead><tr><th>Subtema</th><th class="num">Aciertos</th><th class="num">%</th></tr></thead><tbody>
        ${debiles.map(([s, v]) => `<tr><td>${esc(s)}<br><span class="fuente">${esc(v.bloque)}</span></td><td class="num">${v.ok}/${v.n}</td><td class="num">${pct(v.ok, v.n)}%</td></tr>`).join("")}
        </tbody></table>` : `<div class="vacio">Responde al menos 3 preguntas de un subtema para verlo aquí.</div>`}</div>
      <h2>Historial de simulacros</h2>
      <div class="tarjeta">${estado.sims.length ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Simulacro</th><th class="num">Nota</th><th></th></tr></thead><tbody>
        ${estado.sims.map((r, i) => `<tr><td>${fecha(r.fecha)}</td><td>${esc(r.titulo)}</td><td class="num">${r.correctas}/${r.n}</td>
        <td class="num"><a href="#resultado/${i}">Ver</a></td></tr>`).join("")}</tbody></table>` : `<div class="vacio">Todavía no terminas ningún simulacro.</div>`}</div>
      <div class="acciones"><button class="btn" id="borrar">Borrar todo mi progreso</button></div>`;
    document.getElementById("borrar").onclick = () => {
      if (confirm("¿Borrar todas tus respuestas y simulacros de este navegador? No se puede deshacer.")) {
        estado = { resp: {}, sims: [], simEnCurso: null }; guardar(); vistaProgreso();
      }
    };
  }

  /* ---------- enrutador ---------- */
  function ruta() {
    clearInterval(tic);
    const [vista, arg] = (location.hash.slice(1) || "inicio").split("/");
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("activo",
      a.dataset.nav === vista || (a.dataset.nav === "simulacro" && (vista === "sim" || vista === "resultado"))));
    if (!BANCO.length) { app.innerHTML = `<div class="vacio">No se encontró preguntas.js.</div>`; return; }
    ({ inicio: vistaInicio, banco: vistaBanco, simulacro: vistaSimulacro, sim: vistaSim,
       resultado: () => vistaResultado(+arg || 0), progreso: vistaProgreso }[vista] || vistaInicio)();
  }
  window.addEventListener("hashchange", ruta);
  ruta();
})();
