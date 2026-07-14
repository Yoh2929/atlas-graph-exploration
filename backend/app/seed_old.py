"""
Peuple Neo4j avec un petit graphe de connaissances mathématiques (démo V1).
Lancer avec :  python -m app.seed
"""

from neo4j import GraphDatabase
from app.config import settings

NODES = [
    # --- domaines ---
    ("algebre", "Algèbre", "domain", "Étude des structures : groupes, anneaux, corps."),
    ("theorie-des-groupes", "Théorie des groupes", "domain", "Étude des symétries et structures algébriques appelées groupes."),
    ("groupes-de-lie", "Groupes de Lie", "domain", "Groupes qui sont aussi des variétés différentiables continues."),
    ("physique-quantique", "Physique quantique", "domain", "Théorie physique décrivant la matière à l'échelle microscopique."),
    ("theorie-des-nombres", "Théorie des nombres", "domain", "Étude des propriétés des nombres entiers, notamment les nombres premiers."),
    ("topologie", "Topologie", "domain", "Étude des propriétés préservées par déformation continue."),
    ("theorie-de-la-complexite", "Théorie de la complexité", "domain", "Étude des ressources (temps, mémoire) nécessaires pour résoudre des problèmes algorithmiques."),
    ("theorie-des-graphes", "Théorie des graphes", "domain", "Étude des structures de nœuds et d'arêtes."),
    ("analyse", "Analyse mathématique", "domain", "Étude des limites, continuité, dérivées et intégrales."),
    ("geometrie", "Géométrie", "domain", "Étude des formes, tailles et propriétés de l'espace."),
    ("logique", "Logique mathématique", "domain", "Étude formelle du raisonnement et des systèmes axiomatiques."),

    # --- théorèmes ---
    ("theoreme-fondamental-algebre", "Théorème fondamental de l'algèbre", "theorem", "Tout polynôme non constant à coefficients complexes a au moins une racine complexe."),
    ("theoreme-de-pythagore", "Théorème de Pythagore", "theorem", "Dans un triangle rectangle, le carré de l'hypoténuse égale la somme des carrés des deux autres côtés."),
    ("theoremes-incompletude-godel", "Théorèmes d'incomplétude de Gödel", "theorem", "Tout système formel suffisamment puissant contient des énoncés vrais mais indémontrables."),
    ("grand-theoreme-de-fermat", "Grand théorème de Fermat", "theorem", "Il n'existe pas de solutions entières positives à x^n + y^n = z^n pour n > 2."),
    ("theoreme-fondamental-arithmetique", "Théorème fondamental de l'arithmétique", "theorem", "Tout entier supérieur à 1 se décompose de façon unique en produit de nombres premiers."),
    ("theoreme-des-quatre-couleurs", "Théorème des quatre couleurs", "theorem", "Quatre couleurs suffisent pour colorer n'importe quelle carte plane sans que deux régions adjacentes partagent une couleur."),
    ("theoreme-des-nombres-premiers", "Théorème des nombres premiers", "theorem", "Décrit la distribution asymptotique des nombres premiers."),
    ("conjecture-de-poincare", "Conjecture de Poincaré", "theorem", "Toute variété de dimension 3 simplement connexe et compacte est homéomorphe à une sphère. Démontrée par Perelman."),
    ("theoreme-de-noether", "Théorème de Noether", "theorem", "À chaque symétrie continue d'un système physique correspond une loi de conservation."),

    # --- conjectures ---
    ("hypothese-de-riemann", "Hypothèse de Riemann", "conjecture", "Tous les zéros non triviaux de la fonction zêta ont une partie réelle égale à 1/2."),
    ("conjecture-de-goldbach", "Conjecture de Goldbach", "conjecture", "Tout entier pair supérieur à 2 est la somme de deux nombres premiers."),
    ("conjecture-des-nombres-premiers-jumeaux", "Conjecture des nombres premiers jumeaux", "conjecture", "Il existe une infinité de paires de nombres premiers séparés de 2."),
    ("conjecture-de-collatz", "Conjecture de Collatz", "conjecture", "La suite définie par n/2 ou 3n+1 atteint toujours 1, quel que soit l'entier de départ."),

    # --- problème ---
    ("p-vs-np", "Problème P contre NP", "problem", "Tout problème dont la solution se vérifie rapidement peut-il aussi se résoudre rapidement ?"),

    # --- algorithmes ---
    ("algorithme-d-euclide", "Algorithme d'Euclide", "algorithm", "Calcule le plus grand diviseur commun de deux entiers par divisions successives."),
    ("test-de-primalite-aks", "Test de primalité AKS", "algorithm", "Premier algorithme déterministe et polynomial pour tester la primalité."),
    ("test-de-miller-rabin", "Test de primalité de Miller-Rabin", "algorithm", "Test de primalité probabiliste, rapide en pratique."),
    ("algorithme-rsa", "Algorithme RSA", "algorithm", "Système de chiffrement à clé publique basé sur la difficulté de factoriser de grands nombres."),
    ("algorithme-de-dijkstra", "Algorithme de Dijkstra", "algorithm", "Trouve le plus court chemin entre deux nœuds dans un graphe pondéré."),

    # --- personnalités ---
    ("euclide", "Euclide", "person", "Mathématicien grec, auteur des Éléments, fondateur de la géométrie axiomatique."),
    ("evariste-galois", "Évariste Galois", "person", "Mathématicien français, à l'origine de la théorie des groupes via l'étude des équations."),
    ("kurt-godel", "Kurt Gödel", "person", "Logicien austro-américain, auteur des théorèmes d'incomplétude."),
    ("bernhard-riemann", "Bernhard Riemann", "person", "Mathématicien allemand, a formulé l'hypothèse portant son nom."),
    ("henri-poincare", "Henri Poincaré", "person", "Mathématicien français, fondateur de la topologie moderne."),
    ("alan-turing", "Alan Turing", "person", "Mathématicien britannique, fondateur de l'informatique théorique."),
    ("emmy-noether", "Emmy Noether", "person", "Mathématicienne allemande, contributions majeures à l'algèbre abstraite."),
    ("srinivasa-ramanujan", "Srinivasa Ramanujan", "person", "Mathématicien indien autodidacte, résultats profonds en théorie des nombres."),
    ("andrew-wiles", "Andrew Wiles", "person", "Mathématicien britannique, a démontré le grand théorème de Fermat en 1994."),
    ("grigori-perelman", "Grigori Perelman", "person", "Mathématicien russe, a démontré la conjecture de Poincaré en 2003."),
    ("sophie-germain", "Sophie Germain", "person", "Mathématicienne française, contributions précoces au grand théorème de Fermat."),
    ("carl-friedrich-gauss", "Carl Friedrich Gauss", "person", "Mathématicien allemand, contributions fondamentales à la théorie des nombres."),
    ("sophus-lie", "Sophus Lie", "person", "Mathématicien norvégien, fondateur de la théorie des groupes de Lie."),
    ("edsger-dijkstra", "Edsger Dijkstra", "person", "Informaticien néerlandais, auteur de l'algorithme de plus court chemin."),
]

