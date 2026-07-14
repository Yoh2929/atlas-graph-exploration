# Atlas seed v3

Le seed construit un graphe mathématique borné, sourcé et navigable. Sa règle
principale est la qualité des associations : une propriété de catalogue n'est
jamais une relation et un identifiant externe n'est jamais présenté comme une
source éditoriale.

## Flux de données

1. Les catégories et pages-index Wikipedia découvrent problèmes, théorèmes,
   conjectures, algorithmes et domaines.
2. Wikidata sélectionne automatiquement des mathématiciens majeurs selon leur
   couverture Wikipedia interlangue.
3. Une partie du budget est réservée aux entités reliées plutôt qu'aux sujets
   isolés.
4. Un ensemble explicite de prédicats sémantiques est accepté : `nommé d'après`,
   `découvert par`, `auteur`, `œuvre notable`, `partie de`, etc.
5. Les éponymes sont explorés dans les deux directions. Atlas peut donc passer
   de « problèmes de Hilbert » à David Hilbert, mais aussi de Hilbert aux
   problèmes et espaces qui portent son nom.
6. Chaque nœud doit disposer d'une page Wikipedia française ou anglaise.
   Wikidata reste visible comme fiche de provenance secondaire.
7. Le snapshot est validé puis publié dans une transaction Neo4j atomique.

Les identifiants Microsoft Academic, Freebase, catalogues de bibliothèques et
autres propriétés `external-id` ne sont ni importés ni affichés.

## Commandes

Depuis `backend/` :

```bash
python -m app.graph.seed.run --dry-run
python -m app.graph.seed.run
python -m unittest discover -s tests -v
```

Le dry-run produit le même snapshot et le même rapport sans modifier Neo4j.

## Cache et artefacts

- `.seed-cache/` : réponses Wikimedia indexées par empreinte de requête ;
- `seed-artifacts/<run-id>/snapshot.json` : graphe normalisé ;
- `validation-report.json` : budgets, catégories, prédicats et nœuds isolés.

Le premier seed remplit le cache. Les suivants réutilisent les réponses pendant
`ATLAS_SEED_CACHE_TTL_SECONDS` (24 heures par défaut).
