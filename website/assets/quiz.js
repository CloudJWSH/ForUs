// Quiz auf der Grundlagen-Seite: auswerten, falsche Antworten mit Link zur Erklärung. Nichts wird gespeichert.
(function () {
  const form = document.getElementById("quiz-form");
  if (!form) return;
  const EN = document.documentElement.lang === "en";
  const out = form.querySelector(".quiz-result");
  const qs = [...form.querySelectorAll("fieldset.q")];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
  form.addEventListener("submit", e => {
    e.preventDefault();
    let right = 0;
    const wrong = [];
    qs.forEach((f, i) => {
      const pick = f.querySelector("input:checked");
      const ok = pick && pick.value === f.dataset.ok;
      f.classList.toggle("right", !!ok);
      f.classList.toggle("wrong", !ok);
      if (ok) right++;
      else wrong.push(`<li>${EN ? "Question" : "Frage"} ${i + 1}${pick ? "" : EN ? " (no answer)" : " (keine Antwort)"}: <a href="${esc(f.dataset.link)}">${esc(f.dataset.term)}</a></li>`);
    });
    const head = EN ? `${right} of ${qs.length} right.` : `${right} von ${qs.length} richtig.`;
    const more = wrong.length ? `<p>${EN ? "Read up on:" : "Zum Nachlesen:"}</p><ul>${wrong.join("")}</ul>` : `<p>${EN ? "All right. The lab is waiting." : "Alles richtig. Das Labor wartet."}</p>`;
    out.innerHTML = `<p><b>${head}</b></p>${more}`;
    out.hidden = false;
    out.scrollIntoView({block: "nearest"});
  });
  form.addEventListener("reset", () => {
    qs.forEach(f => f.classList.remove("right", "wrong"));
    out.hidden = true;
  });
})();
