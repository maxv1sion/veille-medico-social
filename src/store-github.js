// Stockage du site GitHub Pages et du fichier autonome : registre.json du dépôt,
// plus les textes ajoutés à la main, gardés dans ce navigateur.
const Store = {
  kind: "github",
  REMOTE: "https://raw.githubusercontent.com/maxv1sion/veille-medico-social/main/registre.json",
  LOCAL: "veille-ms-ajouts-locaux-v1", CACHE: "veille-ms-cache-github-v1",
  remote: [], local: [], sync: "",
  start(){
    try { this.local = JSON.parse(localStorage.getItem(this.LOCAL) || "[]"); } catch(e){ this.local = []; }
    let cache = null; try { cache = JSON.parse(localStorage.getItem(this.CACHE) || "null"); } catch(e){}
    const src = cache || (typeof SEED !== "undefined" ? SEED : {items:[], meta:{}});
    this.remote = src.items || []; state.meta = src.meta || {}; this.sync = "Chargement…";
    this.merge(); state.loaded = true; render(); this.fetch();
  },
  merge(){
    const urls = new Set(this.local.map(i => i.url));
    state.items = [...this.remote.filter(i => !urls.has(i.url)).map(i => ({...i, local:false})), ...this.local.map(i => ({...i, local:true}))];
  },
  async fetch(){
    try {
      const r = await fetch(this.REMOTE + "?t=" + Date.now(), {cache:"no-store"});
      if(!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      this.remote = d.items || []; state.meta = d.meta || {}; this.sync = "Registre à jour depuis GitHub";
      try { localStorage.setItem(this.CACHE, JSON.stringify(d)); } catch(e){}
    } catch(e){ this.sync = "GitHub injoignable : dernière copie affichée"; }
    this.merge(); render();
  },
  persist(){ try { localStorage.setItem(this.LOCAL, JSON.stringify(this.local)); } catch(e){ toast("Sauvegarde locale impossible : pensez à exporter le registre"); } },
  syncText(){ return this.sync; },
  editable(i){ return !!(i && i.local); },
  async save(data, id){
    if(id){ const k = this.local.findIndex(i => i.id === id); if(k >= 0) this.local[k] = {id, ...data}; }
    else this.local.push({id:uid(), ...data});
    this.persist(); this.merge(); render();
  },
  async remove(id){ this.local = this.local.filter(i => i.id !== id); this.persist(); this.merge(); render(); },
  async saveFile(name, blob){
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  },
  extraControls(){
    document.querySelector("#bExport").addEventListener("click", () => this.saveFile(`Registre_veille_${iso(new Date())}.json`,
      new Blob([JSON.stringify({items:state.items.map(({local, ...i}) => i), meta:state.meta}, null, 2)], {type:"application/json"})));
    document.querySelector("#bImport").addEventListener("click", () => document.querySelector("#fileImport").click());
    document.querySelector("#fileImport").addEventListener("change", e => {
      const f = e.target.files[0]; if(!f) return; const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result); const arr = Array.isArray(d) ? d : (d.items || []);
          const keys = new Set(state.items.flatMap(i => [i.url, String(i.titre).toLowerCase()])); let n = 0;
          arr.forEach(i => { if(!i || !i.date || !i.titre || !i.url) return; if(keys.has(i.url) || keys.has(String(i.titre).toLowerCase())) return;
            const {local, ...rest} = i; this.local.push({...rest, id:i.id || uid(), type:TYPES.includes(i.type) ? i.type : "Décret", theme:THEMES.includes(i.theme) ? i.theme : THEMES[0], ajoute:i.ajoute || iso(new Date())});
            keys.add(i.url); keys.add(String(i.titre).toLowerCase()); n++; });
          this.persist(); this.merge(); render(); toast(`${n} texte${n>1?"s":""} ajouté${n>1?"s":""} (doublons ignorés)`);
        } catch(err){ toast("Fichier illisible : choisissez un fichier .json exporté depuis ce registre"); }
        e.target.value = "";
      };
      rd.readAsText(f, "utf-8");
    });
  }
};
