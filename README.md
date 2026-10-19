# Veille juridique médico-social

Registre de veille réglementaire du secteur social et médico-social (ESSMS, EHPAD, handicap, domicile, enfance, RH, financement, numérique).

- `index.html` : le site (filtres par période, export PowerPoint, email au dirigeant, mode visio)
- `registre.json` : la liste des textes, mise à jour automatiquement chaque jour ouvré par une tâche planifiée Claude

Sources : Légifrance (Journal officiel), Bulletins officiels Solidarités, CNSA, HAS, ANS, Sécurité sociale.

Auteur : Maxime

## Récupération automatique du Journal officiel

Chaque matin, GitHub Actions (`.github/workflows/jorf.yml`) lance `scripts/jorf.py` :
- téléchargement des données ouvertes du JO publiées par la DILA (https://echanges.dila.gouv.fr/OPENDATA/JORF/, Licence Ouverte Etalab 2.0)
- tri des textes liés au secteur social et médico-social (mots-clés, exclusion des mesures nominatives)
- résultat dans `jorf/candidats.json`, repris ensuite par la veille Claude qui rédige les résumés

`jorf/diagnostic.txt` indique ce que le dernier passage a lu.
