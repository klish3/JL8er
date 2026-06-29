/* JL8 reader — vanilla JS, no dependencies.
   Reads web/comics.json (a prebuilt index of every comic and its panels),
   then renders a fast client-side reader with routing, preloading,
   resume, read-tracking, archive grid, and keyboard control. */
(() => {
  "use strict";

  const LS = {
    theme: "jl8.theme",
    last: "jl8.last",
    read: "jl8.read",
    fit: "jl8.fit",
  };

  const $ = (sel) => document.querySelector(sel);
  const el = {
    progress: $("#progressbar"),
    reader: $("#reader"),
    archive: $("#archive"),
    stage: $("#stage"),
    strip: $("#strip"),
    title: $("#comic-title"),
    meta: $("#comic-meta"),
    counterCur: $("#counter-cur"),
    counterTotal: $("#counter-total"),
    grid: $("#grid"),
    toast: $("#toast"),
    bigNext: $("#big-next"),
    aboutCount: $("#about-count"),
  };

  const state = {
    base: "",
    comics: [],        // [{id, title, panels:[...], chapters?}]
    byId: new Map(),
    current: null,     // comic id
    read: new Set(),
    fit: localStorage.getItem(LS.fit) || "width",  // "width" | "actual"
    unreadOnly: false,
    touch: null,
  };

  /* ---------- persistence ---------- */
  function loadRead() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS.read) || "[]");
      state.read = new Set(raw);
    } catch { state.read = new Set(); }
  }
  function saveRead() {
    localStorage.setItem(LS.read, JSON.stringify([...state.read]));
  }
  function markRead(id) {
    if (!state.read.has(id)) { state.read.add(id); saveRead(); }
  }

  /* ---------- theme ---------- */
  function initTheme() {
    let t = localStorage.getItem(LS.theme);
    if (!t) t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = t;
  }
  function toggleTheme() {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    localStorage.setItem(LS.theme, t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === "dark" ? "#0b1020" : "#eef1f8";
  }

  /* ---------- progress bar / toast ---------- */
  let progTimer = null;
  function progStart() {
    clearTimeout(progTimer);
    el.progress.classList.add("show");
    el.progress.style.width = "30%";
    progTimer = setTimeout(() => (el.progress.style.width = "70%"), 200);
  }
  function progDone() {
    clearTimeout(progTimer);
    el.progress.style.width = "100%";
    setTimeout(() => {
      el.progress.classList.remove("show");
      el.progress.style.width = "0";
    }, 280);
  }
  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      setTimeout(() => (el.toast.hidden = true), 250);
    }, 2200);
  }

  /* ---------- helpers ---------- */
  const url = (file) => state.base + file;
  const clampId = (id) => Math.min(state.comics.length, Math.max(1, id));
  const firstPanel = (comic) => comic.panels[0];

  /* ---------- reader rendering ---------- */
  function buildPanelNode(file) {
    const wrap = document.createElement("div");
    wrap.className = "panel-wrap skeleton";
    const img = new Image();
    img.alt = "JL8 comic panel";
    img.decoding = "async";
    img.src = url(file);
    const onload = () => {
      wrap.classList.remove("skeleton");
      img.classList.add("loaded");
    };
    if (img.complete && img.naturalWidth) onload();
    else img.addEventListener("load", onload, { once: true });
    img.addEventListener("error", () => {
      wrap.classList.remove("skeleton");
      wrap.classList.add("error");
      wrap.innerHTML =
        '<div class="panel-err">Couldn’t load this panel.' +
        '<br><button>Retry</button></div>';
      wrap.querySelector("button").onclick = () => {
        const fresh = buildPanelNode(file);
        wrap.replaceWith(fresh);
      };
    }, { once: true });
    wrap.appendChild(img);
    return wrap;
  }

  function renderComic(id, { push = true, scroll = true } = {}) {
    const comic = state.byId.get(id);
    if (!comic) return;
    state.current = id;

    progStart();
    el.strip.innerHTML = "";

    // panels — with chapter dividers when applicable
    if (comic.chapters && comic.chapters.length > 1) {
      comic.chapters.forEach((ch, i) => {
        const div = document.createElement("div");
        div.className = "chapter-divider";
        div.textContent = `Part ${i + 1}`;
        el.strip.appendChild(div);
        ch.forEach((f) => el.strip.appendChild(buildPanelNode(f)));
      });
    } else {
      comic.panels.forEach((f) => el.strip.appendChild(buildPanelNode(f)));
    }

    // when the last panel image settles, finish the progress bar
    const imgs = [...el.strip.querySelectorAll("img")];
    let pending = imgs.length;
    const tick = () => { if (--pending <= 0) progDone(); };
    imgs.forEach((im) => {
      if (im.complete) tick();
      else { im.addEventListener("load", tick, { once: true }); im.addEventListener("error", tick, { once: true }); }
    });
    if (!imgs.length) progDone();

    // header / counter
    el.title.textContent = comic.title;
    const n = comic.panels.length;
    el.meta.textContent = `${n} panel${n === 1 ? "" : "s"}`;
    el.counterCur.textContent = id;

    // nav button states
    setNavState(id);

    showView("reader");
    if (scroll) { el.reader.scrollIntoView({ block: "start" }); window.scrollTo(0, 0); }

    markRead(id);
    localStorage.setItem(LS.last, String(id));

    if (push) setHash(`/c/${id}`);
    document.title = `${comic.title} — JL8 reader`;

    preloadNeighbors(id);
  }

  function setNavState(id) {
    const isFirst = id <= 1;
    const isLast = id >= state.comics.length;
    $("#btn-first").disabled = isFirst;
    $("#btn-prev").disabled = isFirst;
    $("#edge-prev").disabled = isFirst;
    $("#btn-next").disabled = isLast;
    $("#btn-last").disabled = isLast;
    $("#edge-next").disabled = isLast;
    el.bigNext.disabled = isLast;
    el.bigNext.firstChild.textContent = isLast ? "You’re all caught up " : "Next page ";
  }

  const preloadCache = new Set();
  function preload(file) {
    if (preloadCache.has(file)) return;
    preloadCache.add(file);
    const im = new Image();
    im.src = url(file);
  }
  function preloadNeighbors(id) {
    [id + 1, id - 1].forEach((nid) => {
      const c = state.byId.get(nid);
      if (c) c.panels.slice(0, 3).forEach(preload);
    });
  }

  /* ---------- navigation ---------- */
  function go(id, opts) {
    id = clampId(id);
    if (id === state.current && el.archive.hidden) return;
    renderComic(id, opts);
  }
  const next = () => { if (state.current < state.comics.length) go(state.current + 1); };
  const prev = () => { if (state.current > 1) go(state.current - 1); };

  function jumpPrompt() {
    const ans = prompt(`Jump to which comic? (1–${state.comics.length})`, state.current);
    if (ans == null) return;
    const num = parseInt(ans, 10);
    if (Number.isFinite(num) && num >= 1 && num <= state.comics.length) go(num);
    else toast("That number isn’t in range.");
  }

  /* ---------- archive ---------- */
  let archiveBuilt = false;
  let io = null;
  function buildArchive() {
    if (archiveBuilt) return;
    archiveBuilt = true;
    const frag = document.createDocumentFragment();
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const card = e.target;
        const img = card.querySelector("img");
        if (img && img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
          img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
        }
        io.unobserve(card);
      }
    }, { rootMargin: "400px" });

    state.comics.forEach((c) => {
      const card = document.createElement("button");
      card.className = "card";
      card.dataset.id = c.id;
      card.title = c.title;
      const img = document.createElement("img");
      img.alt = c.title;
      img.dataset.src = url(firstPanel(c));
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = "#" + c.id;
      const dot = document.createElement("span");
      dot.className = "read-dot";
      card.append(img, num, dot);
      card.onclick = () => go(c.id);
      frag.appendChild(card);
      io.observe(card);
    });
    el.grid.appendChild(frag);
  }

  function refreshArchiveRead() {
    el.grid.querySelectorAll(".card").forEach((card) => {
      const id = +card.dataset.id;
      card.classList.toggle("read", state.read.has(id));
      if (state.unreadOnly) card.style.display = state.read.has(id) ? "none" : "";
      else card.style.display = "";
    });
  }

  function openArchive() {
    buildArchive();
    refreshArchiveRead();
    showView("archive");
    setHash("/archive");
    document.title = "Archive — JL8 reader";
    // scroll the current comic into view in the grid
    const cur = el.grid.querySelector(`.card[data-id="${state.current}"]`);
    if (cur) cur.scrollIntoView({ block: "center" });
  }

  /* ---------- views ---------- */
  function showView(which) {
    const reader = which === "reader";
    el.reader.hidden = false; // reader stays in flow; toggle via display
    el.reader.style.display = reader ? "" : "none";
    el.archive.hidden = which !== "archive";
    $("#navctl").style.visibility = reader ? "visible" : "hidden";
  }

  /* ---------- about modal ---------- */
  function openAbout() { $("#about").hidden = false; }
  function closeAbout() { $("#about").hidden = true; }

  /* ---------- routing ---------- */
  let suppressHash = false;
  function setHash(h) {
    suppressHash = true;
    location.hash = "#" + h;
    setTimeout(() => (suppressHash = false), 0);
  }
  function route() {
    if (suppressHash) return;
    const h = location.hash.replace(/^#/, "");
    const mC = h.match(/^\/c\/(\d+)/);
    if (mC) { go(clampId(+mC[1]), { push: false }); return; }
    if (h === "/archive") { openArchive(); return; }
    if (h === "/about") { renderDefault(); openAbout(); return; }
    renderDefault();
  }
  function renderDefault() {
    const last = parseInt(localStorage.getItem(LS.last) || "", 10);
    const start = Number.isFinite(last) && state.byId.has(last) ? last : 1;
    go(start, { push: false });
  }

  /* ---------- input ---------- */
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (!$("#about").hidden && e.key !== "Escape") return;

    switch (e.key) {
      case "ArrowRight": case " ": e.preventDefault(); next(); break;
      case "ArrowLeft": prev(); break;
      case "Home": e.preventDefault(); go(1); break;
      case "End": e.preventDefault(); go(state.comics.length); break;
      case "a": case "A": openArchive(); break;
      case "g": case "G": jumpPrompt(); break;
      case "w": case "W": cycleFit(); break;
      case "t": case "T": toggleTheme(); break;
      case "?": openAbout(); break;
      case "Escape": closeAbout(); break;
      default: return;
    }
  }

  function cycleFit() {
    state.fit = state.fit === "width" ? "actual" : "width";
    localStorage.setItem(LS.fit, state.fit);
    applyFit();
    toast(state.fit === "width" ? "Fit to width" : "Actual size");
  }
  function applyFit() {
    el.strip.parentElement.classList.toggle("fit-width", state.fit === "width");
    el.strip.parentElement.classList.toggle("fit-actual", state.fit === "actual");
  }

  function initTouch() {
    const area = el.reader;
    area.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) { state.touch = null; return; }
      state.touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    area.addEventListener("touchend", (e) => {
      if (!state.touch) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - state.touch.x;
      const dy = t.clientY - state.touch.y;
      const dt = Date.now() - state.touch.t;
      state.touch = null;
      if (dt < 600 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        if (dx < 0) next(); else prev();
      }
    }, { passive: true });
  }

  /* ---------- wire up ---------- */
  function bind() {
    $("#btn-first").onclick = () => go(1);
    $("#btn-prev").onclick = prev;
    $("#btn-next").onclick = next;
    $("#btn-last").onclick = () => go(state.comics.length);
    $("#edge-prev").onclick = prev;
    $("#edge-next").onclick = next;
    $("#big-next").onclick = next;
    $("#counter").onclick = jumpPrompt;
    $("#btn-archive").onclick = () => (el.archive.hidden ? openArchive() : go(state.current));
    $("#btn-fit").onclick = cycleFit;
    $("#btn-theme").onclick = toggleTheme;
    $("#btn-about").onclick = openAbout;
    $("#about-close").onclick = closeAbout;
    $("#about").addEventListener("click", (e) => { if (e.target.id === "about") closeAbout(); });

    $("#archive-search").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const num = parseInt(e.target.value, 10);
        if (num >= 1 && num <= state.comics.length) { e.target.value = ""; go(num); }
        else toast("That number isn’t in range.");
      }
    });
    $("#chip-unread").onclick = (e) => {
      state.unreadOnly = !state.unreadOnly;
      e.currentTarget.classList.toggle("active", state.unreadOnly);
      refreshArchiveRead();
    };
    $("#chip-clear").onclick = () => {
      if (confirm("Reset your reading history? This clears which comics are marked read.")) {
        state.read.clear(); saveRead(); refreshArchiveRead(); toast("Reading history cleared.");
      }
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", route);
    initTouch();
  }

  /* ---------- boot ---------- */
  async function boot() {
    initTheme();
    loadRead();
    bind();
    applyFit();

    try {
      const res = await fetch("comics.json", { cache: "force-cache" });
      const data = await res.json();
      state.base = data.base;
      state.comics = data.comics.filter((c) => c.panels && c.panels.length);
      state.comics.forEach((c) => state.byId.set(c.id, c));
      el.counterTotal.textContent = state.comics.length;
      if (el.aboutCount) el.aboutCount.textContent = state.comics.length;
    } catch (err) {
      el.strip.innerHTML =
        '<div class="panel-err">Couldn’t load the comic index. ' +
        'Check your connection and reload.</div>';
      progDone();
      return;
    }

    route();
  }

  boot();
})();
