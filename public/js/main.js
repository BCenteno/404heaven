/* ================================================================
   404heaven — main.js
   No frameworks. Everything data-driven via CONFIG so the future
   404heaven Studio can manage content without touching the code.
   ================================================================ */

/* ================= CONFIG ================= */
const CONFIG = {
  // welcome screen: "first" = only first visit, "always" = every visit, "never" = off
  welcomeScreen: "first",

  // now playing — la playlist vive en la tabla "songs" de supabase y los
  // mp3 / covers los sirve imagekit. No hay nada que configurar acá.

  // contador de visitas — vive en supabase, arranca en 0.
  //   "unique" = suma una vez por navegador (el número es "sos la visita nº X")
  //   "visits" = suma una vez por sesión (si vuelve mañana, cuenta de nuevo)
  counterMode: "unique",

  // guestbook — supabase project.
  // supabaseUrl es la URL BASE del proyecto (sin /rest/v1/ al final):
  // el código le agrega /rest/v1/guestbook por su cuenta.
  supabaseUrl: "https://pzjlbkrezhahaougowyw.supabase.co",
  supabaseKey: "sb_publishable_Xk3NbMoMvCGKs7TY_40rHg_JCV0MuBW",

  // fotos — url endpoint de imagekit, sin barra final.
  // la url se arma {imagekitUrl}/{image_path}?tr=w-480
  imagekitUrl: "https://ik.imagekit.io/404heaven",
};

/* ================= welcome screen ================= */
(function welcomeScreen() {
  const ws = document.getElementById("welcome-screen");
  if (!ws) return;

  const KEY = "heaven404_entered";
  let show = CONFIG.welcomeScreen === "always";
  if (CONFIG.welcomeScreen === "first") {
    try { show = !localStorage.getItem(KEY); } catch (e) { show = true; }
  }

  if (!show) { ws.remove(); return; }

  ws.hidden = false;
  document.body.style.overflow = "hidden";

  document.getElementById("ws-enter").addEventListener("click", () => {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    ws.classList.add("leaving");
    document.body.style.overflow = "";
    // remove after the fade so it never blocks clicks
    setTimeout(() => ws.remove(), 1200);
  });
})();

/* ================= visitor counter =================
   Cuenta de verdad: el número vive en supabase (tabla "counters", fila
   'visits') y es el mismo para todo el mundo. El SQL que crea la tabla y
   la función está en supabase/sql/counter.sql.

   La suma no se hace con un UPDATE desde el navegador — eso obligaría a
   dar permiso de escritura a cualquiera. Se llama a bump_visits(), una
   función SECURITY DEFINER que solo sabe hacer +1 y devolver el total.

   En pantalla siempre va el TOTAL de la base, no el número que le tocó a
   cada uno: el contador tiene que verse crecer cuando entra otra gente.
   Sumar es otra cosa, y eso sí pasa una sola vez por navegador (o por
   sesión, ver CONFIG.counterMode). O sea: quien recarga cien veces ve el
   número moverse si entró alguien más, pero no lo mueve él. */
(function visitorCounter() {
  const el = document.getElementById("visitor-counter");
  if (!el) return;

  const LAST = "heaven404_visitor_no"; // último total que vio este navegador
  const SEEN = "heaven404_counted";    // este navegador (o sesión) ya sumó

  // en "visits" la marca vive en la sesión, así que quien vuelve mañana
  // cuenta otra vez; en "unique" vive en el disco y cuenta una sola vez
  const perSession = CONFIG.counterMode === "visits";
  const store = perSession ? sessionStorage : localStorage;

  const show = (n) => { el.textContent = String(n).padStart(6, "0"); };
  const get = (s, k) => { try { return s.getItem(k); } catch (e) { return null; } };
  const set = (s, k, v) => { try { s.setItem(k, v); } catch (e) {} };
  const del = (s, k) => { try { s.removeItem(k); } catch (e) {} };

  // el último total conocido, para no mostrar 000000 mientras contesta la red
  const last = parseInt(get(localStorage, LAST), 10);
  if (!isNaN(last)) show(last);

  const base = (CONFIG.supabaseUrl || "").replace(/\/+$/, "");
  const key = CONFIG.supabaseKey || "";
  if (!base || !key) {
    console.warn("[counter] falta supabaseUrl o supabaseKey en CONFIG (js/main.js)");
    return;
  }

  // ¿a esta persona ya la contamos? el !isNaN(last) cubre a los navegadores
  // que ya habían sumado con la versión anterior, que no dejaba esta marca
  const counted = perSession
    ? !!get(sessionStorage, SEEN)
    : !!get(localStorage, SEEN) || !isNaN(last);

  // La marca se pone ANTES de pedir, no cuando contesta: si alguien abre
  // cinco pestañas de golpe, las otras cuatro la encuentran puesta y solo
  // leen. Si el pedido falla se deshace, para poder reintentar más tarde.
  if (!counted) set(store, SEEN, "1");

  const headers = { apikey: key, Authorization: "Bearer " + key };

  // sumar y leer devuelven lo mismo —el total— así que da igual cuál toque
  const ask = counted
    ? fetch(base + "/rest/v1/counters?id=eq.visits&select=n", { headers })
    : fetch(base + "/rest/v1/rpc/bump_visits", {
        method: "POST",
        headers: Object.assign({}, headers, {
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: "{}",
      });

  ask
    .then((res) => {
      if (res.ok) return res.json();
      return res.text().then((body) => {
        throw new Error("HTTP " + res.status + " — " + (body || res.statusText));
      });
    })
    .then((data) => {
      // el select devuelve [{n:10}]; la función, el escalar pelado (10).
      // Según la versión de postgrest puede venir envuelto: las tres valen
      const row = Array.isArray(data) ? data[0] : data;
      const n = Number(row && typeof row === "object" ? Object.values(row)[0] : row);
      if (!isFinite(n)) throw new Error("respuesta inesperada: " + JSON.stringify(data));

      show(n);
      set(localStorage, LAST, String(n));
    })
    .catch((err) => {
      if (!counted) del(store, SEEN); // no llegó a sumar: que pueda reintentar
      console.error("[counter] " + (counted ? "no se pudo leer el total:" : "no se pudo sumar la visita:"), err.message);
    });
})();

/* ================= guestbook (supabase) =================
   Tabla "guestbook": id, created_at, name, message. Solo se usan
   name y message; id y created_at los pone la base.
   El HTML no trae firmas de ejemplo: arranca con un <p class="feed-status">
   que dice "loading…" y que se reemplaza al contestar supabase, o cuenta
   qué pasó si la lectura falla. */
const guestbookReady = (function guestbook() {
  // en la home las entradas viven dentro del track del marquee
  const list = document.getElementById("gb-track") || document.getElementById("gb-entries");
  if (!list) return Promise.resolve();

  // el <p class="feed-status"> del HTML, mientras siga puesto
  const say = (msg) => {
    const status = list.querySelector(".feed-status");
    if (status) status.textContent = msg;
  };

  const base = (CONFIG.supabaseUrl || "").replace(/\/+$/, "");
  const key = CONFIG.supabaseKey || "";
  const endpoint = base + "/rest/v1/guestbook";
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
  };

  if (!base || !key) {
    console.warn("[guestbook] falta supabaseUrl o supabaseKey en CONFIG (js/main.js)");
    return Promise.resolve();
  }
  if (/\/rest\/v1/.test(base)) {
    console.warn("[guestbook] supabaseUrl debe ser la URL base del proyecto, sin /rest/v1/");
  }

  const fmtDate = (iso) => (iso || new Date().toISOString()).slice(0, 10);

  function render(entry) {
    const div = document.createElement("div");
    div.className = "gb-entry";

    const who = document.createElement("p");
    who.className = "who";
    who.textContent = entry.name;

    const msg = document.createElement("p");
    msg.className = "msg";
    msg.textContent = entry.message; // textContent = injection-proof

    const when = document.createElement("p");
    when.className = "when";
    when.textContent = "– " + fmtDate(entry.created_at);

    div.append(who, msg, when);
    return div;
  }

  // lee las respuestas de error de postgrest, que traen el motivo real
  function fail(res) {
    return res.text().then((body) => {
      throw new Error("HTTP " + res.status + " — " + (body || res.statusText));
    });
  }

  // GET: más nuevas primero
  const loaded = fetch(
    endpoint + "?select=id,created_at,name,message&order=created_at.desc&limit=100",
    { headers }
  )
    .then((res) => (res.ok ? res.json() : fail(res)))
    .then((rows) => {
      if (!rows.length) {
        say("no signatures yet — be the first!");
        return;
      }
      list.innerHTML = ""; // se va el "loading…"
      rows.forEach((row) => list.appendChild(render(row)));
    })
    .catch((err) => {
      console.error("[guestbook] no se pudieron leer las entradas:", err.message);
      say("couldn't load the guestbook");
    });

  // el widget de la home solo muestra; firmar es cosa de guestbook.html
  const form = document.getElementById("gb-form");
  if (!form) return loaded;

  const button = form.querySelector("button[type=submit]");

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = document.getElementById("gb-name").value.trim();
    const message = document.getElementById("gb-msg").value.trim();
    if (!name || !message) return;

    const label = button ? button.textContent : "";
    if (button) { button.disabled = true; button.textContent = "[ sending… ]"; }

    // POST: solo name y message; Prefer devuelve la fila ya creada
    fetch(endpoint, {
      method: "POST",
      headers: Object.assign({}, headers, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ name, message }),
    })
      .then((res) => (res.ok ? res.json() : fail(res)))
      .then((rows) => {
        const row = (Array.isArray(rows) ? rows[0] : rows) || { name, message };
        const status = list.querySelector(".feed-status");
        if (status) status.remove(); // era la primera firma: se va el aviso
        list.prepend(render(row)); // la nueva entrada arriba del todo
        form.reset();
        if (button) { button.disabled = false; button.textContent = label; }
      })
      .catch((err) => {
        console.error("[guestbook] no se pudo firmar:", err.message);
        if (button) { button.disabled = false; button.textContent = "[ error — try again ]"; }
      });
  });

  return loaded;
})();

