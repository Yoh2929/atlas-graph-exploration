INVERSE_RELATION_LABELS = {
    "P138": "a donné son nom à", "P61": "a découvert ou inventé", "P170": "a créé",
    "P50": "a écrit", "P287": "a conçu", "P112": "a fondé", "P178": "a développé",
    "P800": "est une œuvre notable de", "P101": "est un domaine de travail de",
    "P737": "a influencé", "P144": "a servi de base à", "P1269": "a pour aspect",
    "P2578": "étudie", "P361": "comprend", "P527": "fait partie de",
    "P279": "a pour sous-classe", "P31": "a pour instance", "P155": "est suivi par",
    "P156": "est précédé par", "P460": "est équivalent à",
}


def inverse_relation_label(property_id: str, direct_label: str) -> str:
    return INVERSE_RELATION_LABELS.get(property_id, f"relation inverse de « {direct_label} »")


def canonicalize_relation(source: str, target: str, property_id: str, direct_label: str, inverse_label: str):
    """Expose causal relations in their natural reading direction."""
    if property_id == "P737":
        return target, source, inverse_label, direct_label
    return source, target, direct_label, inverse_label
