#!/usr/bin/env python3
"""Récupère les textes du Journal officiel (données ouvertes DILA) et garde ceux qui
concernent le secteur social et médico-social ou le droit du travail et le droit social
applicables à un employeur du secteur. Résultat : jorf/candidats.json.

Source : https://echanges.dila.gouv.fr/OPENDATA/JORF/ (Licence Ouverte Etalab 2.0)
Les textes retenus sont aussi enregistrés en entier (version lisible .txt et XML officiel)
dans telechargements/JO/AAAA-MM-JJ/.
Lancé chaque matin par GitHub Actions (.github/workflows/jorf.yml).
"""
import datetime as dt
import hashlib
import io
import json
import os
import shutil
import re
import sys
import tarfile
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://echanges.dila.gouv.fr/OPENDATA/JORF/"
OUT = "jorf/candidats.json"
DIAG = "jorf/diagnostic.txt"
DOSSIER_TELECHARGEMENTS = "telechargements/JO"   # un sous-dossier par date de publication
JOURS_TELECHARGEMENTS = 365                        # on garde 1 an de textes téléchargés
JOURS_MAX_PREMIER_PASSAGE = 14   # au premier lancement, on remonte 14 jours
JOURS_CONSERVES = 160            # on garde un peu plus de 5 mois de candidats
JOURS_REPRISE = 150              # quand les règles de tri changent, on relit les numéros des 150 derniers jours

GARDER = [
    "action sociale et des familles", "medico-social", "medico-sociaux", "medico-sociale",
    "etablissements et services sociaux", "ehpad", "personnes agees", "autonomie", "handicap",
    "aide sociale a l'enfance", "protection de l'enfance", "protection des enfants", "enfance protegee",
    "aide a domicile", "services a domicile", "soins infirmiers a domicile", "service autonomie",
    "allocation aux adultes handicapes", "allocation personnalisee d'autonomie", "prestation de compensation",
    "caisse nationale de solidarite", "cnsa", "fonction publique hospitaliere",
    "etablissements sanitaires, sociaux et medico-sociaux", "directeurs d'etablissement sanitaire",
    "travail social", "travailleurs sociaux", "diplome d'etat d'educateur", "accompagnant educatif",
    "assistants familiaux", "assistant familial", "accueil familial", "majeurs proteges",
    "protection juridique des majeurs", "mandataires judiciaires", "residences autonomie",
    "dependance", "proches aidants", "aidants", "maltraitance", "bientraitance",
    "aide par le travail", "maisons departementales des personnes handicapees",
    "pupilles de l'etat", "hebergement d'urgence", "centres d'hebergement",
    "objectif national de depenses d'assurance maladie",
    "attestation d'honorabilite", "dossier usager", "france enfance protegee",
    # Droit du travail et droit social (employeur)
    "code du travail", "contrat de travail", "licenciement", "rupture conventionnelle",
    "salaries proteges", "representants du personnel", "comite social et economique",
    "duree du travail", "temps de travail", "travail de nuit", "heures supplementaires",
    "repos quotidien", "repos hebdomadaire", "conges payes", "conge de naissance",
    "conge de maternite", "conge de paternite", "conge parental", "conge de proche aidant",
    "arret de travail", "arrets de travail", "indemnites journalieres", "indemnisation des arrets",
    "accidents du travail", "accident du travail", "maladies professionnelles", "maladie professionnelle",
    "sante au travail", "medecin du travail", "prevention des risques professionnels",
    "document unique", "inaptitude", "visite de reprise", "rendez-vous de liaison",
    "harcelement", "violences sexuelles et sexistes", "egalite professionnelle",
    "travailleurs handicapes", "obligation d'emploi des travailleurs handicapes",
    "titres-restaurant", "titre-restaurant", "salaire minimum de croissance",
    "epargne salariale", "interessement", "participation des salaries", "partage de la valeur",
    "fraude sociale", "cotisations sociales", "allegements de cotisations", "reduction generale des cotisations",
    "assurance chomage", "activite partielle", "teletravail", "portage salarial",
    "inspection du travail", "negociation collective", "dialogue social",
]
# Extensions et agréments d'accords : gardés seulement pour les branches du secteur
BRANCHES = [
    "aide, de l'accompagnement, des soins et des services a domicile",
    "personnes inadaptees et handicapees",
    "etablissements prives d'hospitalisation, de soins, de cure et de garde a but non lucratif",
    "sanitaire, social et medico-social", "sanitaire, sociale et medico-sociale",
    "acteurs du lien social et familial", "hospitalisation privee", "medico-social",
]
EXCLURE = [
    "portant nomination", "portant cessation de fonctions", "cessation de fonctions",
    "tableau d'avancement", "admission a la retraite", "delegation de signature",
    "liste d'aptitude", "examen professionnel", "portant ouverture d'un concours",
    "portant ouverture de concours", "ouverture au titre de l'annee", "medaille",
    "naturalisation", "changement de nom", "portant affectation", "portant detachement",
    "portant integration", "portant reintegration", "portant titularisation",
    "jury", "liste des candidats", "liste des admis", "elevation", "citation",
    "personnes autorisees a exercer", "vacance", "eleves directeurs", "taux de promotion",
    "titre professionnel", "certificat de qualification professionnelle", "portant agrement d'organismes",
    "habilitation d'organismes", "conseil d'administration de la caisse", "composition du conseil",
    # Mesures individuelles et gestion interne des administrations
    "promotion de grade", "nombre d'emplois offerts", "nombre de postes offerts", "avis de recrutement",
    "recrutement par la voie", "ouvrant le recrutement", "designation d'un magistrat", "portant designation",
    "placement d'", "listes d'aptitude", "attributions du ministre", "portant reconnaissance", "abrogeant le decret portant reconnaissance",
    # Élections et instances internes de la fonction publique (hors FPH du secteur)
    "vote electronique", "comite social d'administration", "commissions administratives paritaires",
    "commissions consultatives paritaires", "parts respectives de femmes et d'hommes",
    "nombre de representants par college", "nombre de membres representants",
    "election des representants du personnel", "elections des representants du personnel",
    "elections professionnelles des representants", "designation des representants du personnel",
    # Hors secteur
    "indemnites compensatoires de handicap", "ecoregime", "brevet de technicien", "certificat d'instructeur",
    "couture parisienne", "industries electriques", "travailleurs independants", "branche france travail",
    "administrateurs judiciaires", "vehicules",
]
# Mots-clés retenus seulement en tête d'intitulé (sinon simples renvois à une loi ancienne)
EN_TETE = ["loi n", "loi organique", "ordonnance", "decret"]
GARDER_SI_EN_TETE = ["financement de la securite sociale"]
JOURS_ANCIENNETE_MAX = 10   # écarte les vieux textes simplement réédités dans l'archive du jour
TYPES = {"LOI": "Loi", "ORDONNANCE": "Ordonnance", "DECRET": "Décret", "ARRETE": "Arrêté",
         "CIRCULAIRE": "Instruction / circulaire", "DECISION": "Décision / avis", "AVIS": "Décision / avis"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s.replace("’", "'"))


