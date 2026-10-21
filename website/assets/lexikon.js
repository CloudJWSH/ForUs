// Lexikon: Begriffe beim Tippen filtern, dazu eine A–Z-Leiste über den Begriffen.
(function () {
  const q = document.getElementById("lex-q");
  const items = [...document.querySelectorAll(".glossary > div")];
  const toc = document.querySelector(".sub .toc");
  if (!q || !items.length) return;

  // „Siehe auch“ unter jedem Begriff, aus data-see.
  const label = document.documentElement.lang === "en" ? "See also" : "Siehe auch";
  for (const el of items) {
    const ids = (el.dataset.see || "").split(" ").filter(id => document.getElementById(id));
    if (!ids.length) continue;
    const p = document.createElement("p");
    p.className = "see";
    p.innerHTML = label + ": " + ids.map(id => `<a href="#${id}">${document.getElementById(id).querySelector("dt").textContent}</a>`).join(", ");
    el.querySelector("dd").append(p);
  }

  // A–Z: Begriffe alphabetisch, Buchstaben ohne Begriff ausgegraut.
  const loc = document.documentElement.lang === "en" ? "en" : "de";
  const name = el => el.querySelector("dt").textContent.trim();
  const sorted = [...items].sort((a, b) => name(a).localeCompare(name(b), loc));
  const first = {};
  for (const el of sorted) { const l = name(el)[0].toUpperCase(); first[l] = first[l] || el.id; }
  const az = document.createElement("nav");
  az.className = "az";
  az.setAttribute("aria-label", "A–Z");
  az.innerHTML = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => first[l] ? `<a href="#${first[l]}">${l}</a>` : `<span>${l}</span>`).join("");
  q.closest("label").after(az);
  // Inhaltsverzeichnis ebenfalls alphabetisch
  if (toc) [...toc.children].sort((a, b) => a.textContent.localeCompare(b.textContent, loc)).forEach(a => toc.append(a));
  // Begriffe selbst alphabetisch
  const dl = items[0].parentElement;
  sorted.forEach(el => dl.append(el));

  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  q.addEventListener("input", () => {
    const v = norm(q.value.trim());
    let shown = 0;
    for (const el of items) {
      const hit = !v || norm(el.dataset.text ??= [...el.querySelectorAll("dt, dd")].map(n => [...n.childNodes].filter(c => !c.classList?.contains("see")).map(c => c.textContent).join("")).join(" ")).includes(v);
      el.hidden = !hit;
      if (hit) shown++;
      const link = toc?.querySelector(`a[href="#${el.id}"]`);
      if (link) link.hidden = !hit;
    }
    document.getElementById("lex-none").hidden = shown > 0;
  });
})();
