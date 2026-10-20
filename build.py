#!/usr/bin/env python3
"""Assemble les deux versions du site à partir de src/ :
- index.html : site GitHub Pages et fichier autonome (registre.json lu sur GitHub, PowerPoint intégré)
- dist/artifact.html : page Claude (registre dans la base de l'artefact)
Usage : python3 build.py
"""
import json, os, re

R = os.path.dirname(os.path.abspath(__file__))
lire = lambda p: open(os.path.join(R, p), encoding="utf-8").read()
style, body, core = lire("src/style.css"), lire("src/body.html"), lire("src/core.js")
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,700&display=swap">'
TITRE = "Veille juridique médico-social"

# Version GitHub / fichier autonome
reg = json.load(open(os.path.join(R, "registre.json"), encoding="utf-8"))
lib = re.sub(r"//# sourceMappingURL=.*", "", lire("src/vendor/pptxgen.bundle.js")).replace("</script", "<\\/script")
gh = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITRE}</title>
<meta name="author" content="[Prénom] [Nom]">
{FONTS}
<style>[hidden]{{display:none!important}}
{style}</style>
</head>
<body>
{body}<script>{lib}</script>
<script>
const SEED = {json.dumps(reg, ensure_ascii=False)};
{lire("src/store-github.js")}
{core}</script>
</body>
</html>
"""
open(os.path.join(R, "index.html"), "w", encoding="utf-8").write(gh)

# Version page Claude
os.makedirs(os.path.join(R, "dist"), exist_ok=True)
art = f"""<title>{TITRE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FONTS}
<script src="https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js"></script>
<style>
{style}</style>
{body}<script>
{lire("src/store-artifact.js")}
{core}</script>
"""
open(os.path.join(R, "dist", "artifact.html"), "w", encoding="utf-8").write(art)
print(f"index.html : {len(gh)//1024} Ko, {len(reg.get('items', []))} textes intégrés | dist/artifact.html : {len(art)//1024} Ko")
