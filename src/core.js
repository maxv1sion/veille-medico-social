// Cœur commun du site de veille (page Claude, GitHub Pages, fichier autonome).
// Le stockage est fourni par l'objet global Store (store-artifact.js ou store-github.js).
const DOMAINES = {
  "Médico-social": ["Personnes âgées / EHPAD","Handicap","Domicile","Enfance et famille","RH et fonction publique","Financement","Numérique et données","Qualité et droits des usagers"],
  "Droit du travail et social": ["Contrat de travail et rupture","Temps de travail et congés","Santé, sécurité et arrêts de travail","Dialogue social et salariés protégés","Rémunération et protection sociale"]
};
const THEMES = Object.values(DOMAINES).flat();
const TYPES = ["Loi","Ordonnance","Décret","Arrêté","Instruction / circulaire","Projet de loi","Proposition de loi","Jurisprudence","Guide / questions-réponses","Décision / avis"];
const domaineDe = th => Object.keys(DOMAINES).find(d => DOMAINES[d].includes(th)) || "Médico-social";
const state = {items:[],meta:{},loaded:false,period:"90",domaine:"",theme:"",type:"",q:"",from:"",to:"",editing:null};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const gras = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const sansGras = s => String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1");
const clean = s => String(s ?? "").replace(/[–—]/g, "-");
const fmt = d => { if(!d) return ""; const [y,m,j] = d.split("-").map(Number); return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtLong = d => { if(!d) return ""; const [y,m,j] = d.split("-").map(Number); const s = new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}); return j === 1 ? s.replace(/^1 /, "1er ") : s; };
const fmtNum = d => { if(!d) return ""; const [y,m,j] = d.split("-"); return `${j}/${m}/${y}`; };
const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
const host = u => { try { return new URL(u).hostname.replace(/^www\./,""); } catch(e) { return ""; } };
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function toast(m){ const t=document.createElement("div"); t.className="toast"; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),2800); }

// ---------- Filtres ----------
function range(){
  const today = new Date(); let from = "", to = iso(today);
  if(state.period === "custom"){ from = state.from; to = state.to || to; }
  else if(state.period === "year"){ from = `${today.getFullYear()}-01-01`; }
  else { const d = new Date(today); d.setDate(d.getDate() - Number(state.period)); from = iso(d); }
  return {from, to};
}
function periodLabel(){ const r = range(); return r.from ? `du ${fmtNum(r.from)} au ${fmtNum(r.to)}` : `jusqu'au ${fmtNum(r.to)}`; }
function filtered(){
  const r = range(), q = state.q.trim().toLowerCase();
  return state.items.filter(i => (!r.from || i.date >= r.from) && (!r.to || i.date <= r.to)
      && (!state.domaine || domaineDe(i.theme) === state.domaine) && (!state.theme || i.theme === state.theme)
      && (!state.type || i.type === state.type)
      && (!q || [i.titre,i.resume,i.source,i.theme,i.type,i.sujet,i.accroche,(i.points||[]).join(" "),i.reference].join(" ").toLowerCase().includes(q)))
    .sort((a,b) => b.date.localeCompare(a.date));
}