def http(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "veille-medico-social (GitHub Actions)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def lister_archives():
    page = http(BASE)
    noms = sorted(set(re.findall(r'href="(JORF_\d{8}-\d{6}\.tar\.gz)"', page)))
    return noms


def date_archive(nom):
    m = re.search(r"JORF_(\d{8})-", nom)
    return dt.datetime.strptime(m.group(1), "%Y%m%d").date() if m else None


def premier(root, tag):
    el = root.find(f".//{tag}")
    return (el.text or "").strip() if el is not None and el.text else ""


def texte_de(el):
    """Texte lisible d'un élément XML (paragraphes conservés)."""
    if el is None:
        return ""
    morceaux = []
    for bloc in el.iter():
        if bloc.tag in ("p", "br", "P", "BR") and morceaux:
            morceaux.append("\n")
        if bloc.text:
            morceaux.append(bloc.text)
        if bloc.tail:
            morceaux.append(bloc.tail)
    txt = "".join(morceaux)
    txt = re.sub(r"[ \t]+", " ", txt)
    return re.sub(r"\n\s*\n+", "\n\n", txt).strip()


def lire_archive(nom, diag):
    data = http(BASE + nom, binary=True)
    textes, racines, exemples = [], {}, []
    articles = {}   # JORFTEXT -> liste d'articles
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for m in tar:
            if not m.isfile() or not m.name.endswith(".xml"):
                continue
            if len(exemples) < 8:
                exemples.append(m.name)
            f = tar.extractfile(m)
            if f is None:
                continue
            brut = f.read()
            try:
                root = ET.fromstring(brut)
            except ET.ParseError:
                continue
            racines[root.tag] = racines.get(root.tag, 0) + 1
            if root.tag == "ARTICLE":
                ctx = root.find(".//CONTEXTE/TEXTE")
                cid = ctx.get("cid", "") if ctx is not None else ""
                if cid.startswith("JORFTEXT"):
                    articles.setdefault(cid, []).append({
                        "num": premier(root, "NUM"),
                        "ordre": len(articles.get(cid, [])),
                        "contenu": texte_de(root.find(".//BLOC_TEXTUEL/CONTENU")),
                    })
                continue
            if root.tag != "TEXTE_VERSION":
                continue
            ident = premier(root, "ID")
            if not ident.startswith("JORFTEXT"):
                continue
            titre = premier(root, "TITREFULL") or premier(root, "TITRE")
            textes.append({
                "id": ident,
                "nature": premier(root, "NATURE"),
                "titre": re.sub(r"\s+", " ", titre),
                "nor": premier(root, "NOR"),
                "datePubli": premier(root, "DATE_PUBLI"),
                "dateTexte": premier(root, "DATE_TEXTE"),
                "_xml": brut,
                "_visas": texte_de(root.find(".//VISAS")),
                "_notice": texte_de(root.find(".//NOTICE")),
                "_signataires": texte_de(root.find(".//SIGNATAIRES")),
            })
    for t in textes:
        t["_articles"] = articles.get(t["id"], [])
    diag.append(f"{nom} : {len(textes)} textes lus, articles rattachés à {len(articles)} textes | racines XML {racines} | exemples {exemples[:3]}")
    return textes


def enregistrer_texte(t, archive):
    """Écrit le texte complet dans telechargements/JO/AAAA-MM-JJ/ (lisible + XML officiel)."""
    jour = t.get("datePubli") or t["ajoute"]
    dossier = os.path.join(DOSSIER_TELECHARGEMENTS, jour)
    os.makedirs(dossier, exist_ok=True)
    with open(os.path.join(dossier, t["id"] + ".xml"), "wb") as f:
        f.write(t["_xml"])
    lignes = [
        t["titre"], "",
        f"Type : {t['type']}",
        f"Date de signature : {t.get('dateTexte') or 'non indiquée'}",
        f"Publication au Journal officiel : {t.get('datePubli') or 'non indiquée'}",
        f"NOR : {t.get('nor') or 'non indiqué'}",
        f"Lien Légifrance : {t['url']}",
        f"Source : données ouvertes DILA, archive {archive}", "",
    ]
    if t["_notice"]:
        lignes += ["NOTICE", t["_notice"], ""]
    if t["_visas"]:
        lignes += ["VISAS", t["_visas"], ""]
    arts = sorted(t["_articles"], key=lambda a: a["ordre"])
    if arts:
        for a in arts:
            lignes += [f"Article {a['num']}" if a["num"] else "Article", a["contenu"], ""]
    else:
        lignes += ["(Articles non présents dans l'archive du jour : consulter le lien Légifrance.)", ""]
    if t["_signataires"]:
        lignes += ["SIGNATAIRES", t["_signataires"], ""]
    chemin = os.path.join(dossier, t["id"] + ".txt")
    with open(chemin, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes))
    return chemin


