/* ================================================================
   404heaven — main.js
   No frameworks. Everything data-driven via CONFIG so the future
   404heaven Studio can manage content without touching the code.
   ================================================================ */

/* ================= CONFIG ================= */
const CONFIG = {
  // welcome screen: "first" = only first visit, "always" = every visit, "never" = off
  welcomeScreen: "first",

  // now playing — a real youtube playlist.
  // paste your playlist id (the part after ?list= in the url)
  playlistId: "PLAiErhOJQIk4dYgkNprVqeUZVshbw6-gf",

  // journal — your blogspot blog url, no trailing slash.
  // e.g. "https://myblog.blogspot.com". leave "" to keep manual entries.
  blogspotUrl: "",

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

/* ================= now playing (real youtube playlist) ================= */
(function nowPlaying() {
  const frame = document.getElementById("np-frame");
  if (!frame) return;

  if (!CONFIG.playlistId || CONFIG.playlistId.startsWith("PLxxx")) {
    frame.innerHTML = "<span>set your playlist id<br>in js/main.js</span>";
    return;
  }

  // load the youtube iframe api
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  let player = null;
  let timeTimer = null;

  const $ = (id) => document.getElementById(id);
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  function updateMeta() {
    if (!player || !player.getVideoData) return;
    const d = player.getVideoData();
    if (!d || !d.title) return;
    // youtube titles are usually "Artist - Song"; split politely
    const parts = d.title.split(/\s+[-–—]\s+/);
    const album = $("np-album");
    if (parts.length >= 2) {
      $("np-title").textContent = parts[0];
      $("np-track").textContent = parts.slice(1).join(" – ");
      if (album) album.textContent = d.author || "";
    } else {
      $("np-title").textContent = d.title;
      $("np-track").textContent = "";
      if (album) album.textContent = d.author || "";
    }
  }

  function tick() {
    if (!player || !player.getCurrentTime) return;
    $("np-time").textContent =
      fmt(player.getCurrentTime()) + " / " + fmt(player.getDuration());
  }

  window.onYouTubeIframeAPIReady = function () {
    frame.innerHTML = "";
    const holder = document.createElement("div");
    frame.appendChild(holder);

    player = new YT.Player(holder, {
      width: "100%",
      height: "100%",
      playerVars: {
        listType: "playlist",
        list: CONFIG.playlistId,
        controls: 0,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => { updateMeta(); tick(); },
        onStateChange: (e) => {
          updateMeta();
          const play = $("np-play");
          if (e.data === YT.PlayerState.PLAYING) {
            play.textContent = "▮▮";
            clearInterval(timeTimer);
            timeTimer = setInterval(tick, 1000);
          } else {
            play.textContent = "▶";
            clearInterval(timeTimer);
          }
        },
      },
    });

    $("np-prev").addEventListener("click", () => player.previousVideo());
    $("np-next").addEventListener("click", () => player.nextVideo());
    $("np-play").addEventListener("click", () => {
      const s = player.getPlayerState();
      s === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    });
  };
})();

/* ================= journal via blogspot =================
   Uses blogger's public json feed — no api key needed.
   Fills the homepage widget and, if present, #journal-feed
   on the journal page. */
(function blogspotJournal() {
  if (!CONFIG.blogspotUrl) return;

  const feedUrl =
    CONFIG.blogspotUrl.replace(/\/$/, "") +
    "/feeds/posts/default?alt=json&max-results=10";

  fetch(feedUrl)
    .then((r) => r.json())
    .then((data) => {
      const entries = (data.feed && data.feed.entry) || [];
      if (!entries.length) return;

      const parse = (e) => ({
        title: e.title.$t,
        date: (e.published.$t || "").slice(0, 10),
        html: e.content ? e.content.$t : (e.summary ? e.summary.$t : ""),
        url: (e.link.find((l) => l.rel === "alternate") || {}).href || "#",
      });

      // homepage widget
      const hjTitle = document.getElementById("hj-title");
      if (hjTitle) {
        const p = parse(entries[0]);
        hjTitle.textContent = p.title;
        document.getElementById("hj-date").textContent = p.date;
        const body = document.getElementById("hj-body");
        const tmp = document.createElement("div");
        tmp.innerHTML = p.html;
        const text = tmp.textContent.trim().slice(0, 220);
        body.innerHTML = "";
        const para = document.createElement("p");
        para.textContent = text + (tmp.textContent.length > 220 ? "…" : "");
        body.appendChild(para);
      }

      // journal page list
      const feed = document.getElementById("journal-feed");
      if (feed) {
        feed.innerHTML = "";
        entries.map(parse).forEach((p, i) => {
          const art = document.createElement("article");
          art.className = "win";
          art.innerHTML =
            '<div class="win__bar"><span class="icon">✎</span>' +
            '<span class="title">entry</span>' +
            '<span class="win__btns" aria-hidden="true"><span>–</span><span>×</span></span></div>';
          const body = document.createElement("div");
          body.className = "win__body";

          const h = document.createElement("h2");
          h.className = "jp-title";
          h.textContent = p.title;
          const d = document.createElement("p");
          d.className = "jp-date";
          d.textContent = p.date;
          const hr = document.createElement("hr");
          hr.className = "dotrule";
          const div = document.createElement("div");
          div.className = "jp-body";
          const tmp = document.createElement("div");
          tmp.innerHTML = p.html;
          const para = document.createElement("p");
          para.textContent = tmp.textContent.trim().slice(0, 400) + "…";
          div.appendChild(para);
          const a = document.createElement("a");
          a.className = "blink";
          a.href = p.url;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = "[ read full post → ]";

          body.append(h, d, hr, div, a);
          art.appendChild(body);
          feed.appendChild(art);
        });
      }
    })
    .catch(() => {
      /* feed unreachable — the manual entries stay, no drama */
    });
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

    // si la foto ya vive dentro de un enlace (el widget de la home), el clic
    // es del enlace: abrir el lightbox además solo pisaría la navegación
    if (img.closest("a")) {
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