// ---------- Registre ----------
function detailHtml(i){
  const parts = [];
  if(i.points && i.points.length) parts.push(`<ul>${i.points.map(p=>`<li>${gras(p)}</li>`).join("")}</ul>`);
  if(i.application) parts.push(`<div><span class="lab">Application :</span> ${gras(i.application)}</div>`);
  if(i.impact) parts.push(`<div><span class="lab">Conséquence pour l'employeur :</span> ${gras(i.impact)}</div>`);
  if(i.etapes && i.etapes.length) parts.push(`<div class="etapes">${i.etapes.map(e=>`<span class="${e.fait?"ok":""}">${esc(e.libelle)}${e.date?" - "+esc(fmtNum(e.date)):""}${e.detail?" ("+esc(e.detail)+")":""}</span>`).join("")}</div>`);
  return parts.length ? `<details><summary>Points clés</summary><div class="det">${parts.join("")}</div></details>` : "";
}
function render(){
  const list = filtered();
  $("#countAll").textContent = state.loaded ? `${state.items.length} textes au registre` : "Chargement du registre…";
  $("#lastUpdate").textContent = state.meta?.derniereMaj ? fmt(state.meta.derniereMaj) : "non renseignée";
  $("#syncState").textContent = Store.syncText();
  const byDom = {}; list.forEach(i => { const d = domaineDe(i.theme); byDom[d] = (byDom[d]||0) + 1; });
  $("#summary").innerHTML = `<span><b>${list.length}</b> texte${list.length>1?"s":""} ${esc(periodLabel())}</span>` +
    Object.entries(byDom).map(([d,n]) => `<span>${esc(d)} <b>${n}</b></span>`).join("");
  const res = $("#results");
  if(!state.loaded){ res.innerHTML = `<div class="list"><div class="empty">Chargement des textes de veille…</div></div>`; return; }
  if(!state.items.length){ res.innerHTML = `<div class="list"><div class="empty">Le registre est vide. Les textes apparaîtront après la prochaine actualisation, ou ajoutez-en un avec « Ajouter un texte ».</div></div>`; return; }
  if(!list.length){ res.innerHTML = `<div class="list"><div class="empty">Aucun texte sur cette période avec ces filtres. Élargissez la période ou retirez un filtre.</div></div>`; return; }
  const recent = iso(new Date(Date.now() - 7*864e5)); // « Nouveau » = publié depuis moins de 7 jours
  const groups = {}; list.forEach(i => { const k = i.date.slice(0,7); (groups[k] = groups[k] || []).push(i); });
  res.innerHTML = Object.entries(groups).map(([k,arr]) => {
    const [y,m] = k.split("-"); const titre = new Date(+y,+m-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
    return `<section class="group"><h3>${esc(titre)}</h3><div class="list">${arr.map(i => `
      <article class="item ${domaineDe(i.theme)==="Médico-social"?"":"dt"}">
        <div class="date">${esc(fmt(i.date))}<small>${i.dateTexte && i.dateTexte !== i.date ? "texte du "+esc(fmtNum(i.dateTexte)) : (i.type==="Jurisprudence"?"décision":"publication")}</small></div>
        <div class="body">
          <div class="tags"><span class="tag type">${esc(i.type)}</span><span class="tag">${esc(i.theme)}</span>${(i.date||"") >= recent ? '<span class="tag new" title="Publié depuis moins de 7 jours">Nouveau</span>' : ""}${i.local ? '<span class="tag type">Ajouté sur ce poste</span>' : ""}</div>
          ${i.sujet || i.accroche ? `<div class="kicker">${esc(i.sujet || i.theme)}${i.accroche ? ` <span>· ${esc(i.accroche)}</span>` : ""}</div>` : ""}
          <p class="ref"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titre)}</a></p>
          ${i.reference ? `<div class="src"><u>${esc(i.reference)}</u></div>` : ""}
          <p class="res">${gras(i.resume)}</p>
          ${detailHtml(i)}
          <div class="src"><span>Source : ${esc(i.source || host(i.url))}</span><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(host(i.url))}</a>
            ${Store.editable(i) ? `<span class="edit"><button class="btn small" data-edit="${esc(i.id)}">Modifier</button><button class="btn small danger" data-del="${esc(i.id)}">Supprimer</button></span>` : ""}</div>
        </div>
      </article>`).join("")}</div></section>`;
  }).join("");
}