EDGES = [
    ("theorie-des-groupes", "algebre", "depends_on"),
    ("groupes-de-lie", "theorie-des-groupes", "depends_on"),
    ("physique-quantique", "groupes-de-lie", "uses"),
    ("p-vs-np", "theorie-de-la-complexite", "depends_on"),
    ("theorie-de-la-complexite", "theorie-des-graphes", "depends_on"),
    ("p-vs-np", "theorie-des-graphes", "uses"),
    ("algorithme-rsa", "theorie-des-nombres", "depends_on"),
    ("algorithme-rsa", "algorithme-d-euclide", "uses"),
    ("test-de-primalite-aks", "theorie-des-nombres", "uses"),
    ("test-de-miller-rabin", "theorie-des-nombres", "uses"),
    ("algorithme-de-dijkstra", "theorie-des-graphes", "uses"),
    ("hypothese-de-riemann", "theorie-des-nombres", "depends_on"),
    ("hypothese-de-riemann", "theoreme-des-nombres-premiers", "equivalent_to"),
    ("theoreme-des-nombres-premiers", "analyse", "depends_on"),
    ("theoreme-des-nombres-premiers", "theorie-des-nombres", "depends_on"),
    ("conjecture-de-goldbach", "theorie-des-nombres", "depends_on"),
    ("conjecture-des-nombres-premiers-jumeaux", "theorie-des-nombres", "depends_on"),
    ("conjecture-de-collatz", "theorie-des-nombres", "depends_on"),
    ("grand-theoreme-de-fermat", "theorie-des-nombres", "depends_on"),
    ("andrew-wiles", "grand-theoreme-de-fermat", "solves"),
    ("grand-theoreme-de-fermat", "sophie-germain", "inspired_by"),
    ("conjecture-de-poincare", "topologie", "depends_on"),
    ("grigori-perelman", "conjecture-de-poincare", "solves"),
    ("topologie", "henri-poincare", "inspired_by"),
    ("theoreme-des-quatre-couleurs", "theorie-des-graphes", "depends_on"),
    ("theoreme-fondamental-algebre", "analyse", "depends_on"),
    ("theoreme-fondamental-algebre", "algebre", "depends_on"),
    ("theoreme-fondamental-arithmetique", "theorie-des-nombres", "depends_on"),
    ("theoreme-fondamental-arithmetique", "algorithme-d-euclide", "uses"),
    ("theoreme-de-pythagore", "geometrie", "depends_on"),
    ("geometrie", "euclide", "inspired_by"),
    ("algorithme-d-euclide", "euclide", "inspired_by"),
    ("theoremes-incompletude-godel", "logique", "depends_on"),
    ("theoremes-incompletude-godel", "kurt-godel", "inspired_by"),
    ("theorie-des-groupes", "evariste-galois", "inspired_by"),
    ("groupes-de-lie", "sophus-lie", "inspired_by"),
    ("hypothese-de-riemann", "bernhard-riemann", "inspired_by"),
    ("theorie-de-la-complexite", "alan-turing", "inspired_by"),
    ("algebre", "emmy-noether", "inspired_by"),
    ("theoreme-de-noether", "algebre", "depends_on"),
    ("theoreme-de-noether", "theorie-des-groupes", "uses"),
    ("theoreme-de-noether", "emmy-noether", "inspired_by"),
    ("physique-quantique", "theoreme-de-noether", "uses"),
    ("theorie-des-nombres", "carl-friedrich-gauss", "inspired_by"),
    ("theorie-des-nombres", "srinivasa-ramanujan", "inspired_by"),
    ("algorithme-de-dijkstra", "edsger-dijkstra", "inspired_by"),
    # ponts entre "clusters" pour un graphe bien connecté
    ("theorie-de-la-complexite", "theorie-des-nombres", "uses"),
    ("geometrie", "algebre", "depends_on"),
    ("topologie", "algebre", "uses"),
    ("theorie-de-la-complexite", "logique", "depends_on"),
]


def run():
    driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
    with driver.session() as session:
        session.run("CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (n:Concept) REQUIRE n.id IS UNIQUE")

        session.run(
            """
            UNWIND $nodes AS row
            MERGE (n:Concept {id: row.id})
            SET n.label = row.label, n.category = row.category, n.description = row.description
            """,
            nodes=[{"id": i, "label": l, "category": c, "description": d} for i, l, c, d in NODES],
        )

        session.run(
            """
            UNWIND $edges AS row
            MATCH (a:Concept {id: row.source}), (b:Concept {id: row.target})
            MERGE (a)-[r:REL {type: row.relation}]->(b)
            """,
            edges=[{"source": s, "target": t, "relation": r} for s, t, r in EDGES],
        )

        print(f"✔ {len(NODES)} nœuds et {len(EDGES)} relations insérés dans Neo4j.")
    driver.close()


if __name__ == "__main__":
    run()