/* ================= guestbook marquee (widget de la home) =================
   Las entradas suben solas, de la más nueva a la más vieja, en bucle.
   Se duplica el set para que el salto del final al principio no se vea. */
(function guestbookMarquee() {
  const track = document.getElementById("gb-track");
  if (!track) return;

  // se mide cuando ya cargó todo (la webfont cambia las alturas) Y las
  // entradas de supabase están pintadas, no antes: si no, se clonaría
  // el set de ejemplo y luego el fetch lo borraría.
  const windowLoaded = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((r) => window.addEventListener("load", r, { once: true }));

  Promise.all([windowLoaded, guestbookReady]).then(() => {
    const viewport = track.parentElement;
    const entries = Array.from(track.children);
    if (!entries.length) return;

    // si ya entran todas no hay nada que scrollear
    if (track.scrollHeight <= viewport.clientHeight) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    entries.forEach((el) => {
      const clone = el.cloneNode(true);
      clone.setAttribute("aria-hidden", "true"); // la copia no se lee dos veces
      track.appendChild(clone);
    });

    // misma velocidad haya 3 entradas o 30
    track.style.setProperty("--gb-dur", entries.length * 4.5 + "s");
    track.classList.add("is-scrolling");
  });
})();

/* ================= bug of the month — carrete =================
   Las fichas y el archivo los crea el bloque de bug desde supabase.
   Aquí solo se colapsan en un carrusel, y por eso initBugCarousel()
   tiene que llamarse DESPUÉS de que las slides estén en el DOM. */
let initBugCarousel = function () {}; // lo reemplaza el bloque de abajo