// ---------- Commandes ----------
function buildControls(){
  document.querySelectorAll("[data-only]").forEach(el => { if(el.dataset.only !== Store.kind) el.remove(); });
  const dr = $("#domRow");
  ["", ...Object.keys(DOMAINES)].forEach(d => { const b = document.createElement("button"); b.className = "chip"; b.textContent = d || "Tous"; b.dataset.d = d; b.setAttribute("aria-pressed", d === "" ? "true" : "false"); dr.appendChild(b); });
  dr.addEventListener("click", e => { const b = e.target.closest(".chip"); if(!b) return; state.domaine = b.dataset.d; dr.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c === b ? "true" : "false")); fillThemes(); render(); });
  fillThemes();
  Object.entries(DOMAINES).forEach(([d,ths]) => { const g = document.createElement("optgroup"); g.label = d; ths.forEach(t => g.appendChild(new Option(t,t))); $("#fTheme").appendChild(g); });
  TYPES.forEach(t => { $("#typeSel").add(new Option(t,t)); $("#fType").add(new Option(t,t)); });
  document.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => {
    state.period = b.dataset.p; document.querySelectorAll("[data-p]").forEach(c => c.setAttribute("aria-pressed", c === b ? "true" : "false"));
    $("#customBox").hidden = state.period !== "custom";
    if(state.period === "custom" && !state.from){ const d = new Date(); d.setDate(1); state.from = iso(d); $("#dFrom").value = state.from; $("#dTo").value = iso(new Date()); state.to = $("#dTo").value; }
    render(); }));
  $("#dFrom").addEventListener("change", e => { state.from = e.target.value; render(); });
  $("#dTo").addEventListener("change", e => { state.to = e.target.value; render(); });
  $("#themeSel").addEventListener("change", e => { state.theme = e.target.value; render(); });
  $("#typeSel").addEventListener("change", e => { state.type = e.target.value; render(); });
  $("#q").addEventListener("input", e => { state.q = e.target.value; render(); });
  $("#bMail").addEventListener("click", openMail);
  $("#closeMail").addEventListener("click", () => $("#mailPanel").hidden = true);
  $("#copyMail").addEventListener("click", () => copy(`Objet : ${$("#mailSubject").value}\n\n${$("#mailBody").value}`, $("#mailBody")));
  $("#bSources").addEventListener("click", () => { $("#srcPanel").hidden = !$("#srcPanel").hidden; });
  $("#closeSrc").addEventListener("click", () => $("#srcPanel").hidden = true);
  if($("#bAsk")){
    $("#bAsk").addEventListener("click", openAsk);
    $("#closeAsk").addEventListener("click", () => $("#askPanel").hidden = true);
    $("#copyAsk").addEventListener("click", () => copy($("#askText").value, $("#askText")));
  }
  $("#bAdd").addEventListener("click", () => openForm(null));
  $("#fCancel").addEventListener("click", () => { $("#formPanel").hidden = true; state.editing = null; });
  $("#form").addEventListener("submit", saveForm);
  $("#bPpt").addEventListener("click", exportPpt);
  $("#bDeck").addEventListener("click", openDeck);
  $("#results").addEventListener("click", onListClick);
  if(Store.extraControls) Store.extraControls();
}
function fillThemes(){
  const sel = $("#themeSel"); const cur = state.theme; sel.innerHTML = '<option value="">Tous les thèmes</option>';
  Object.entries(DOMAINES).forEach(([d,ths]) => { if(state.domaine && d !== state.domaine) return; const g = document.createElement("optgroup"); g.label = d; ths.forEach(t => g.appendChild(new Option(t,t))); sel.appendChild(g); });
  if(cur && (!state.domaine || domaineDe(cur) === state.domaine)) sel.value = cur; else state.theme = "";
}
async function copy(text, el){
  try { await navigator.clipboard.writeText(text); toast("Copié dans le presse-papiers"); }
  catch(e){ if(el){ el.focus(); el.select(); } toast("Copie bloquée : texte sélectionné, faites Ctrl+C"); }
}

