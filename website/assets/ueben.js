// Üben: Gewohnheiten und Wochenplan abhaken, Notizen je Übung. Alles bleibt nur in diesem Browser.
(function () {
  const lists = [...document.querySelectorAll("ol.practice[data-key]")];
  if (!lists.length) return;
  const EN = document.documentElement.lang === "en";
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat */ } };
  const views = lists.map(ol => {
    const week = ol.classList.contains("week");
    const items = [...ol.children];
    const out = document.querySelector(week ? "[data-progress-week]" : "[data-progress-habits]");
    const key = ol.dataset.key, nkey = ol.dataset.notes;
    let done = load(key, []);
    const notes = nkey ? load(nkey, {}) : {};
    const show = () => { if (out) out.textContent = week
      ? (EN ? `${done.length} of ${items.length} exercises done` : `${done.length} von ${items.length} Übungen gemacht`)
      : (EN ? `${done.length} of ${items.length} habits checked` : `${done.length} von ${items.length} Gewohnheiten abgehakt`); };
    const boxes = items.map((li, i) => {
      const id = key + "-" + i;
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = id;
      box.checked = done.includes(i);
      const label = document.createElement("label");
      label.htmlFor = id;
      label.className = "habit";
      label.append(box, document.createTextNode(week ? (EN ? " Done" : " Gemacht") : (EN ? " Doing this" : " Mache ich")));
      li.append(label);
      li.classList.toggle("checked", box.checked);
      box.addEventListener("change", () => {
        done = box.checked ? [...new Set([...done, i])] : done.filter(x => x !== i);
        li.classList.toggle("checked", box.checked);
        save(key, done);
        show();
      });
      if (nkey) {
        const ta = document.createElement("textarea");
        ta.rows = 2;
        ta.className = "note-in";
        ta.setAttribute("aria-label", (EN ? "Note: " : "Notiz: ") + li.querySelector("h3").textContent);
        ta.placeholder = EN ? "Your note …" : "Deine Notiz …";
        ta.value = notes[i] || "";
        ta.addEventListener("input", () => { notes[i] = ta.value; save(nkey, notes); });
        li.append(ta);
      }
      return box;
    });
    show();
    return {reset() { done = []; boxes.forEach(b => { b.checked = false; b.closest("li").classList.remove("checked"); });
      if (nkey) { Object.keys(notes).forEach(k => delete notes[k]); save(nkey, notes); ol.querySelectorAll("textarea").forEach(t => (t.value = "")); }
      save(key, done); show(); }};
  });
  document.querySelector("[data-practice-reset]")?.addEventListener("click", () => {
    if (confirm(EN ? "Clear all checks and notes on this page?" : "Alle Haken und Notizen auf dieser Seite löschen?")) views.forEach(v => v.reset());
  });
})();