(function bugCarousel() {
  function setup() {
    const deck = document.getElementById("bug-deck");
    if (!deck) return;

    const slides = Array.from(deck.querySelectorAll(".bug-slide"));
    if (slides.length < 2) return; // con una sola ficha no hay nada que pasar

    const prev = document.getElementById("bug-prev");
    const next = document.getElementById("bug-next");
    const thumbs = Array.from(document.querySelectorAll(".bug-thumb__btn"));

    let current = 0;

    function show(n) {
      current = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("is-active", i === current));
      // la miniatura del archivo marca cuál se está viendo
      thumbs.forEach((t) =>
        t.parentElement.classList.toggle("is-on", Number(t.dataset.bug) === current)
      );
    }

    if (prev) { prev.hidden = false; prev.addEventListener("click", () => show(current - 1)); }
    if (next) { next.hidden = false; next.addEventListener("click", () => show(current + 1)); }

    thumbs.forEach((t) => {
      t.addEventListener("click", () => {
        show(Number(t.dataset.bug));
        deck.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    deck.classList.add("is-carousel");
    show(0);
  }

  initBugCarousel = setup;
  setup(); // no hace nada si el deck todavía está vacío
})();

/* ================= violet dithering + lightbox =================
   Every <img class="dither"> gets a canvas overlay with an ordered
   (bayer 4x4) dither in the site's violet palette. Hover fades to
   the original; click opens the lightbox. Images must be same-origin
   (or CORS-enabled) for canvas access — local files are fine.

   applyDither(root) procesa las imágenes de un contenedor: lo usan las
   secciones que crean sus fotos por JS después de cargar la página. */
let applyDither = function () {}; // lo reemplaza el bloque de abajo

(function dithering() {
  // violet ramp, dark → bright
  const RAMP = [
    [7, 1, 9], [31, 11, 53], [61, 35, 100], [122, 79, 201], [217, 194, 255],
  ];
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  function ditherInto(img, canvas) {
    const w = Math.min(img.naturalWidth, 480); // small = chunkier pixels
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    let data;
    try {
      data = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      canvas.remove(); // cross-origin image — skip the effect gracefully
      return;
    }

    const px = data.data;
    const steps = RAMP.length;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
        const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16;
        let level = Math.floor(lum * steps + (threshold - 0.5));
        level = Math.max(0, Math.min(steps - 1, level));
        const c = RAMP[level];
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.style.imageRendering = "pixelated";
  }

  function hook(img) {
    if (img.dataset.dithered) return; // ya procesada: no envolverla dos veces
    img.dataset.dithered = "1";

    const wrap = document.createElement("span");
    wrap.className = "dither-wrap";
    wrap.style.display = "block";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    const canvas = document.createElement("canvas");
    wrap.appendChild(canvas);

    const run = () => {
      // si un error previo lo sacó, vuelve: ahora sí hay imagen que pintar
      if (!canvas.isConnected) wrap.appendChild(canvas);
      ditherInto(img, canvas);
    };
    // el listener se queda para siempre: los widgets de la home arrancan con
    // la <img> vacía y le ponen el src al llegar supabase, y ahí el dither se
    // dispara solo. Si el src cambia otra vez, se rehace igual.
    img.addEventListener("load", run);
    if (img.complete && img.naturalWidth) run();
    // si la imagen no carga, el canvas vacío taparía el hueco: fuera
    img.addEventListener("error", () => canvas.remove());

    // data-nozoom = esta imagen no se agranda, solo se revela al pasar el
    // mouse (el cover del player: se pide chico y no hay versión grande).
    // Si la foto vive dentro de un enlace, el clic es del enlace: abrir el
    // lightbox además solo pisaría la navegación.
    if (img.dataset.nozoom !== undefined || img.closest("a")) {
      wrap.style.cursor = "";
    } else {
      // data-full = versión grande (imagekit); si no hay, la misma imagen
      wrap.addEventListener("click", () => openLightbox(img.dataset.full || img.src, img.alt));
    }
  }

  // procesa un contenedor concreto, o todo el documento si no se pasa ninguno
  applyDither = function (root) {
    (root || document).querySelectorAll("img.dither").forEach(hook);
  };

  applyDither(document); // las imágenes que ya venían en el HTML

  // lightbox
  const lb = document.getElementById("lightbox");
  function openLightbox(src, alt) {
    if (!lb) return;
    const im = lb.querySelector("img");
    im.src = src;
    im.alt = alt || "";
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
  }
  if (lb) {
    lb.addEventListener("click", () => {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") lb.classList.remove("open");
    });
  }
})();

/* ================= supabase + imagekit (compartido) =================
   Lo usan tanto el bloque de photos (memories / art) como el de bug:
   una sola definición de credenciales, query y armado de URLs. */
const PHOTOS = (function photosApi() {
  const base = (CONFIG.supabaseUrl || "").replace(/\/+$/, "");
  const key = CONFIG.supabaseKey || "";
  const cdn = (CONFIG.imagekitUrl || "").replace(/\/+$/, "");

  const MONTHS = ["january","february","march","april","may","june",
                  "july","august","september","october","november","december"];

  // lee las respuestas de error de postgrest, que traen el motivo real
  function fail(res) {
    return res.text().then((body) => {
      throw new Error("HTTP " + res.status + " — " + (body || res.statusText));
    });
  }

  return {
    ready: Boolean(base && key && cdn),

    get(query) {
      return fetch(base + "/rest/v1/" + query, {
        headers: { apikey: key, Authorization: "Bearer " + key },
      }).then((res) => (res.ok ? res.json() : fail(res)));
    },

    // {endpoint}/{image_path}?tr=w-…  (image_path va sin barra inicial)
    img(path, width) {
      return cdn + "/" + String(path).replace(/^\/+/, "") + "?tr=w-" + width;
    },

    // "2026-07-15" → "jul 2026" (short) o "july 2026". Se parte a mano en
    // vez de con Date() porque new Date("2026-07-01") es medianoche UTC y
    // en un huso negativo se muestra como junio 30: el mes saldría mal.
    month(dateStr, short) {
      const m = /^(\d{4})-(\d{2})/.exec(dateStr || "");
      if (!m) return "";
      const name = MONTHS[Number(m[2]) - 1];
      return (short ? name.slice(0, 3) : name) + " " + m[1];
    },
  };
})();

/* ================= photos data-driven (supabase + imagekit) =================
   Cualquier página con <div id="photo-grid" data-section="…"> se llena
   sola: las filas salen de la tabla "photos" de supabase y los archivos
   los sirve imagekit. Las tarjetas copian el markup de las memories. */
(function photos() {
  const grid = document.getElementById("photo-grid");     // páginas de sección
  const widget = document.getElementById("latest-memory"); // widget de la home
  if (!grid && !widget) return;

  // el <p class="feed-status"> del HTML: mientras carga dice "loading…",
  // al terminar bien desaparece, y si algo falla cuenta qué pasó
  const say = (msg) => {
    if (!grid) return; // el widget de la home no tiene dónde avisar
    const status = grid.querySelector(".feed-status");
    if (status) status.textContent = msg;
    else grid.textContent = msg;
  };

  if (!PHOTOS.ready) {
    console.error("[photos] faltan supabaseUrl / supabaseKey / imagekitUrl en CONFIG (js/main.js)");
    say("photos not configured — see js/main.js");
    return;
  }

  const get = PHOTOS.get;
  const imgUrl = PHOTOS.img;

  function monthLabel(row) {
    return PHOTOS.month(row.taken_at || row.created_at, true) || "memory";
  }

  // Lo que cambia de una sección a otra. Todo lo demás (fetch, tarjeta,
  // dither, lightbox) es el mismo código para las dos.
  //   icon   → el que ya usaba cada página en su win__bar
  //   title  → qué va en la barra de la tarjeta
  //   square → art tenía las fotos cuadradas por style inline; se conserva
  const SECTIONS = {
    memories: { icon: "▣", title: monthLabel },
    art: {
      icon: "✿",
      // la barra de art mostraba la categoría ("ceramics", "pixel art"…),
      // no una fecha: sale del primer tag y si no hay, cae al mes
      title: (row) => (row.tags && row.tags[0]) || monthLabel(row),
      square: true,
    },
  };

  const section = grid ? grid.dataset.section || "" : "";
  const conf = SECTIONS[section] || { icon: "▣", title: monthLabel };

  function card(row) {
    const sec = document.createElement("section");
    sec.className = "win";

    const bar = document.createElement("div");
    bar.className = "win__bar";
    bar.innerHTML =
      '<span class="icon" aria-hidden="true"></span>' +
      '<span class="title"></span>' +
      '<span class="win__btns" aria-hidden="true"><span>–</span><span>×</span></span>';
    bar.querySelector(".icon").textContent = conf.icon;
    bar.querySelector(".title").textContent = conf.title(row);

    const body = document.createElement("div");
    body.className = "win__body";

    const photo = document.createElement("div");
    photo.className = "mem-photo";
    // art las tenía cuadradas por style inline en el HTML; se replica igual
    if (conf.square) photo.style.aspectRatio = "1";

    const img = document.createElement("img");
    img.className = "dither";
    // crossOrigin ANTES que src: si no, el navegador pide la imagen sin
    // cabeceras CORS y el canvas del dither queda tainted igual
    img.crossOrigin = "anonymous";
    img.alt = row.caption || "";
    img.loading = "lazy";
    img.dataset.full = imgUrl(row.image_path, 1600); // el lightbox abre esta
    img.src = imgUrl(row.image_path, 480);
    img.addEventListener("error", () =>
      console.error("[photos] imagekit no devolvió la imagen:", img.src)
    );
    photo.appendChild(img);

    const caption = document.createElement("p");
    caption.className = "mem-caption";
    caption.textContent = row.caption || ""; // textContent = injection-proof

    body.append(photo, caption);

    if (row.taken_at) {
      const date = document.createElement("p");
      date.className = "mem-date";
      date.textContent = row.taken_at;
      body.appendChild(date);
    }

    sec.append(bar, body);
    return sec;
  }

  // la grilla completa de una sección, ordenada por fecha de la foto
  function fillGrid() {
    get("photos?select=*&section=eq." + encodeURIComponent(section) + "&order=taken_at.desc")
      .then((rows) => {
        if (!rows.length) {
          say("no " + (section || "photos") + " yet");
          return;
        }
        const frag = document.createDocumentFragment();
        rows.forEach((row) => {
          if (!row.image_path) {
            console.warn("[photos] fila sin image_path, se salta:", row.id);
            return;
          }
          frag.appendChild(card(row));
        });
        grid.innerHTML = ""; // se va el "loading…"
        grid.appendChild(frag);

        // el dither se engancha ahora: estas imágenes no existían al cargar
        applyDither(grid);
      })
      .catch((err) => {
        console.error("[photos] no se pudieron leer las fotos:", err.message);
        say("couldn't load photos — check the console");
      });
  }

  // widget "latest memory" de la home: la última foto SUBIDA (created_at),
  // no la más reciente tomada. La tarjeta existe en el HTML vacía (sin src ni
  // textos): acá se le pone el contenido. Si supabase no contesta queda el
  // recuadro vacío, que es lo honesto — no hay copia local de las fotos.
  function fillLatest() {
    const img = widget.querySelector("img.dither");
    const caption = widget.querySelector(".mem-caption");
    const date = widget.querySelector(".mem-date");
    if (!img) return;

    get("photos?select=*&section=eq.memories&order=created_at.desc&limit=1")
      .then((rows) => {
        const row = rows[0];
        if (!row || !row.image_path) {
          console.warn("[photos] no hay fotos en memories: el widget queda vacío");
          return;
        }
        // crossOrigin ANTES que src, si no el canvas del dither queda tainted.
        // Al cambiar src salta el 'load' de la imagen y el dither se rehace solo.
        img.crossOrigin = "anonymous";
        img.dataset.full = imgUrl(row.image_path, 1600); // el lightbox abre esta
        img.alt = row.caption || "";
        img.src = imgUrl(row.image_path, 480);

        if (caption) caption.textContent = row.caption || ""; // injection-proof
        if (date) date.textContent = row.taken_at || "";
      })
      .catch((err) => {
        console.error("[photos] no se pudo leer la última memory:", err.message);
      });
  }

  if (grid) fillGrid();
  if (widget) fillLatest();
})();

/* ================= journal + lab (supabase) =================
   Las dos secciones son la misma función: cambia la categoría y poco más.
   Cualquier página con <div id="post-feed" data-category="…"> se llena
   sola con las filas de la tabla "journal", y en la home el widget
   #hj-title muestra el post más reciente.

   El HTML de cada post lo escribe el Studio (otro repo) y llega ya
   sanitizado, pero acá se vuelve a limpiar antes de meterlo en la página:
   este sitio no controla quién escribió la fila, y "confiá, ya viene
   limpio" es exactamente la suposición con la que entran los XSS. */
(function journal() {
  const feed = document.getElementById("post-feed");     // journal.html / lab.html
  const widget = document.getElementById("hj-title");    // widget de la home
  if (!feed && !widget) return;

  // el <p class="feed-status"> del HTML: "loading…" mientras carga, o el
  // motivo si algo falló. El widget de la home no tiene dónde avisar.
  const say = (msg) => {
    if (!feed) return;
    const status = feed.querySelector(".feed-status");
    if (status) status.textContent = msg;
    else feed.textContent = msg;
  };

  if (!PHOTOS.ready) {
    console.error("[journal] faltan supabaseUrl / supabaseKey / imagekitUrl en CONFIG (js/main.js)");
    say("journal not configured — see js/main.js");
    return;
  }

  /* ---------- sanitizado ----------
     El whitelist es EXACTAMENTE el del Studio. Recortarlo de más no es
     "más seguro": borra formato legítimo (negritas, colores, listas) y el
     post se ve roto. Se parsea con DOMParser —un documento inerte, que no
     ejecuta scripts ni pide las imágenes— y se recorre el árbol. Nada de
     regex: una expresión regular no entiende HTML y siempre se le escapa
     algo, para un lado o para el otro. */
  const TAGS = ["p","br","hr","h2","h3","h4","strong","b","em","i","u","s",
                "sub","sup","blockquote","ul","ol","li","pre","code","a","img","span"];
  const STYLED = ["p","h2","h3","h4","blockquote","ul","ol","li","pre","span","img"];
  const ATTRS = { a: ["href","target","rel"], img: ["src","alt","width","height"] };
  const CSS_PROPS = ["color","background-color","font-size","text-align","width","height","max-width"];
  const SAFE_HREF = /^(https?:|mailto:|#|\/|\.{1,2}\/)/i;
  const SAFE_SRC = /^https?:\/\//i;

  const allowed = (tag) =>
    (ATTRS[tag] || []).concat(STYLED.indexOf(tag) !== -1 ? ["style"] : []);

  // el style se relee del CSSOM y no del string: el navegador ya descartó
  // lo que no parseaba, así que no hay que escribir un parser de CSS
  function cleanStyle(el) {
    const keep = [];
    CSS_PROPS.forEach((prop) => {
      const v = el.style.getPropertyValue(prop);
      if (v && !/url\(|expression|javascript:/i.test(v)) keep.push(prop + ":" + v);
    });
    return keep.join(";");
  }

  function sanitize(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");

    // querySelectorAll da orden de documento: si se cae un padre, sus hijos
    // ya se fueron con él y lo que quede del recorrido es inofensivo
    Array.prototype.forEach.call(doc.body.querySelectorAll("*"), (el) => {
      const tag = el.tagName.toLowerCase();
      if (TAGS.indexOf(tag) === -1) { el.remove(); return; }

      const ok = allowed(tag);
      const style = ok.indexOf("style") !== -1 ? cleanStyle(el) : "";

      Array.prototype.forEach.call(Array.prototype.slice.call(el.attributes), (at) => {
        if (ok.indexOf(at.name.toLowerCase()) === -1) el.removeAttribute(at.name);
      });
      if (style) el.setAttribute("style", style);
      else el.removeAttribute("style");

      if (tag === "a") {
        const href = (el.getAttribute("href") || "").trim();
        if (!SAFE_HREF.test(href)) el.removeAttribute("href"); // adiós javascript:
        // los links de afuera se abren afuera, y sin regalar la referencia
        if (/^https?:/i.test(href)) {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      }

      if (tag === "img") {
        if (!SAFE_SRC.test((el.getAttribute("src") || "").trim())) { el.remove(); return; }
        // fuera del whitelist a propósito: los pone la web, no el content.
        // Sin esto, la página baja las imágenes de TODOS los posts de una.
        el.setAttribute("loading", "lazy");
        el.setAttribute("decoding", "async");
      }
    });

    return doc.body;
  }

  // appendChild adopta el nodo del documento inerte al vivo: nunca se toca
  // innerHTML con contenido de la base
  function appendClean(host, html) {
    const clean = sanitize(html);
    while (clean.firstChild) host.appendChild(clean.firstChild);
  }

  /* ---------- extracto en texto plano (widget de la home) ---------- */
  function excerpt(html, max) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return (space > 0 ? cut.slice(0, space) : cut) + "…";
  }

  /* ---------- fecha ----------
     "2026-07-31T08:32:50Z" → "31 july 2026". Se parte el string en vez de
     usar Date() por lo mismo que en PHOTOS.month: new Date(iso) traduce a
     la zona local y un post de la madrugada aparecería con el día anterior. */
  function readable(iso) {
    const m = /^\d{4}-\d{2}-(\d{2})/.exec(iso || "");
    const monthYear = PHOTOS.month(iso, false);
    if (!m || !monthYear) return "";
    return Number(m[1]) + " " + monthYear;
  }

  /* ---------- lo que cambia entre journal y lab ---------- */
  const SECTIONS = {
    journal: { icon: "✎", label: "entry" },
    lab: { icon: "⚗", label: "project" },
  };

  function card(row, conf, first) {
    const art = document.createElement("article");
    art.className = "win entry-win";
    if (row.slug) art.id = row.slug; // para poder linkear journal.html#slug

    const bar = document.createElement("div");
    bar.className = "win__bar";
    bar.innerHTML =
      '<span class="icon" aria-hidden="true"></span>' +
      '<span class="title"></span>' +
      '<span class="win__btns" aria-hidden="true"><span>–</span><span>×</span></span>';
    bar.querySelector(".icon").textContent = conf.icon;
    bar.querySelector(".title").textContent = conf.label;

    const body = document.createElement("div");
    body.className = "win__body";

    const h = document.createElement("h2");
    h.className = "jp-title";
    h.textContent = row.title || "untitled"; // textContent = injection-proof

    const date = document.createElement("p");
    date.className = "jp-date";
    date.textContent = readable(row.created_at);

    const hr = document.createElement("hr");
    hr.className = "dotrule";
    body.append(h, date, hr);

    if (row.cover_path) {
      const cover = document.createElement("div");
      cover.className = "entry-cover";
      const img = document.createElement("img");
      img.alt = ""; // decorativa: el título va al lado, no hay nada que repetir
      img.decoding = "async";
      // el cover del primer post está sobre el fold: ponerle lazy ahí atrasa
      // el LCP en vez de mejorarlo. Del segundo en adelante, lazy.
      if (!first) img.loading = "lazy";
      img.src = PHOTOS.img(row.cover_path, 1200);
      img.addEventListener("error", () =>
        console.error("[journal] imagekit no devolvió el cover:", img.src)
      );
      cover.appendChild(img);
      body.appendChild(cover);
    }

    const entry = document.createElement("div");
    entry.className = "entry";
    appendClean(entry, row.content);
    body.appendChild(entry);

    art.append(bar, body);
    return art;
  }

  // el navegador ya intentó saltar al ancla al cargar, cuando los posts
  // todavía no existían: hay que repetirlo una vez que están en la página
  function jumpToHash() {
    if (!location.hash) return;
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) {}
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView();
  }

  const FIELDS = "id,created_at,title,content,cover_path,slug";

  // published=eq.true va en la query, no en el cliente: un borrador no se
  // filtra después de haberlo bajado, directamente no se pide
  function query(cat, extra) {
    return "journal?select=" + FIELDS +
           "&category=eq." + encodeURIComponent(cat) +
           "&published=eq.true&order=created_at.desc" + (extra || "");
  }

  function fillFeed() {
    const cat = feed.dataset.category || "journal";
    const conf = SECTIONS[cat] || SECTIONS.journal;

    PHOTOS.get(query(cat))
      .then((rows) => {
        if (!rows.length) {
          say("nothing here yet");
          return;
        }
        const frag = document.createDocumentFragment();
        rows.forEach((row, i) => frag.appendChild(card(row, conf, i === 0)));
        feed.innerHTML = ""; // se va el "loading…"
        feed.appendChild(frag);
        jumpToHash();
      })
      .catch((err) => {
        console.error("[journal] no se pudieron leer los posts:", err.message);
        say("couldn't load posts — check the console");
      });
  }

  // widget de la home: el post más reciente, con un extracto en texto plano
  function fillWidget() {
    const date = document.getElementById("hj-date");
    const body = document.getElementById("hj-body");
    const link = document.getElementById("hj-link");

    // el widget arranca con un "loading…" que hay que reemplazar sí o sí:
    // si se queda ahí para siempre parece que la página se colgó
    const note = (msg) => {
      if (!body) return;
      const p = document.createElement("p");
      p.className = "feed-status";
      p.textContent = msg;
      body.replaceChildren(p);
    };

    PHOTOS.get(query("journal", "&limit=1"))
      .then((rows) => {
        const row = rows[0];
        if (!row) {
          console.warn("[journal] no hay posts publicados: el widget queda vacío");
          note("nothing here yet");
          return;
        }
        widget.textContent = row.title || "untitled";
        if (date) date.textContent = readable(row.created_at);
        if (body) {
          const p = document.createElement("p");
          p.textContent = excerpt(row.content, 200);
          body.replaceChildren(p);
        }
        if (link && row.slug) link.href = "journal.html#" + encodeURIComponent(row.slug);
      })
      .catch((err) => {
        console.error("[journal] no se pudo leer el último post:", err.message);
        note("couldn't load — check the console");
      });
  }

  if (feed) fillFeed();
  if (widget) fillWidget();
})();

/* ================= bug of the month (supabase + imagekit) =================
   Llena el carrete y el archivo de miniaturas con section='bug'. El diseño
   es el mismo de antes: acá solo se arma el markup que estaba hardcodeado.
   initBugCarousel() va al final, cuando las slides ya existen en el DOM. */
(function bugSection() {
  const deck = document.getElementById("bug-deck");       // página de bug
  const widget = document.getElementById("latest-bug");   // widget de la home
  if (!deck && !widget) return;
  const archive = document.getElementById("bug-archive");

  const say = (msg) => {
    if (!deck) return; // el widget de la home no tiene dónde avisar
    const status = deck.querySelector(".feed-status");
    if (status) status.textContent = msg;
    else deck.textContent = msg;
  };

  if (!PHOTOS.ready) {
    console.error("[bug] faltan supabaseUrl / supabaseKey / imagekitUrl en CONFIG (js/main.js)");
    say("bugs not configured — see js/main.js");
    return;
  }

  // los <li> de la info card, en este orden; el que venga vacío no se genera
  const FIELDS = [
    ["family", "bug_family"],
    ["found in", "bug_found_in"],
    ["diet", "bug_diet"],
    ["lifespan", "bug_lifespan"],
  ];

  // ventana vacía con la barra ya armada, como las del HTML
  function win(icon, title) {
    const sec = document.createElement("section");
    sec.className = "win";

    const bar = document.createElement("div");
    bar.className = "win__bar";
    bar.innerHTML =
      '<span class="icon" aria-hidden="true"></span>' +
      '<span class="title"></span>' +
      '<span class="win__btns" aria-hidden="true"><span>–</span><span>×</span></span>';
    bar.querySelector(".icon").textContent = icon;
    bar.querySelector(".title").textContent = title;

    const body = document.createElement("div");
    body.className = "win__body";

    sec.append(bar, body);
    return { sec, body };
  }

  // foto + nombre común + científico: igual en la ficha y en la miniatura.
  // SIN class="dither": en bug.html los bichos se ven tal cual, como antes.
  // El dither de bug vive solo en el widget de la home (index.html), que sí
  // trae la clase en su HTML y revela la original al pasar el mouse.
  function fillPhotoBody(row, body, lazy) {
    const photo = document.createElement("div");
    photo.className = "bug-photo";

    if (row.image_path) {
      const img = document.createElement("img");
      img.alt = row.caption || "";
      if (lazy) img.loading = "lazy";
      img.src = PHOTOS.img(row.image_path, 480);
      img.addEventListener("error", () =>
        console.error("[bug] imagekit no devolvió la imagen:", img.src)
      );
      photo.appendChild(img);
    } else {
      // mismo placeholder que traían las fichas sin foto
      const span = document.createElement("span");
      span.style.color = "var(--vio-faint)";
      span.textContent = "[ photo ]";
      photo.appendChild(span);
    }

    body.appendChild(photo);

    if (row.caption) {
      const common = document.createElement("p");
      common.className = "bug-common";
      common.textContent = row.caption; // textContent = injection-proof
      body.appendChild(common);
    }
    if (row.species) {
      const species = document.createElement("p");
      species.className = "bug-species";
      species.textContent = row.species;
      body.appendChild(species);
    }
  }

  function infoWin(row) {
    const { sec, body } = win("✎", "info card");

    const ul = document.createElement("ul");
    ul.className = "plainlist";
    FIELDS.forEach(([label, col]) => {
      if (!row[col]) return; // campo vacío o null: no se genera el <li>
      const li = document.createElement("li");
      li.textContent = label + " ";
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = row[col];
      li.appendChild(note);
      ul.appendChild(li);
    });
    if (ul.children.length) body.appendChild(ul);

    const hr = document.createElement("hr");
    hr.className = "dotrule";
    body.appendChild(hr);

    if (row.bug_note) {
      const jp = document.createElement("div");
      jp.className = "jp-body";
      const p = document.createElement("p");
      p.textContent = row.bug_note;
      jp.appendChild(p);
      body.appendChild(jp);
    }

    return sec;
  }

  function slide(row) {
    const art = document.createElement("article");
    art.className = "bug-slide grid-2";

    const photoWin = win("✶", PHOTOS.month(row.taken_at, false) || "bug");
    fillPhotoBody(row, photoWin.body, false);

    art.append(photoWin.sec, infoWin(row));
    return art;
  }

  function thumb(row, index) {
    const { sec, body } = win("✶", PHOTOS.month(row.taken_at, true) || "bug");
    sec.classList.add("bug-thumb");
    fillPhotoBody(row, body, true);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bug-thumb__btn";
    btn.dataset.bug = String(index); // mismo índice que la slide
    btn.setAttribute("aria-label", "show " + (row.caption || "bug"));
    sec.appendChild(btn);

    return sec;
  }

  // widget "bug of the month" de la home. La ficha existe en el HTML vacía:
  // acá se le pone el contenido. Si supabase no contesta queda el recuadro
  // vacío — las fotos viven en imagekit, no hay copia local.
  function fillWidget() {
    const img = widget.querySelector("img.dither");
    const common = widget.querySelector(".bug-common");
    const species = widget.querySelector(".bug-species");
    const link = widget.querySelector(".bug-link");
    if (!img) return;

    PHOTOS.get("photos?select=*&section=eq.bug&order=created_at.desc")
      .then((rows) => {
        // el marcado como bicho del mes manda; si no hay ninguno, el último
        // que subiste. Es la misma regla con la que abre el carrete.
        const row = rows.find((r) => r.is_featured) || rows[0];
        if (!row || !row.image_path) {
          console.warn("[bug] no hay bichos con foto: el widget queda vacío");
          return;
        }
        // crossOrigin ANTES que src: al cambiarlo salta el 'load' y el
        // dither se rehace solo sobre la imagen nueva
        img.crossOrigin = "anonymous";
        img.dataset.full = PHOTOS.img(row.image_path, 1600);
        img.alt = row.caption || "";
        img.src = PHOTOS.img(row.image_path, 480);

        if (common) common.textContent = row.caption || ""; // injection-proof
        if (species) species.textContent = row.species || "";
        if (link && row.caption) {
          link.setAttribute("aria-label", "bug of the month: " + row.caption + " — see more");
        }
      })
      .catch((err) => {
        console.error("[bug] no se pudo leer el bicho del mes:", err.message);
      });
  }

  if (widget) fillWidget();
  if (!deck) return; // en la home no hay carrete que armar

  PHOTOS.get("photos?select=*&section=eq.bug&order=taken_at.desc")
    .then((rows) => {
      if (!rows.length) {
        say("no bugs yet");
        return;
      }

      // el destacado abre el carrete; si no hay ninguno queda el más
      // reciente, que ya viene primero por el order=taken_at.desc
      const star = rows.findIndex((r) => r.is_featured);
      if (star > 0) rows.unshift(rows.splice(star, 1)[0]);

      const slides = document.createDocumentFragment();
      const thumbs = document.createDocumentFragment();
      rows.forEach((row, i) => {
        slides.appendChild(slide(row));
        thumbs.appendChild(thumb(row, i)); // mismo orden, mismo índice
      });

      deck.innerHTML = ""; // se va el "loading…"
      deck.appendChild(slides);
      if (archive) {
        archive.innerHTML = "";
        archive.appendChild(thumbs);
      }

      // acá no va applyDither: en bug.html las fotos se ven sin efecto

      // el carrusel al final, cuando ya hay slides y miniaturas que leer
      initBugCarousel();
    })
    .catch((err) => {
      console.error("[bug] no se pudieron leer los bichos:", err.message);
      say("couldn't load bugs — check the console");
    });
})();

/* ================= now playing — el reproductor (supabase + imagekit) =================
   La playlist es la tabla "songs" (id, title, artist, song_path,
   cover_path, sort_order); los mp3 y los covers los sirve imagekit.
   Un solo <audio> para todas: cambiar de canción es cambiarle el src.

   El dither del cover no se rehace acá: la <img class="dither"> ya vive
   en el HTML, así que el bloque de dithering la enganchó al cargar y se
   repinta sola en cada 'load' — o sea, cada vez que le cambiamos el src. */
(function musicPlayer() {
  const audio = document.getElementById("np-audio");
  if (!audio) return; // fuera de la home no hay reproductor

  const $ = (id) => document.getElementById(id);
  const cover = $("np-cover");
  const titleEl = $("np-title");
  const artistEl = $("np-artist");
  const timeEl = $("np-time");
  const prevBtn = $("np-prev");
  const playBtn = $("np-play");
  const nextBtn = $("np-next");
  const volBar = $("np-vol");
  const muteBtn = $("np-mute");

  const cdn = (CONFIG.imagekitUrl || "").replace(/\/+$/, "");

  /* {imagekitUrl}/{path}[?tr=…]. Cada segmento va por encodeURIComponent
     pero las barras NO: son carpetas, no parte del nombre. Sin esto las
     canciones con espacios, "⚸", apóstrofos o paréntesis dan 404.

     Y al revés: imagekit compara la ruta tal cual viene, sin decodificar,
     así que los signos que un path admite en crudo tienen que quedar en
     crudo. La coma es el caso real de esta playlist — "tomcbumpz, ivri"
     con %2C da 404 y con "," da 200. Son los sub-delims de RFC 3986:
     $ & + , : ; = @  (a ! ' ( ) * encodeURIComponent ya los deja pasar). */
  const RAW = /%(24|26|2B|2C|3A|3B|3D|40)/g;

  function fileUrl(path, tr) {
    const clean = String(path || "").replace(/^\/+/, "");
    const enc = clean
      .split("/")
      .map((seg) =>
        encodeURIComponent(seg).replace(RAW, (m, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        )
      )
      .join("/");
    return cdn + "/" + enc + (tr ? "?tr=" + tr : "");
  }

  // segundos → "m:ss"; duration es NaN hasta que llegan los metadatos
  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /* ---------- marquee ----------
     Si el texto entra en la columna se queda quieto; si no, el <span> se
     desplaza justo lo que sobra (--np-shift) y vuelve. La velocidad es la
     misma para un título largo que para uno corto. */
  function marquee(span) {
    const line = span.parentElement;
    line.classList.remove("is-scrolling");
    span.style.removeProperty("--np-shift");
    span.style.removeProperty("--np-dur");

    const over = span.getBoundingClientRect().width - line.getBoundingClientRect().width;
    if (over <= 1) return; // entra entero: nada que desplazar

    span.style.setProperty("--np-shift", "-" + Math.ceil(over) + "px");
    span.style.setProperty("--np-dur", (6 + over / 25).toFixed(1) + "s");
    line.classList.add("is-scrolling");
  }

  // medir después de que el navegador maquetó el texto nuevo
  function remeasure() {
    requestAnimationFrame(() => { marquee(titleEl); marquee(artistEl); });
  }

  // la webfont cambia los anchos: lo que entraba con la fallback puede no
  // entrar después, así que se vuelve a medir cuando termina de cargar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(remeasure, 200);
  });

  /* ---------- estado ---------- */
  let songs = [];
  let current = 0;
  let broken = 0;      // mp3 seguidos que no cargaron, para no girar en el vacío
  let wanted = false;  // ¿la última orden fue sonar? (paused no sirve: un mp3
                       // roto deja el audio en pausa aunque quisiéramos oírlo)
  let opened = false;  // ya se pasó la puerta de entrada
  let started = false; // el autoplay se intenta una sola vez

  /* la puerta de entrada (welcome screen). Si está puesta, la música espera
     a que la abras: ese clic además es la interacción que el navegador
     necesita para dejar sonar el audio. Si no está —el welcome ya se mostró
     en una visita anterior y el bloque de arriba lo sacó del DOM— se
     intenta igual al cargar, que es lo que pediste ver al llegar a la home. */
  const door = document.getElementById("ws-enter");
  if (door) {
    door.addEventListener("click", () => { opened = true; autostart(); }, { once: true });
  }

  // aviso discreto: el widget se queda sin playlist pero la home sigue viva
  function note(msg) {
    titleEl.textContent = msg;
    artistEl.textContent = "";
    timeEl.textContent = "";
    remeasure();
    [prevBtn, playBtn, nextBtn].forEach((b) => { b.disabled = true; });
  }

  function play() {
    wanted = true;
    const p = audio.play();
    // play() rechaza si el navegador aún no vio una interacción del usuario
    if (p && p.catch) {
      p.catch((err) => console.error("[player] el navegador no dejó reproducir:", err.message));
    }
  }

  /* arranque solo. Puede llegar por dos lados —la playlist que termina de
     cargar o el clic de la puerta— y no se sabe cuál va primero, así que
     cada uno llama y el que llega tarde es el que arranca de verdad. */
  function autostart() {
    if (started || !songs.length) return;
    if (door && !opened) return; // todavía está la puerta: se espera al clic

    started = true;
    wanted = true;
    const p = audio.play();
    if (p && p.catch) {
      p.catch((err) => {
        // sin puerta que abrir no hubo ninguna interacción todavía, y casi
        // todos los navegadores piden una antes de dejar sonar nada
        console.warn("[player] autoplay bloqueado, arranca al primer clic:", err.message);
        firstGesture();
      });
    }
  }

  // plan B del autoplay: el primer clic o tecla en cualquier parte de la
  // página ya sirve como permiso, y el oyente se saca en cuanto se usa
  function firstGesture() {
    const events = ["pointerdown", "keydown"];
    const go = () => {
      events.forEach((ev) => document.removeEventListener(ev, go, true));
      play();
    };
    events.forEach((ev) => document.addEventListener(ev, go, true));
  }

  function load(i, andPlay) {
    if (!songs.length) return;
    current = ((i % songs.length) + songs.length) % songs.length;
    const song = songs[current];

    titleEl.textContent = song.title || "untitled";
    artistEl.textContent = song.artist || "";
    remeasure();
    timeEl.textContent = "0:00 / 0:00";

    // crossOrigin ANTES que src: si no, el navegador pide la imagen sin
    // cabeceras CORS y el canvas del dither queda tainted
    cover.crossOrigin = "anonymous";
    // alt vacío a propósito: la tapa es decorativa —el título está al lado—
    // y así un cover que falta deja el recuadro negro en vez del texto roto
    if (song.cover_path) {
      cover.src = fileUrl(song.cover_path, "w-160"); // se ve chico: no agrandar
    } else {
      console.warn("[player] la canción no tiene cover_path:", song.title || song.id);
      cover.removeAttribute("src");
      // sin 'error' que lo limpie, el dither de la anterior se quedaría puesto
      const stale = cover.parentElement && cover.parentElement.querySelector("canvas");
      if (stale) stale.remove();
    }

    audio.src = fileUrl(song.song_path);
    audio.load();
    if (andPlay) play();
  }

  /* ---------- audio ---------- */
  const tick = () => {
    timeEl.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
  };
  audio.addEventListener("timeupdate", tick);
  audio.addEventListener("loadedmetadata", tick);
  audio.addEventListener("durationchange", tick);

  // el botón sigue al estado real del audio, no al revés: así queda bien
  // aunque la reproducción la corte el navegador o falle el archivo
  audio.addEventListener("play", () => {
    playBtn.textContent = "⏸";
    playBtn.setAttribute("aria-label", "pause");
  });
  audio.addEventListener("pause", () => {
    playBtn.textContent = "▶";
    playBtn.setAttribute("aria-label", "play");
  });

  audio.addEventListener("canplay", () => { broken = 0; });

  // fin de canción → la siguiente; después de la última, la primera otra vez
  audio.addEventListener("ended", () => load(current + 1, true));

  audio.addEventListener("error", () => {
    if (!audio.currentSrc && !audio.getAttribute("src")) return; // src vaciado a mano
    const err = audio.error;
    console.error(
      "[player] no se pudo cargar el mp3:",
      audio.currentSrc || audio.src,
      err ? "(code " + err.code + ")" : ""
    );
    broken++;
    if (broken >= songs.length) {
      note("couldn't play the playlist — check the console");
      return;
    }
    // saltar a la siguiente; solo sigue sonando si ya estábamos en eso
    load(current + 1, wanted);
  });

  cover.addEventListener("error", () => {
    if (cover.getAttribute("src")) console.error("[player] imagekit no devolvió el cover:", cover.src);
  });

  /* ---------- controles ---------- */
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      play();
    } else {
      wanted = false;
      audio.pause();
    }
  });
  // "si ya venía sonando": cambiar de canción no arranca el audio por su cuenta
  prevBtn.addEventListener("click", () => load(current - 1, wanted));
  nextBtn.addEventListener("click", () => load(current + 1, wanted));

  /* ---------- volumen ---------- */
  const paintVol = (v) => volBar.style.setProperty("--np-fill", v + "%");

  volBar.value = 35;
  audio.volume = 0.35;
  paintVol(35);

  volBar.addEventListener("input", () => {
    const v = Number(volBar.value);
    audio.volume = v / 100;
    paintVol(v);
    // tocar la barra estando en mute y no oír nada es desconcertante
    if (audio.muted && v > 0) audio.muted = false;
  });

  muteBtn.addEventListener("click", () => { audio.muted = !audio.muted; });

  // muted no toca volume, así que al desmutear vuelve solo al valor de antes
  audio.addEventListener("volumechange", () => {
    muteBtn.textContent = audio.muted ? "🕪×" : "🕪";
    muteBtn.setAttribute("aria-label", audio.muted ? "unmute" : "mute");
    muteBtn.setAttribute("aria-pressed", String(audio.muted));
  });

  /* ---------- la playlist ---------- */
  if (!PHOTOS.ready) {
    console.error("[player] faltan supabaseUrl / supabaseKey / imagekitUrl en CONFIG (js/main.js)");
    note("player not configured — see js/main.js");
    return;
  }

  PHOTOS.get("songs?select=*&order=sort_order.asc")
    .then((rows) => {
      songs = (rows || []).filter((row) => {
        if (row.song_path) return true;
        console.warn("[player] fila sin song_path, se salta:", row.id);
        return false;
      });

      if (!songs.length) {
        console.warn("[player] la tabla songs está vacía");
        note("no songs yet");
        return;
      }

      [prevBtn, playBtn, nextBtn].forEach((b) => { b.disabled = false; });

      load(0, false);
      autostart(); // suena sola al llegar a la home
    })
    .catch((err) => {
      console.error("[player] no se pudieron leer las canciones:", err.message);
      note("couldn't load the playlist");
    });
})();