// ---------- Email ----------
function openMail(){
  const list = filtered(); const by = {};
  list.forEach(i => { const k = domaineDe(i.theme) + " - " + i.theme; (by[k] = by[k] || []).push(i); });
  $("#mailSubject").value = `Veille juridique ${periodLabel()}`;
  let t = `Bonjour,\n\nVoici la synthèse de la veille juridique (secteur social et médico-social, droit du travail et droit social) ${periodLabel()} : ${list.length} texte${list.length>1?"s":""} à retenir.\n`;
  Object.keys(by).sort((a,b) => THEMES.indexOf(a.split(" - ").slice(1).join(" - ")) - THEMES.indexOf(b.split(" - ").slice(1).join(" - "))).forEach(k => {
    t += `\n${k.toUpperCase()}\n`;
    by[k].forEach(i => {
      t += `\n- ${fmtNum(i.date)} | ${clean(i.titre)}${i.reference ? " ("+clean(i.reference)+")" : ""}\n  ${clean(sansGras(i.resume))}\n`;
      if(i.application) t += `  Application : ${clean(sansGras(i.application))}\n`;
      if(i.impact) t += `  Pour l'employeur : ${clean(sansGras(i.impact))}\n`;
      t += `  Source : ${i.url}\n`;
    });
  });
  if(!list.length) t += `\nAucun nouveau texte sur la période.\n`;
  t += `\nJe reste disponible pour en discuter, notamment sur les textes qui appellent une action de notre part.\n\nCordialement,\n[Prénom] [Nom]`;
  $("#mailBody").value = t; $("#mailPanel").hidden = false; $("#mailPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
function openAsk(){
  $("#askText").value = `Fais la veille juridique ${periodLabel()}${state.domaine ? ` (domaine : ${state.domaine})` : ""}${state.theme ? ` (thème : ${state.theme})` : ""} sur des sources officielles (Journal officiel, ministère du Travail, Cour de cassation, Bulletins officiels Solidarités, CNSA, HAS, ANS, Sécurité sociale) et ajoute les nouveaux textes dans mon artefact « Veille juridique médico-social », sans doublon, avec sujet, accroche, résumé, points clés, application, conséquence pour l'employeur et lien vers la source.`;
  $("#askPanel").hidden = false; $("#askPanel").scrollIntoView({behavior:"smooth",block:"start"});
}

// ---------- Formulaire ----------
function openForm(item){
  state.editing = item ? item.id : null; $("#formTitle").textContent = item ? "Modifier le texte" : "Ajouter un texte";
  $("#fDate").value = item?.date || iso(new Date()); $("#fDateTexte").value = item?.dateTexte || "";
  $("#fType").value = item?.type || "Décret"; $("#fTheme").value = item?.theme || THEMES[0];
  $("#fSujet").value = item?.sujet || ""; $("#fAccroche").value = item?.accroche || "";
  $("#fTitre").value = item?.titre || ""; $("#fResume").value = item?.resume || "";
  $("#fPoints").value = (item?.points || []).join("\n"); $("#fApplication").value = item?.application || "";
  $("#fReference").value = item?.reference || ""; $("#fImpact").value = item?.impact || "";
  $("#fSource").value = item?.source || ""; $("#fUrl").value = item?.url || "";
  $("#formPanel").hidden = false; $("#formPanel").scrollIntoView({behavior:"smooth",block:"start"}); $("#fTitre").focus();
}
async function saveForm(e){
  e.preventDefault();
  const old = state.editing ? (state.items.find(i => i.id === state.editing) || {}) : {};
  const {id, local, ...base} = old;
  const data = {...base,
    date: $("#fDate").value, dateTexte: $("#fDateTexte").value || $("#fDate").value, type: $("#fType").value, theme: $("#fTheme").value,
    sujet: clean($("#fSujet").value.trim()), accroche: clean($("#fAccroche").value.trim()),
    titre: clean($("#fTitre").value.trim()), resume: clean($("#fResume").value.trim()),
    points: $("#fPoints").value.split("\n").map(s => clean(s.trim())).filter(Boolean),
    application: clean($("#fApplication").value.trim()), reference: clean($("#fReference").value.trim()), impact: clean($("#fImpact").value.trim()),
    source: clean($("#fSource").value.trim()) || host($("#fUrl").value), url: $("#fUrl").value.trim(),
    ajoute: base.ajoute || iso(new Date())};
  Object.keys(data).forEach(k => { if(data[k] === "" || (Array.isArray(data[k]) && !data[k].length)) delete data[k]; });
  try { await Store.save(data, state.editing); $("#formPanel").hidden = true; state.editing = null; toast("Texte enregistré"); }
  catch(err){ toast("Enregistrement impossible : " + (err?.message || "erreur")); }
}
function onListClick(e){
  const ed = e.target.closest("[data-edit]"); if(ed){ openForm(state.items.find(i => i.id === ed.dataset.edit)); return; }
  const del = e.target.closest("[data-del]"); if(!del) return;
  if(del.dataset.confirm !== "1"){ del.dataset.confirm = "1"; del.textContent = "Confirmer la suppression"; setTimeout(() => { if(del.isConnected){ del.dataset.confirm = ""; del.textContent = "Supprimer"; } }, 4000); return; }
  Store.remove(del.dataset.del).then(() => toast("Texte supprimé")).catch(err => toast("Suppression impossible : " + (err?.message || "erreur")));
}

// ---------- Modèle de diapositives (visio et PowerPoint) ----------
const sujetDe = i => i.sujet || i.theme;
const accrocheDe = i => i.accroche || `${i.type} du ${fmtLong(i.dateTexte || i.date)}`;
function slidesModel(){
  const list = filtered();
  const juris = list.filter(i => i.type === "Jurisprudence").sort((a,b) => b.date.localeCompare(a.date));
  const autres = list.filter(i => i.type !== "Jurisprudence").sort((a,b) => THEMES.indexOf(a.theme) - THEMES.indexOf(b.theme) || b.date.localeCompare(a.date));
  const toc = []; autres.forEach(i => { const s = sujetDe(i); if(!toc.includes(s)) toc.push(s); }); if(juris.length) toc.push("Jurisprudences");
  const s = [{kind:"cover"}, {kind:"toc", entries:toc}];
  autres.forEach(i => s.push({kind:"item", item:i}));
  const nbJ = Math.ceil(juris.length / 2);
  for(let k = 0; k < juris.length; k += 2) s.push({kind:"juris", items:juris.slice(k,k+2), part: nbJ > 1 ? `${k/2+1}/${nbJ}` : ""});
  s.push({kind:"end"});
  return s;
}
const dateCouv = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")} ${String(d.getMonth()+1).padStart(2,"0")} ${d.getFullYear()}`; };
const hasDetail = i => (i.points && i.points.length) || i.application || i.impact;

// ---------- Diaporama dans le navigateur ----------
let deckIdx = 0, deckSlides = [];
function openDeck(){ deckSlides = slidesModel(); deckIdx = 0; $("#deck").hidden = false; drawDeck(); }
function slideHtml(s){
  const bars = '<i class="sl-bar"></i><i class="sl-bar br"></i>';
  if(s.kind === "cover") return `<div class="slide">
    <i class="cv-sh" style="width:15cqw;height:15cqw;left:-7cqw;top:-9cqw;background:#8b0000"></i>
    <i class="cv-sh" style="width:19cqw;height:19cqw;left:65cqw;top:-13cqw;background:#fbe4e4"></i>
    <i class="cv-sh" style="width:27cqw;height:27cqw;left:72cqw;top:6cqw;background:#c08081"></i>
    <i class="cv-sh" style="width:27cqw;height:27cqw;left:80cqw;top:27cqw;background:#8b0000"></i>
    <i class="cv-sh" style="width:15cqw;height:15cqw;left:-8cqw;top:40cqw;background:#fbe4e4"></i>
    <i class="cv-sh" style="width:13cqw;height:13cqw;left:68cqw;top:51cqw;background:#c08081"></i>
    <div class="cv-mark"><span class="tri"></span>Actualités RH</div>
    <div class="cv-h"><span class="a">Veille</span><span class="b">Juridique</span></div>
    <div class="cv-dash"></div>
    <div class="cv-meta">Pôle RH - ${esc(dateCouv())}<small>Période ${esc(periodLabel())}</small></div></div>`;
  if(s.kind === "toc") return `<div class="slide"><i class="toc-bar l"></i><i class="toc-bar r"></i>
    <div class="toc-h"><span class="a">Table des</span><span class="b">MATIÈRES</span></div>
    <div class="toc-cols"><ul>${s.entries.map(e => `<li>${esc(e)}</li>`).join("") || "<li>Aucun texte sur la période</li>"}</ul></div></div>`;
  if(s.kind === "end") return `<div class="slide">
    <i class="cv-sh" style="width:13cqw;height:34cqw;left:4cqw;top:30cqw;background:#fbe4e4;transform:rotate(32deg)"></i>
    <i class="cv-sh" style="width:13cqw;height:34cqw;left:86cqw;top:-4cqw;background:#fbe4e4;transform:rotate(32deg)"></i>
    <div class="end-mark"><span class="tri"></span>Veille juridique</div><div class="end-h">À VOTRE DISPOSITION</div></div>`;
  if(s.kind === "juris") return `<div class="slide">${bars}<div class="sl-title">Jurisprudences</div><div class="sl-sub">Actualités${s.part ? " - "+s.part : ""}</div>
    <div class="sl-body wide">${s.items.map(i => `<p><span class="r">${esc(i.accroche || i.sujet || i.titre)}</span><br><u>${esc(i.reference || i.titre)}</u><br>${gras(i.resume)}</p>${i.points && i.points.length ? `<ul>${i.points.map(p => `<li>${gras(p)}</li>`).join("")}</ul>` : ""}${i.impact ? `<p><span class="l">${gras(i.impact)}</span></p>` : ""}`).join("")}</div>
    <div class="sl-src">Sources : ${s.items.map(i => esc(i.url)).join(" · ")}</div></div>`;
  const i = s.item, et = i.etapes && i.etapes.length;
  return `<div class="slide">${bars}<div class="sl-title">${esc(sujetDe(i))}</div><div class="sl-sub">${esc(accrocheDe(i))}</div>
    <div class="sl-body ${et ? "narrow" : "wide"}">
      <p><span class="r">→ ${esc(i.titre)}</span>${i.reference ? `<br><u>${esc(i.reference)}</u>` : ""}</p>
      <p>${gras(i.resume)}</p>
      ${i.points && i.points.length ? `<ul>${i.points.map(p => `<li>${gras(p)}</li>`).join("")}</ul>` : ""}
      ${i.application ? `<p><span class="l">Application :</span> ${gras(i.application)}</p>` : ""}
      ${i.impact ? `<p><span class="l">Conséquence pour l'employeur :</span> ${gras(i.impact)}</p>` : ""}
    </div>
    ${et ? `<div class="sl-where"><h4>Où en est-on ?</h4>${i.etapes.map(e => `<div class="st ${e.fait ? "ok" : ""}"><i class="ln"></i><b>${esc(e.libelle)}</b>${e.date ? `<small>${esc(fmtLong(e.date))}</small>` : ""}${e.detail ? `<small>${esc(e.detail)}</small>` : ""}</div>`).join("")}</div>` : ""}
    <div class="sl-src">Source : ${esc(i.source || host(i.url))} - ${esc(i.url)}</div></div>`;
}
function drawDeck(){ $("#deckStage").innerHTML = slideHtml(deckSlides[deckIdx]); $("#deckCount").textContent = `${deckIdx+1} / ${deckSlides.length}`; }
$("#dPrev").onclick = () => { if(deckIdx > 0){ deckIdx--; drawDeck(); } };
$("#dNext").onclick = () => { if(deckIdx < deckSlides.length-1){ deckIdx++; drawDeck(); } };
$("#dClose").onclick = () => { $("#deck").hidden = true; if(document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
$("#dFull").onclick = () => { const el = $("#deck"); (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).catch(() => toast("Plein écran indisponible ici")); };
document.addEventListener("keydown", e => { if($("#deck").hidden) return; if(e.key === "ArrowRight" || e.key === " "){ e.preventDefault(); $("#dNext").click(); } if(e.key === "ArrowLeft") $("#dPrev").click(); if(e.key === "Escape") $("#dClose").click(); });

// ---------- PowerPoint (même mise en page que le modèle Canva) ----------
const C = {red:"8B0000", rose:"C08081", blush:"FBE4E4", ink:"111111", text:"1A1A1A", grey:"6B6B6B", line:"D9D9D9", ok:"2E8B57"};
const F = "Poppins";
function runs(s, opt){ // découpe **gras** en segments PowerPoint
  const out = []; String(s ?? "").split(/(\*\*.+?\*\*)/).forEach(seg => { if(!seg) return; const b = /^\*\*(.+)\*\*$/.exec(seg); out.push({text: clean(b ? b[1] : seg), options: {...opt, ...(b ? {bold:true, color:"000000"} : {})}}); });
  return out.length ? out : [{text:"", options:{...opt}}];
}
function para(parts, popt){ // un paragraphe = suite de segments, saut de ligne à la fin
  const r = parts.flat().map(x => ({text:x.text, options:{...popt, ...x.options}}));
  r[r.length-1].options.breakLine = true; return r;
}
function addMark(p, sl, x, y, label, size){
  sl.addShape(p.ShapeType.rtTriangle, {x, y, w:0.34, h:0.34, rotate:-120, fill:{color:C.red}, line:{color:C.red, width:0}});
  sl.addShape(p.ShapeType.rtTriangle, {x:x+0.13, y:y+0.12, w:0.24, h:0.24, rotate:-120, fill:{color:C.rose}, line:{color:C.rose, width:0}});
  sl.addText(label, {x:x+0.55, y:y-0.08, w:6, h:0.5, fontFace:F, fontSize:size, bold:true, italic:true, color:C.ink});
}
function rr(p, sl, x, y, w, h, color, rotate, radius){ sl.addShape(p.ShapeType.roundRect, {x, y, w, h, rotate:rotate||0, rectRadius:radius ?? 0.25, fill:{color}, line:{color, width:0}}); }
function cadre(p, sl, titre, sous){
  rr(p, sl, -0.4, 0.26, 2.65, 0.5, C.red, 0, 0.5);
  rr(p, sl, 10.55, 7.0, 3.2, 0.5, C.red, 0, 0.5);
  sl.addText(clean(titre).toUpperCase(), {x:2.4, y:0.08, w:8.55, h:0.6, align:"center", fontFace:F, fontSize:22, bold:true, color:C.ink, fit:"shrink"});
  sl.addShape(p.ShapeType.line, {x:3.35, y:0.7, w:6.65, h:0, line:{color:C.ink, width:1.5}});
  if(sous) sl.addText(clean(sous), {x:0.9, y:0.78, w:11.5, h:0.6, align:"center", fontFace:F, fontSize:18, bold:true, color:C.red, fit:"shrink"});
}
async function exportPpt(){
  if(typeof PptxGenJS === "undefined"){ toast("Le module PowerPoint n'a pas pu se charger"); return; }
  const p = new PptxGenJS(); p.layout = "LAYOUT_WIDE"; p.author = "[Prénom] [Nom]"; p.company = "OCD"; p.title = `Veille juridique ${periodLabel()}`;
  const base = {fontFace:F, fontSize:14, color:C.text};
  slidesModel().forEach(s => {
    const sl = p.addSlide(); sl.background = {color:"FFFFFF"};
    if(s.kind === "cover"){
      rr(p, sl, -1.0, -1.25, 2.1, 2.1, C.red, 45, 0.3);
      rr(p, sl, 8.75, -1.75, 2.6, 2.6, C.blush, 45, 0.3);
      rr(p, sl, 9.65, 0.55, 3.6, 3.6, C.rose, 45, 0.3);
      rr(p, sl, 10.75, 3.55, 3.6, 3.6, C.red, 45, 0.3);
      rr(p, sl, -1.1, 5.4, 2.0, 2.0, C.blush, 45, 0.3);
      rr(p, sl, 9.1, 6.8, 1.8, 1.8, C.rose, 45, 0.3);
      addMark(p, sl, 2.15, 1.0, "Actualités RH", 20);
      sl.addText("VEILLE", {x:1.95, y:1.85, w:8, h:1.2, fontFace:F, fontSize:66, bold:true, color:C.ink, margin:0});
      sl.addText("JURIDIQUE", {x:1.95, y:2.95, w:9.5, h:1.2, fontFace:F, fontSize:66, bold:true, color:C.red, charSpacing:14, margin:0});
      sl.addShape(p.ShapeType.line, {x:2.0, y:4.25, w:6.4, h:0, line:{color:C.ink, width:2, dashType:"dash"}});
      sl.addText([{text:`Pôle RH - ${dateCouv()}`, options:{fontSize:18, color:"333333", breakLine:true}}, {text:`Période ${periodLabel()}`, options:{fontSize:12, color:C.grey}}], {x:2.0, y:5.05, w:7, h:0.9, fontFace:F, charSpacing:1, margin:0});
      return;
    }
    if(s.kind === "toc"){
      rr(p, sl, -0.4, 1.0, 0.95, 5.5, C.red, 0, 0.5);
      rr(p, sl, 12.78, 1.0, 0.95, 5.5, C.red, 0, 0.5);
      sl.addText("Table des", {x:0, y:0.05, w:13.33, h:0.85, align:"center", fontFace:F, fontSize:42, bold:true, color:C.ink, margin:0});
      sl.addText("MATIÈRES", {x:0, y:0.85, w:13.33, h:0.9, align:"center", fontFace:F, fontSize:46, bold:true, color:C.red, charSpacing:12, margin:0});
      sl.addShape(p.ShapeType.line, {x:3.33, y:1.8, w:6.67, h:0, line:{color:C.ink, width:1.5}});
      const e = s.entries.length ? s.entries : ["Aucun texte sur la période"], moit = Math.ceil(e.length/2), fs = e.length <= 14 ? 16 : e.length <= 22 ? 13 : 11;
      [e.slice(0,moit), e.slice(moit)].forEach((col, k) => { if(!col.length) return;
        sl.addText(col.map(t => ({text:clean(t), options:{bullet:true, breakLine:true}})), {x:k ? 6.85 : 0.95, y:2.05, w:5.6, h:4.9, valign:"top", fontFace:F, fontSize:fs, color:"333333", paraSpaceAfter:10, fit:"shrink"}); });
      return;
    }
    if(s.kind === "end"){
      rr(p, sl, 0.35, 3.6, 1.5, 4.4, C.blush, 32, 0.3);
      rr(p, sl, 11.35, -0.6, 1.5, 4.4, C.blush, 32, 0.3);
      addMark(p, sl, 4.55, 2.95, "Veille juridique", 30);
      sl.addText("À VOTRE DISPOSITION", {x:0, y:3.9, w:13.33, h:1.0, align:"center", fontFace:F, fontSize:44, bold:true, color:C.red});
      return;
    }
    if(s.kind === "juris"){
      cadre(p, sl, "Jurisprudences", `Actualités${s.part ? " - "+s.part : ""}`);
      const t = [];
      s.items.forEach((i, k) => {
        if(k) t.push(...para([{text:" ", options:{}}], {}));
        t.push(...para([{text:clean(i.accroche || i.sujet || i.titre), options:{bold:true, color:C.rose}}], {}));
        t.push(...para([{text:clean(i.reference || i.titre), options:{underline:{style:"sng"}}}], {}));
        t.push(...para(runs(i.resume, {}), {}));
        (i.points || []).forEach(pt => t.push(...para(runs(pt, {}), {bullet:true})));
        if(i.impact) t.push(...para(runs(i.impact, {bold:true, color:C.red}), {}));
      });
      sl.addText(t, {...base, x:0.45, y:1.45, w:12.4, h:5.45, valign:"top", align:"justify", fontSize:13, paraSpaceAfter:3, fit:"shrink"});
      sl.addText("Sources : " + s.items.map(i => i.url).join("  ·  "), {x:0.45, y:6.98, w:9.9, h:0.35, fontFace:F, fontSize:8, color:C.grey});
      return;
    }
    const i = s.item, et = i.etapes && i.etapes.length;
    cadre(p, sl, sujetDe(i), accrocheDe(i));
    const t = [];
    t.push(...para([{text:"→ " + clean(i.titre), options:{bold:true, color:C.rose}}], {}));
    if(i.reference) t.push(...para([{text:clean(i.reference), options:{underline:{style:"sng"}}}], {}));
    t.push(...para(runs(i.resume, {}), {paraSpaceBefore:6}));
    (i.points || []).forEach((pt, k) => t.push(...para(runs(pt, {}), {bullet:true, paraSpaceBefore:k ? 0 : 6})));
    if(i.application) t.push(...para([{text:"Application : ", options:{bold:true, color:C.red}}, ...runs(i.application, {})], {paraSpaceBefore:8}));
    if(i.impact) t.push(...para([{text:"Conséquence pour l'employeur : ", options:{bold:true, color:C.red}}, ...runs(i.impact, {})], {paraSpaceBefore:8}));
    sl.addText(t, {...base, x:0.55, y:1.45, w:et ? 8.75 : 12.25, h:5.4, valign:"top", align:"justify", paraSpaceAfter:3, lineSpacingMultiple:1.1, fit:"shrink"});
    if(et){
      sl.addText("Où en est-on ?", {x:9.75, y:1.55, w:3.4, h:0.6, fontFace:F, fontSize:24, bold:true, color:"222222"});
      let y = 2.4; const pas = Math.min(1.45, 4.3 / i.etapes.length);
      i.etapes.forEach((e, k) => {
        sl.addShape(p.ShapeType.rect, {x:9.8, y:y+0.05, w:0.24, h:0.24, fill:{color:"FFFFFF"}, line:{color:e.fait ? C.ok : "9A9A9A", width:1.5}});
        if(e.fait) sl.addText("✓", {x:9.76, y:y-0.04, w:0.34, h:0.34, fontFace:"Segoe UI Symbol", fontSize:13, bold:true, color:C.ok, align:"center", margin:0});
        if(k < i.etapes.length - 1) sl.addShape(p.ShapeType.line, {x:9.92, y:y+0.38, w:0, h:pas-0.45, line:{color:e.fait ? C.ok : C.line, width:2}});
        const lines = [{text:clean(e.libelle), options:{bold:true, fontSize:15, color:e.fait ? "222222" : "8A8A8A", breakLine:true}}];
        if(e.date) lines.push({text:fmtLong(e.date), options:{fontSize:11, color:C.grey, breakLine:true}});
        if(e.detail) lines.push({text:clean(e.detail), options:{fontSize:11, color:C.grey}});
        sl.addText(lines, {x:10.2, y:y-0.05, w:3.0, h:pas-0.05, valign:"top", fontFace:F, margin:0});
        y += pas;
      });
    }
    sl.addText([{text:`Source : ${clean(i.source || host(i.url))} - `, options:{}}, {text:i.url, options:{hyperlink:{url:i.url}, color:C.red}}], {x:0.55, y:6.98, w:9.8, h:0.35, fontFace:F, fontSize:8, color:C.grey});
  });
  try {
    const r = range();
    const blob = await p.write({outputType:"blob"});
    await Store.saveFile(`Veille_juridique_${r.from || "debut"}_${r.to}.pptx`, blob);
    toast("PowerPoint enregistré");
  } catch(err){ if(err?.code !== "declined") toast("Export impossible : " + (err?.message || "erreur")); }
}

// ---------- Démarrage ----------
buildControls(); render(); Store.start();