def purger_telechargements(aujourd_hui):
    if not os.path.isdir(DOSSIER_TELECHARGEMENTS):
        return
    borne = (aujourd_hui - dt.timedelta(days=JOURS_TELECHARGEMENTS)).isoformat()
    for d in os.listdir(DOSSIER_TELECHARGEMENTS):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) and d < borne:
            shutil.rmtree(os.path.join(DOSSIER_TELECHARGEMENTS, d), ignore_errors=True)


def pertinent(t):
    n = norm(t["titre"])
    if not n or any(x in n for x in EXCLURE):
        return False
    # Conventions collectives : uniquement les branches du secteur
    if "convention collective" in n or "accord collectif" in n or "avenant" in n:
        return any(b in n for b in BRANCHES)
    if any(k in n for k in GARDER):
        return True
    return any(n.startswith(e) for e in EN_TETE) and any(k in n for k in GARDER_SI_EN_TETE)


def recent(t, nom):
    d_arch = date_archive(nom)
    if not d_arch or not t.get("datePubli"):
        return True
    try:
        d_pub = dt.date.fromisoformat(t["datePubli"][:10])
    except ValueError:
        return True
    return d_pub >= d_arch - dt.timedelta(days=JOURS_ANCIENNETE_MAX)


def empreinte_regles():
    """Change dès qu'une liste de mots-clés est modifiée : déclenche une relecture des numéros passés."""
    regles = json.dumps([GARDER, EXCLURE, BRANCHES, EN_TETE, GARDER_SI_EN_TETE], ensure_ascii=False)
    return hashlib.sha256(regles.encode("utf-8")).hexdigest()[:12]


