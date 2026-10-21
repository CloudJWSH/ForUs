// Lexikon: Begriffe beim Tippen filtern, dazu eine A–Z-Leiste über den Begriffen.
(function () {
  const q = document.getElementById("lex-q");
  const items = [...document.querySelectorAll(".glossary > div")];
  const toc = document.querySelector(".sub .toc");
  if (!q || !items.length) return;

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
      const hit = !v || norm(el.textContent).includes(v);
      el.hidden = !hit;
      if (hit) shown++;
      const link = toc?.querySelector(`a[href="#${el.id}"]`);
      if (link) link.hidden = !hit;
    }
    document.getElementById("lex-none").hidden = shown > 0;
  });
})();
