// Stockage de la page Claude : base de données partagée de l'artefact.
const Store = {
  kind: "artifact", db: null, canWrite: true, msg: "",
  async start(){
    const db = await claude.use("db");
    if(!db){ state.loaded = true; this.canWrite = false; this.msg = "Registre indisponible : connectez-vous à Claude pour l'afficher"; render(); return; }
    this.db = db;
    try { const user = await claude.use("user"); if(user?.can?.("data.write") === false) this.canWrite = false; } catch(e){}
    if(!this.canWrite){ const b = document.querySelector("#bAdd"); if(b) b.hidden = true; }
    db.collection("veille").onSnapshot(snap => { state.items = snap.docs.filter(d => d.exists).map(d => ({id:d.id, ...d.data()})); state.loaded = true; render(); },
      () => { state.loaded = true; render(); toast("Lecture du registre interrompue : rechargez la page"); });
    db.doc("meta/etat").onSnapshot(s => { state.meta = s.exists ? s.data() : {}; render(); });
  },
  syncText(){ return this.msg || (state.loaded ? "Registre partagé, mis à jour chaque jour ouvré" : ""); },
  editable(){ return !!this.db && this.canWrite; },
  async save(data, id){ if(!this.db) throw new Error("registre indisponible"); if(id) await this.db.collection("veille").doc(id).set(data); else await this.db.collection("veille").add(data); },
  async remove(id){ await this.db.collection("veille").doc(id).delete(); },
  async saveFile(name, blob){
    let d = null; try { d = await claude.use("downloads"); } catch(e){}
    if(!d) throw new Error("le téléchargement n'est pas disponible dans cette vue");
    await d.save({filename:name, data:blob});
  }
};