def main():
    os.makedirs("jorf", exist_ok=True)
    etat = {"maj": "", "traites": [], "items": []}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            etat = json.load(f)
    deja = set(etat.get("traites", []))
    regles = empreinte_regles()
    reprise = etat.get("regles") != regles
    connus = {i["id"] for i in etat.get("items", [])}
    aujourd_hui = dt.date.today()
    diag = [f"Passage du {aujourd_hui.isoformat()}"]

    archives = lister_archives()
    diag.append(f"{len(archives)} archives quotidiennes disponibles, dernière : {archives[-1] if archives else 'aucune'}")
    if reprise:
        # Règles de tri modifiées : on relit tous les numéros récents pour ne rien rater
        deja = set()
        etat["items"] = []
        connus = set()
        limite = aujourd_hui - dt.timedelta(days=JOURS_REPRISE)
        diag.append(f"Règles de tri modifiées ({etat.get('regles') or 'aucune'} -> {regles}) : relecture des numéros depuis le {limite.isoformat()}")
    else:
        limite = aujourd_hui - dt.timedelta(days=JOURS_MAX_PREMIER_PASSAGE)
    a_traiter = [a for a in archives if a not in deja and (date_archive(a) or aujourd_hui) >= limite]

    nouveaux = 0
    for nom in a_traiter:
        try:
            for t in lire_archive(nom, diag):
                if t["id"] in connus or not pertinent(t) or not recent(t, nom):
                    continue
                t["type"] = TYPES.get(t["nature"].upper(), t["nature"].capitalize() or "Texte")
                t["url"] = f"https://www.legifrance.gouv.fr/jorf/id/{t['id']}"
                t["ajoute"] = aujourd_hui.isoformat()
                t["fichier"] = enregistrer_texte(t, nom)
                etat["items"].append({k: v for k, v in t.items() if not k.startswith("_")})
                connus.add(t["id"])
                nouveaux += 1
            deja.add(nom)
        except Exception as e:  # une archive en erreur ne bloque pas les autres
            diag.append(f"{nom} : erreur {e!r}")

    borne = (aujourd_hui - dt.timedelta(days=JOURS_CONSERVES)).isoformat()
    etat["items"] = sorted([i for i in etat["items"] if (i.get("datePubli") or i["ajoute"]) >= borne],
                           key=lambda i: i.get("datePubli", ""), reverse=True)
    purger_telechargements(aujourd_hui)
    if reprise:  # retire les textes complets des candidats écartés par les nouvelles règles
        gardes = {i["id"] for i in etat["items"]}
        if os.path.isdir(DOSSIER_TELECHARGEMENTS):
            for jour in os.listdir(DOSSIER_TELECHARGEMENTS):
                d = os.path.join(DOSSIER_TELECHARGEMENTS, jour)
                if not os.path.isdir(d):
                    continue
                for f in os.listdir(d):
                    if f.split(".")[0] not in gardes:
                        os.remove(os.path.join(d, f))
                if not os.listdir(d):
                    os.rmdir(d)
    etat["traites"] = sorted(deja)[-400:]
    etat["maj"] = aujourd_hui.isoformat()
    etat["regles"] = regles
    diag.append(f"{len(a_traiter)} archive(s) traitée(s), {nouveaux} nouveau(x) texte(s) pertinent(s)")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(etat, f, ensure_ascii=False, indent=2)
    with open(DIAG, "w", encoding="utf-8") as f:
        f.write("\n".join(diag) + "\n")
    print("\n".join(diag))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Échec : {e!r}", file=sys.stderr)
        sys.exit(1)
