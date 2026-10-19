# Veille juridique médico-social

Veille réglementaire quotidienne du secteur social et médico-social : ESSMS, EHPAD, handicap, domicile, protection de l'enfance et familles, RH et fonction publique hospitalière, financement, numérique et données, qualité et droits des usagers.

**Site de consultation** : https://maxv1sion.github.io/veille-medico-social/

Auteur : Maxime

## Fonctionnement quotidien

Chaque jour ouvré, la veille se met à jour toute seule, sans intervention :

| Heure | Où | Ce qui se passe |
|---|---|---|
| Vers 6h10 (5h10 en hiver) | GitHub Actions | Téléchargement du Journal officiel (données ouvertes DILA), tri des textes liés au médico-social, enregistrement du texte complet dans `telechargements/JO/` |
| 7h50 | Tâche planifiée Claude | Second tri des textes du JO, rédaction des résumés à partir du texte officiel, recherche des textes hors JO (instructions, CNSA, HAS, ANS, PLFSS), mise à jour de `registre.json` |
| Après 7h50 | GitHub Pages | Republication automatique du site avec les nouveaux textes |
| Fin de passage | Notification | Résumé du passage envoyé sur le téléphone (application Claude) et par email au titulaire du compte |

La notification indique le nombre de textes ajoutés (avec intitulé et date), combien viennent du JO officiel, les textes retirés après 2 ans et la bonne mise à jour de GitHub.

## Contenu du dépôt

| Élément | Rôle |
|---|---|
| `index.html` | Le site : filtres par période, thème et type, export PowerPoint, texte d'email pour le dirigeant, mode présentation pour la visio |
| `registre.json` | La liste des textes de veille (date, type, thème, intitulé, résumé, source, lien) |
| `.github/workflows/jorf.yml` | Le programme automatique GitHub qui lance la récupération du JO chaque matin |
| `scripts/jorf.py` | Le script de téléchargement et de tri du JO |
| `jorf/candidats.json` | Les textes du JO présélectionnés, repris par la veille Claude |
| `jorf/diagnostic.txt` | Le rapport du dernier passage (archives lues, nombre de textes, erreurs éventuelles) |
| `telechargements/JO/AAAA-MM-JJ/` | Le texte officiel complet de chaque texte retenu : version lisible `.txt` et fichier XML d'origine |

## Sources

- **Journal officiel** : données ouvertes de la DILA, éditeur de Légifrance (https://echanges.dila.gouv.fr/OPENDATA/JORF/, Licence Ouverte Etalab 2.0). Les liens de chaque texte pointent vers Légifrance.
- **Hors JO** : Bulletins officiels Solidarités, ministère des Solidarités, CNSA, HAS, Agence du numérique en santé, Sécurité sociale, Assemblée nationale, Sénat, et à défaut la FHF

Légifrance bloque la lecture automatique de ses pages : les textes du JO sont donc récupérés par les données ouvertes officielles, jamais par lecture du site.

## Durées de conservation

| Élément | Durée |
|---|---|
| Textes du registre et du site | 2 ans à compter de la date de publication |
| Dossiers `telechargements/JO/` | 1 an |

Les suppressions sont automatiques.

## Consulter la veille

- **Site GitHub Pages** : https://maxv1sion.github.io/veille-medico-social/, accessible depuis n'importe quel poste, sans compte
- **Fichier HTML autonome** : à ouvrir d'un double-clic sur le poste, il récupère `registre.json` à chaque ouverture. Les textes ajoutés à la main restent sur le poste.
- **Page Claude** : version privée, mise à jour en même temps que le site

## Actions manuelles utiles

- **Relancer la récupération du JO** : onglet Actions, « Récupération du Journal officiel », bouton « Run workflow »
- **Relancer la veille Claude** : depuis l'onglet Tâches planifiées de Claude, ou en le demandant dans une conversation
- **Vérifier un passage** : consulter `jorf/diagnostic.txt` et l'historique des commits

## Points de vigilance

- **Ne pas supprimer la tâche planifiée Claude** « Veille juridique médico-social ». Pour une pause, la désactiver. Les conversations de passage peuvent être supprimées sans risque.
- **Le dépôt est public** : n'y déposer que des informations publiques, jamais de notes internes ou de données clients
- **Accès de Claude au dépôt** : il passe par l'application Claude installée sur le compte GitHub. Si elle est retirée, la veille Claude ne pourra plus mettre le site à jour.
- **Tri du JO** : il repose sur des mots-clés (`scripts/jorf.py`, listes `GARDER` et `EXCLURE`). Si des textes hors sujet passent ou si un texte attendu manque, ajuster ces listes.
