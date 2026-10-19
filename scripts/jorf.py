#!/usr/bin/env python3
"""Récupère les textes du Journal officiel (données ouvertes DILA) et garde ceux qui
concernent le secteur social et médico-social. Résultat : jorf/candidats.json.

Source : https://echanges.dila.gouv.fr/OPENDATA/JORF/ (Licence Ouverte Etalab 2.0)
Lancé chaque matin par GitHub Actions (.github/workflows/jorf.yml).
"""
import datetime as dt
import io
import json
import os
import re
import sys
import tarfile
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://echanges.dila.gouv.fr/OPENDATA/JORF/"
OUT = "jorf/candidats.json"
DIAG = "jorf/diagnostic.txt"
JOURS_MAX_PREMIER_PASSAGE = 14   # au premier lancement, on remonte 14 jours
JOURS_CONSERVES = 120            # on garde 4 mois de candidats

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
    "financement de la securite sociale", "objectif national de depenses d'assurance maladie",
    "attestation d'honorabilite", "dossier usager", "france enfance protegee",
]
EXCLURE = [
    "portant nomination", "portant cessation de fonctions", "cessation de fonctions",
    "tableau d'avancement", "admission a la retraite", "delegation de signature",
    "liste d'aptitude", "examen professionnel", "portant ouverture d'un concours",
    "portant ouverture de concours", "ouverture au titre de l'annee", "medaille",
    "naturalisation", "changement de nom", "portant affectation", "portant detachement",
    "portant integration", "portant reintegration", "portant titularisation",
    "jury", "liste des candidats", "liste des admis", "elevation", "citation",
]
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


def lire_archive(nom, diag):
    data = http(BASE + nom, binary=True)
    textes, racines, exemples = [], {}, []
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for m in tar:
            if not m.isfile() or not m.name.endswith(".xml"):
                continue
            if len(exemples) < 8:
                exemples.append(m.name)
            f = tar.extractfile(m)
            if f is None:
                continue
            try:
                root = ET.fromstring(f.read())
            except ET.ParseError:
                continue
            racines[root.tag] = racines.get(root.tag, 0) + 1
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
            })
    diag.append(f"{nom} : {len(textes)} textes lus | racines XML {racines} | exemples {exemples[:3]}")
    return textes


def pertinent(t):
    n = norm(t["titre"])
    if not n or any(x in n for x in EXCLURE):
        return False
    return any(k in n for k in GARDER)


def main():
    os.makedirs("jorf", exist_ok=True)
    etat = {"maj": "", "traites": [], "items": []}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            etat = json.load(f)
    deja = set(etat.get("traites", []))
    connus = {i["id"] for i in etat.get("items", [])}
    aujourd_hui = dt.date.today()
    diag = [f"Passage du {aujourd_hui.isoformat()}"]

    archives = lister_archives()
    diag.append(f"{len(archives)} archives quotidiennes disponibles, dernière : {archives[-1] if archives else 'aucune'}")
    limite = aujourd_hui - dt.timedelta(days=JOURS_MAX_PREMIER_PASSAGE)
    a_traiter = [a for a in archives if a not in deja and (date_archive(a) or aujourd_hui) >= limite]

    nouveaux = 0
    for nom in a_traiter:
        try:
            for t in lire_archive(nom, diag):
                if t["id"] in connus or not pertinent(t):
                    continue
                t["type"] = TYPES.get(t["nature"].upper(), t["nature"].capitalize() or "Texte")
                t["url"] = f"https://www.legifrance.gouv.fr/jorf/id/{t['id']}"
                t["ajoute"] = aujourd_hui.isoformat()
                etat["items"].append(t)
                connus.add(t["id"])
                nouveaux += 1
            deja.add(nom)
        except Exception as e:  # une archive en erreur ne bloque pas les autres
            diag.append(f"{nom} : erreur {e!r}")

    borne = (aujourd_hui - dt.timedelta(days=JOURS_CONSERVES)).isoformat()
    etat["items"] = sorted([i for i in etat["items"] if (i.get("datePubli") or i["ajoute"]) >= borne],
                           key=lambda i: i.get("datePubli", ""), reverse=True)
    etat["traites"] = sorted(deja)[-200:]
    etat["maj"] = aujourd_hui.isoformat()
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
