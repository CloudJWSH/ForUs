// Rechner teilen: Eingaben stehen in der Adresse (?r-amt=0.5&…), ein Knopf kopiert den Link.
// Muss vor rechner.js bzw. stop.js laden, damit die Werte aus dem Link schon in den Feldern stehen.
(function () {
  const EN = document.documentElement.lang === "en";
  const params = new URLSearchParams(location.search);
  document.querySelectorAll("form.calc-tool[id]").forEach(form => {
    const inputs = [...form.querySelectorAll("input[id], select[id]")];
    const defaults = new Map(inputs.map(i => [i.id, i.tagName === "SELECT" ? (i.querySelector("option[selected]") || i.options[0]).value : i.defaultValue]));
    let used = false;
    for (const i of inputs) {
      const v = params.get(i.id);
      const fits = i.tagName === "SELECT" ? [...i.options].some(o => o.value === v) : v !== "" && isFinite(Number(v));
      if (v !== null && fits) { i.value = v; used = true; }
    }
    if (used) requestAnimationFrame(() => form.scrollIntoView({block: "start"}));

    const link = () => {
      const q = new URLSearchParams();
      for (const i of inputs) if (i.value !== defaults.get(i.id)) q.set(i.id, i.value);
      const s = q.toString();
      return location.href.split(/[?#]/)[0] + (s ? "?" + s : "") + "#" + form.id;
    };
    const keep = () => {
      try { history.replaceState(null, "", link()); } catch (e) { /* file:// oder Vorschau */ }
    };
    form.addEventListener("input", keep);
    form.addEventListener("change", keep);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "k-link share-link";
    btn.textContent = EN ? "Copy link to this calculation" : "Link zu dieser Rechnung kopieren";
    btn.addEventListener("click", () => {
      const done = () => { btn.textContent = EN ? "Link copied" : "Link kopiert"; setTimeout(() => (btn.textContent = EN ? "Copy link to this calculation" : "Link zu dieser Rechnung kopieren"), 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(link()).then(done, () => prompt("Link", link()));
      else prompt("Link", link());
    });
    form.appendChild(btn);
  });
})();
