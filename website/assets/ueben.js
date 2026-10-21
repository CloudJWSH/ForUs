// Üben: jede Gewohnheit abhaken. Der Stand bleibt nur in diesem Browser.
(function () {
  const items = [...document.querySelectorAll(".steps.practice > li")];
  const out = document.querySelector("[data-progress]");
  if (!items.length) return;
  const EN = document.documentElement.lang === "en";
  const KEY = "pp-practice";
  let done = [];
  try { done = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { done = []; }
  const show = () => { out.textContent = EN ? `${done.length} of ${items.length} habits checked` : `${done.length} von ${items.length} Gewohnheiten abgehakt`; };
  items.forEach((li, i) => {
    const id = "habit-" + i;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = id;
    box.checked = done.includes(i);
    const label = document.createElement("label");
    label.htmlFor = id;
    label.className = "habit";
    label.append(box, document.createTextNode(EN ? " Doing this" : " Mache ich"));
    li.append(label);
    li.classList.toggle("checked", box.checked);
    box.addEventListener("change", () => {
      done = box.checked ? [...new Set([...done, i])] : done.filter(x => x !== i);
      li.classList.toggle("checked", box.checked);
      try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { /* privat */ }
      show();
    });
  });
  show();
})();
