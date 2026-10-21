// Kleinigkeiten für alle Seiten: Hell/Dunkel-Umschalter, Sprachwechsel mit Abschnitt, Kopfzeile beim Scrollen, Nach-oben-Knopf.
(function () {
  const root = document.documentElement;
  const EN = root.lang === "en";

  // Hell/Dunkel: Wahl bleibt im Browser, ohne Wahl gilt die Einstellung des Systems.
  const dark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll("[data-theme-toggle]").forEach(b => {
    const label = () => b.setAttribute("aria-label", dark() ? (EN ? "Switch to light mode" : "Helles Design") : (EN ? "Switch to dark mode" : "Dunkles Design"));
    label();
    b.addEventListener("click", () => {
      root.dataset.theme = dark() ? "light" : "dark";
      try { localStorage.setItem("pp-theme", root.dataset.theme); } catch (e) { /* privat */ }
      label();
    });
  });

  // Sprachwechsel auf der Startseite: an denselben Abschnitt der anderen Sprache springen.
  const pairs = [["ansehen", "look"], ["ausprobieren", "try"], ["rechnung", "math"], ["funktionen", "features"], ["vergleich", "compare"],
    ["installieren", "install"], ["fahrplan", "roadmap"], ["coin", "coin"], ["fragen", "faq"]];
  document.querySelectorAll("a.lang").forEach(a => a.addEventListener("click", () => {
    const here = nearest() || location.hash.slice(1);
    const pair = pairs.find(p => p.includes(here));
    if (pair && /index\.html$/.test(a.getAttribute("href"))) a.href = a.getAttribute("href") + "#" + pair[EN ? 0 : 1];
  }));
  function nearest() {
    let best = "";
    for (const s of document.querySelectorAll("main section[id]")) if (s.getBoundingClientRect().top < innerHeight / 3) best = s.id;
    return best;
  }

  // Kopfzeile bekommt beim Scrollen eine Kante, ab einer Bildschirmhöhe erscheint „Nach oben“.
  const top = document.querySelector(".top");
  const up = document.createElement("a");
  up.href = "#";
  up.className = "to-top";
  up.setAttribute("aria-label", EN ? "Back to top" : "Nach oben");
  up.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5 10l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  up.addEventListener("click", e => { e.preventDefault(); scrollTo({top: 0}); });
  document.body.appendChild(up);
  const onScroll = () => {
    top?.classList.toggle("scrolled", scrollY > 8);
    up.classList.toggle("show", scrollY > innerHeight);
  };
  addEventListener("scroll", onScroll, {passive: true});
  onScroll();
})();

// Text kopieren (z. B. chrome://extensions), Fragen auf- und zuklappen, Screenshots groß ansehen.
(function () {
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-copy-text]");
    if (c) {
      navigator.clipboard?.writeText(c.dataset.copyText).then(() => {
        const old = c.textContent;
        c.textContent = c.dataset.done || "✓";
        setTimeout(() => (c.textContent = old), 1500);
      });
    }
    const t = e.target.closest("[data-faq-toggle]");
    if (t) {
      const all = [...document.querySelectorAll(".faq details")];
      const open = !all.every(d => d.open);
      all.forEach(d => (d.open = open));
      t.textContent = open ? t.dataset.close : t.dataset.open;
    }
    const img = e.target.closest(".shot img");
    if (img) {
      const dlg = document.createElement("dialog");
      dlg.className = "lightbox";
      const big = img.cloneNode();
      big.removeAttribute("loading");
      dlg.append(big);
      dlg.addEventListener("click", () => dlg.close());
      dlg.addEventListener("close", () => dlg.remove());
      document.body.append(dlg);
      dlg.showModal();
    }
  });
})();

// Änderungen: # neben der Version kopiert den Link dorthin.
document.addEventListener("click", e => {
  const a = e.target.closest("[data-copy-link]");
  if (!a || !navigator.clipboard) return;
  e.preventDefault();
  const url = location.href.split("#")[0] + a.getAttribute("href");
  history.replaceState(null, "", a.getAttribute("href"));
  navigator.clipboard.writeText(url).then(() => { a.textContent = "✓"; setTimeout(() => (a.textContent = "#"), 1500); });
});

// Anleitung: im mitlaufenden Inhaltsverzeichnis den aktuellen Abschnitt markieren.
(function () {
  const toc = document.querySelector(".toc.sticky");
  if (!toc || !("IntersectionObserver" in window)) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    links.forEach(a => a.classList.remove("on"));
    const a = map.get(en.target.id);
    if (a) { a.classList.add("on"); a.scrollIntoView({block: "nearest", inline: "nearest"}); }
  }), {rootMargin: "0px 0px -70% 0px"});
  map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
})();
