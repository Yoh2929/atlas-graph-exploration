# Atlas — cartographie vivante des mathématiques

Atlas relie concepts, problèmes, théorèmes, conjectures, algorithmes et
mathématiciens dans une interface interactive construite avec FastAPI, Neo4j,
React et Sigma.js.

Le seed v3 s'appuie sur Wikipedia et Wikidata. Il privilégie les relations
sémantiques consultables, explore les éponymes dans les deux directions et ne
présente plus les identifiants de catalogues comme des sources.

## Installation rapide

Prérequis : Git, PowerShell et Docker Desktop.

```powershell
git clone https://github.com/Yoh2929/atlas-graph-exploration.git
cd atlas-graph-exploration
.\dev-up.ps1
```

Au premier lancement, `backend/.env` est créé depuis `.env.example`. Pour une
instance exposée publiquement, remplacez immédiatement les mots de passe et le
secret JWT fournis par défaut.

## Lancement PowerShell

```powershell
.\dev-up.ps1                              # démarrage normal
.\dev-up.ps1 -SkipBuild                   # démarrage quotidien rapide
.\dev-up.ps1 -Seed                        # reconstruction et publication complète
.\dev-up.ps1 -SeedDryRun                  # contrôle rapide, 250 nœuds
.\dev-up.ps1 -SeedDryRun -SeedLimit 2000  # contrôle complet
.\dev-up.ps1 -SkipBuild -FollowLogs       # suivi des journaux
```

- Interface : http://127.0.0.1:3000
- Documentation API : http://127.0.0.1:8000/docs
- Neo4j Browser : http://127.0.0.1:7474

Les traces du lanceur sont conservées dans `logs/`. Les snapshots et rapports
du seed se trouvent dans `backend/seed-artifacts/` et les réponses distantes
réutilisables dans `backend/.seed-cache/`.

## Expérience de navigation

- recherche plein graphe ;
- filtres dynamiques par famille mathématique ;
- masquage des nœuds isolés ;
- mise en évidence animée du voisinage sélectionné ;
- relations nommées directement sur le graphe ;
- panneau distinct pour personnes associées et idées connectées ;
- Wikipedia comme source principale, Wikidata comme provenance structurée.

## Tests

```powershell
cd backend
python -m unittest discover -s tests -v

cd ..\frontend
npm run build
```

La conception détaillée du pipeline est documentée dans
`backend/app/graph/seed/README.md`.