/* ================= starfield =================
   El cielo del fondo. Una capa fija (.starfield) que se llena de
   glifos con posición, tamaño, brillo y ritmo al azar.

   El reparto no es azar puro: se divide la pantalla en una rejilla y
   cada celda tira su estrella en un punto cualquiera de adentro. Sale
   igual de desordenado, pero sin los grumos y los claros enormes que
   deja el random a secas. */
(function starfield() {
  // los chicos salen mucho, los grandes son la excepción
  const GLYPHS = [
    "·", "·", "·", "*", "*", "∗", "⋆", "⋆", "✦", "✧", "⁕", "⋇",
    "★", "☆", "✭", "✮", "✯", "✰", "⭑", "⭒", "⟡", "✴", "⋈",
  ];
  const BIG = "★☆✭✮✯✰✴"; // los que llevan glow

  const CELL = 110;   // px de lado de cada celda de la rejilla
  const FILL = 0.68;  // probabilidad de que una celda tenga estrella
  const MAX  = 220;   // techo, por si alguien abre esto en un monitor enorme

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const newLayer = (parent) => {
    const el = document.createElement("div");
    el.className = "starfield";
    el.setAttribute("aria-hidden", "true");
    parent.appendChild(el);
    return el;
  };

  // el cielo de siempre, detrás de todo
  let layers = [newLayer(document.body)];

  // la puerta de entrada es un panel opaco por encima de ese cielo, así que
  // lleva su propia copia: las mismas estrellas, en el mismo sitio y en el
  // mismo punto del parpadeo, para que al desvanecerse no se note el cambio.
  // (si el welcome no toca mostrarse, el módulo de arriba ya lo sacó del DOM)
  const door = document.getElementById("welcome-screen");
  if (door) layers.push(newLayer(door));

  // una sola tirada de dados para todas las capas: si cada una sorteara lo
  // suyo, al abrir la puerta el cielo saltaría de un dibujo a otro
  function roll() {
    const cols = Math.max(1, Math.round(window.innerWidth / CELL));
    const rows = Math.max(1, Math.round(window.innerHeight / CELL));
    const stars = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (stars.length >= MAX || Math.random() > FILL) continue;

        stars.push({
          glyph: pick(GLYPHS),
          // posición en % dentro de su celda: así el cielo aguanta un
          // resize chico sin tener que volver a nacer
          left: (((x + Math.random()) / cols) * 100).toFixed(2) + "%",
          top:  (((y + Math.random()) / rows) * 100).toFixed(2) + "%",
          size: rand(0.5, 1.15).toFixed(2) + "rem",
          dim:  rand(0.08, 0.3).toFixed(2),
          lit:  rand(0.55, 1).toFixed(2),
          dur:  rand(2.4, 7.5).toFixed(2) + "s",
          // delay negativo: cada una entra por un punto distinto del ciclo,
          // así no parpadean todas a la vez
          delay: "-" + rand(0, 7.5).toFixed(2) + "s",
        });
      }
    }
    return stars;
  }

  function paint(layer, stars) {
    const frag = document.createDocumentFragment();

    stars.forEach((s) => {
      const star = document.createElement("span");
      star.className = "star" + (BIG.includes(s.glyph) ? " star--big" : "");
      star.textContent = s.glyph;
      star.style.left = s.left;
      star.style.top = s.top;
      star.style.setProperty("--size", s.size);
      star.style.setProperty("--dim", s.dim);
      star.style.setProperty("--lit", s.lit);
      star.style.setProperty("--dur", s.dur);
      star.style.setProperty("--delay", s.delay);
      frag.appendChild(star);
    });

    layer.innerHTML = "";
    layer.appendChild(frag);
  }

  function build() {
    // la capa del welcome se va con él cuando entrás; no la repintamos
    layers = layers.filter((l) => l.isConnected);
    const stars = roll();
    layers.forEach((l) => paint(l, stars));
  }

  build();

  // rehacer el cielo solo si la ventana cambió de verdad: en el móvil la
  // barra del navegador dispara resizes de unos pocos px todo el tiempo
  let last = { w: window.innerWidth, h: window.innerHeight };
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (Math.abs(w - last.w) < 120 && Math.abs(h - last.h) < 120) return;
      last = { w, h };
      build();
    }, 250);
  });
})();

/* ================= small things ================= */
(function misc() {
  // last updated — honest, automatic
  const lu = document.getElementById("last-updated");
  if (lu) {
    const d = new Date(document.lastModified);
    if (!isNaN(d)) {
      lu.textContent = d.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      }).toLowerCase();
    }
  }
})();
