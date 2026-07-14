import type { jsPDF } from "jspdf";

import { fetchBiography } from "../api/nodes.api";
import { CATEGORY_LABELS } from "../types";
import type { Biography, Category, GraphData, GraphEdge, GraphNode, SourceLink } from "../types";

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;
const INK: [number, number, number] = [22, 27, 38];
const MUTED: [number, number, number] = [103, 112, 130];
const PAPER: [number, number, number] = [247, 246, 242];
const NIGHT: [number, number, number] = [7, 10, 16];

const CATEGORY_RGB: Record<Category, [number, number, number]> = {
  person: [226, 112, 102],
  theorem: [77, 164, 145],
  conjecture: [217, 157, 72],
  algorithm: [112, 143, 229],
  problem: [196, 92, 118],
  domain: [139, 112, 196],
};

type Enriched = { bio: Biography | null; image: string };
type Relation = { edge: GraphEdge; other: GraphNode; outgoing: boolean; label: string };
type PendingLink = { page: number; x: number; y: number; w: number; h: number; targetId: string; fallbackUrl?: string };

function clean(value: string) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, " - ")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/…/g, "...")
    .replace(/[Α-Ͽἀ-῿]/g, "")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function short(value: string, limit: number) {
  const text = clean(value);
  return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 3)).trim()}...`;
}

async function imageData(url: string) {
  if (!url) return "";
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const blob = await fetch(url, { signal: controller.signal }).then((response) => {
      window.clearTimeout(timeout);
      if (!response.ok) throw new Error();
      return response.blob();
    });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

async function biographies(nodes: GraphNode[], progress?: (done: number, total: number) => void) {
  const output = new Map<string, Enriched>();
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < nodes.length) {
      const node = nodes[cursor++];
      try {
        const bio = await fetchBiography(node.id);
        output.set(node.id, { bio, image: await imageData(bio.image_url) });
      } catch {
        output.set(node.id, { bio: null, image: "" });
      }
      progress?.(++done, nodes.length * 2);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, nodes.length) }, worker));
  return output;
}

function sourceLinks(node: GraphNode) {
  return (Array.isArray(node.properties?.sources) ? node.properties.sources : []) as SourceLink[];
}

function wikipediaUrl(node: GraphNode) {
  const source = sourceLinks(node).find((item) => item.provider?.toLowerCase() === "wikipedia" && item.url);
  const propertyUrl = node.properties?.wikipedia_url;
  return source?.url || (typeof propertyUrl === "string" ? propertyUrl : "");
}

function relationsFor(node: GraphNode, graph: GraphData): Relation[] {
  const nodeMap = new Map(graph.nodes.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const output: Relation[] = [];
  for (const edge of graph.edges) {
    if (edge.source !== node.id && edge.target !== node.id) continue;
    const outgoing = edge.source === node.id;
    const otherId = outgoing ? edge.target : edge.source;
    const other = nodeMap.get(otherId);
    if (!other) continue;
    const label = clean(outgoing ? edge.label || edge.relation : edge.inverse_label || edge.label || edge.relation);
    const key = `${otherId}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ edge, other, outgoing, label });
  }
  return output;
}

function paper(doc: jsPDF, accent: [number, number, number]) {
  doc.setFillColor(...PAPER);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 0, 4, PAGE_H, "F");
}

function pageHeader(doc: jsPDF, right: string, accent: [number, number, number]) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("A T L A S", M, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.text(clean(right).toUpperCase(), PAGE_W - M, 16, { align: "right" });
  doc.setDrawColor(214, 212, 205);
  doc.line(M, 21, PAGE_W - M, 21);
}

function footer(doc: jsPDF, page: number, total: number, dark = false) {
  const ruleColor: [number, number, number] = dark ? [42, 50, 68] : [214, 212, 205];
  const textColor: [number, number, number] = dark ? [105, 115, 135] : MUTED;
  doc.setDrawColor(...ruleColor);
  doc.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...textColor);
  doc.text("ATLAS  /  DOSSIER DE CONNAISSANCE", M, PAGE_H - 8.5);
  doc.text(`${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, PAGE_W - M, PAGE_H - 8.5, { align: "right" });
}

function pill(doc: jsPDF, text: string, x: number, y: number, color: [number, number, number]) {
  const label = clean(text).toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const width = Math.min(48, doc.getTextWidth(label) + 7);
  doc.setFillColor(235, 233, 226);
  doc.roundedRect(x, y - 4, width, 7, 3.5, 3.5, "F");
  doc.setTextColor(...color);
  doc.text(label, x + 3.5, y + .6);
  return width;
}

function drawArrow(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setFillColor(...color);
  doc.setLineWidth(.45);
  doc.line(x1, y1, x2, y2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 2.2;
  doc.triangle(
    x2,
    y2,
    x2 - size * Math.cos(angle - Math.PI / 6),
    y2 - size * Math.sin(angle - Math.PI / 6),
    x2 - size * Math.cos(angle + Math.PI / 6),
    y2 - size * Math.sin(angle + Math.PI / 6),
    "F",
  );
}

function cover(doc: jsPDF, nodes: GraphNode[], graph: GraphData, title: string) {
  doc.setFillColor(...NIGHT);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(241, 241, 237);
  doc.text("A  T  L  A  S", M, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(124, 156, 245);
  doc.text("EDITION PERSONNELLE  /  MATHEMATIQUES", M, 34);

  const titleLines = doc.splitTextToSize(clean(title), 142).slice(0, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleLines.length > 2 ? 27 : 32);
  doc.setTextColor(248, 247, 242);
  doc.text(titleLines, M, 66, { lineHeightFactor: 1.02 });
  const titleBottom = 66 + titleLines.length * (titleLines.length > 2 ? 10 : 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(164, 173, 193);
  doc.text("Une cartographie éditoriale de vos repères mathématiques.", M, titleBottom + 13);

  const graphNodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const coverItems = [...nodes];
  for (const selected of nodes) {
    if (coverItems.length >= 9) break;
    for (const edge of graph.edges) {
      if (edge.source !== selected.id && edge.target !== selected.id) continue;
      const neighbor = graphNodeMap.get(edge.source === selected.id ? edge.target : edge.source);
      if (neighbor && !coverItems.some((item) => item.id === neighbor.id)) coverItems.push(neighbor);
      if (coverItems.length >= 9) break;
    }
  }
  const positions = coverItems.slice(0, 9).map((node, index, list) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, list.length)) * Math.PI * 2;
    return { node, x: 105 + Math.cos(angle) * 70, y: 190 + Math.sin(angle) * 48 };
  });
  const positionMap = new Map(positions.map((item) => [item.node.id, item]));
  doc.setLineWidth(.35);
  for (const edge of graph.edges) {
    const a = positionMap.get(edge.source);
    const b = positionMap.get(edge.target);
    if (!a || !b) continue;
    doc.setDrawColor(55, 67, 92);
    doc.line(a.x, a.y, b.x, b.y);
  }
  positions.forEach(({ node, x, y }, index) => {
    const color = CATEGORY_RGB[node.category];
    doc.setFillColor(...color);
    doc.circle(x, y, index === 0 ? 4.2 : 3.1, "F");
    doc.setDrawColor(...color);
    doc.circle(x, y, index === 0 ? 7 : 5.2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(223, 227, 237);
    const label = doc.splitTextToSize(short(node.label, 34), 39).slice(0, 2);
    doc.text(label, x, y + 9, { align: "center", lineHeightFactor: 1.15 });
  });
  if (!positions.length) {
    doc.setDrawColor(55, 67, 92);
    doc.circle(105, 188, 34, "S");
  }

  const relevantEdges = graph.edges.filter((edge) => positionMap.has(edge.source) && positionMap.has(edge.target)).length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(143, 153, 174);
  doc.text(
    `${nodes.length} repère${nodes.length > 1 ? "s" : ""} exporté${nodes.length > 1 ? "s" : ""}  /  ${relevantEdges} lien${relevantEdges > 1 ? "s" : ""} visualisé${relevantEdges > 1 ? "s" : ""}  /  ${new Date().toLocaleDateString("fr-FR")}`,
    M,
    258,
  );
}

function profilePage(doc: jsPDF, node: GraphNode, enriched: Enriched | undefined) {
  const accent = CATEGORY_RGB[node.category];
  paper(doc, accent);
  pageHeader(doc, CATEGORY_LABELS[node.category], accent);
  const hasImage = Boolean(enriched?.image);
  const titleWidth = hasImage ? 118 : PAGE_W - 2 * M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(node.label.length > 55 ? 22 : 27);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(clean(node.label), titleWidth).slice(0, 4);
  doc.text(titleLines, M, 38, { lineHeightFactor: 1.04 });
  const titleBottom = 38 + titleLines.length * (node.label.length > 55 ? 8.5 : 10.5);
  let px = M;
  px += pill(doc, CATEGORY_LABELS[node.category], px, titleBottom + 8, accent) + 3;
  pill(doc, `${node.degree} connexions`, px, titleBottom + 8, accent);

  if (hasImage) {
    doc.setFillColor(230, 228, 220);
    doc.roundedRect(PAGE_W - M - 48, 31, 48, 60, 2.5, 2.5, "F");
    try {
      doc.addImage(enriched!.image, enriched!.image.startsWith("data:image/png") ? "PNG" : "JPEG", PAGE_W - M - 46.5, 32.5, 45, 57, undefined, "MEDIUM");
    } catch {
      // Une image incompatible ne doit jamais bloquer l'export.
    }
  }

  const bioY = Math.max(108, titleBottom + 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(node.category === "person" ? "Biographie" : "Contexte et définition", M, bioY);
  doc.setFillColor(...accent);
  doc.rect(M, bioY + 3, 24, .8, "F");

  const bio = clean(enriched?.bio?.extract || node.description || "Aucune description détaillée disponible.");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(52, 60, 75);
  const lines = doc.splitTextToSize(bio, PAGE_W - 2 * M);
  const maxLines = Math.max(8, Math.floor((238 - (bioY + 12)) / 5.05));
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${short(visible[visible.length - 1], 90)}  [...]`;
  doc.text(visible, M, bioY + 12, { lineHeightFactor: 1.42 });

  const sources = sourceLinks(node).filter((source) => source?.url).slice(0, 3);
  doc.setDrawColor(214, 212, 205);
  doc.line(M, 250, PAGE_W - M, 250);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("SOURCES ET PROLONGEMENTS", M, 258);
  let sx = M;
  sources.forEach((source) => {
    const provider = clean(source.provider || "Source");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const width = Math.min(52, doc.getTextWidth(provider) + 11);
    if (sx + width > PAGE_W - M) return;
    doc.setFillColor(235, 233, 226);
    doc.roundedRect(sx, 263, width, 9, 4.5, 4.5, "F");
    doc.setTextColor(...accent);
    doc.text(`${provider}  >`, sx + 5.5, 268.8);
    doc.link(sx, 263, width, 9, { url: source.url });
    sx += width + 4;
  });
}

function relationPage(doc: jsPDF, node: GraphNode, relations: Relation[], pending: PendingLink[]) {
  const accent = CATEGORY_RGB[node.category];
  paper(doc, accent);
  pageHeader(doc, `${node.label} / relations`, accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(...INK);
  doc.text("Cartographie relationnelle", M, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Les directions sont lues depuis le sujet central. Chaque repère est cliquable s'il figure dans ce dossier.", M, 48);

  doc.setFillColor(239, 238, 233);
  doc.roundedRect(M, 58, PAGE_W - 2 * M, 126, 4, 4, "F");
  const cx = PAGE_W / 2;
  const cy = 120;
  const uniqueNeighbors = [...new Map(relations.map((relation) => [relation.other.id, relation])).values()].slice(0, 10);
  const positions = uniqueNeighbors.map((relation, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, uniqueNeighbors.length)) * Math.PI * 2;
    return { relation, angle, x: cx + Math.cos(angle) * 57, y: cy + Math.sin(angle) * 43 };
  });

  positions.forEach(({ relation, x, y }) => {
    const color = CATEGORY_RGB[relation.other.category];
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const startX = cx + ux * 16;
    const startY = cy + uy * 16;
    const endX = x - ux * 5;
    const endY = y - uy * 5;
    if (relation.outgoing) drawArrow(doc, startX, startY, endX, endY, color);
    else drawArrow(doc, endX, endY, startX, startY, color);
    doc.setFillColor(...PAPER);
    const relationLabel = short(relation.label, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    const labelWidth = Math.min(36, doc.getTextWidth(relationLabel) + 4);
    const lx = (startX + endX) / 2 - labelWidth / 2;
    const ly = (startY + endY) / 2;
    doc.roundedRect(lx, ly - 3, labelWidth, 5.5, 2.5, 2.5, "F");
    doc.setTextColor(78, 86, 102);
    doc.text(relationLabel, lx + labelWidth / 2, ly + .7, { align: "center" });
  });

  doc.setFillColor(...accent);
  doc.circle(cx, cy, 15, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.text(doc.splitTextToSize(short(node.label, 42), 24).slice(0, 3), cx, cy - 2.5, { align: "center", lineHeightFactor: 1.1 });

  positions.forEach(({ relation, x, y, angle }) => {
    const color = CATEGORY_RGB[relation.other.category];
    doc.setFillColor(...color);
    doc.circle(x, y, 4.2, "F");
    doc.setDrawColor(...PAPER);
    doc.setLineWidth(1.2);
    doc.circle(x, y, 5.2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...INK);
    const label = doc.splitTextToSize(short(relation.other.label, 34), 39).slice(0, 2);
    const tx = x;
    const ty = y + (Math.sin(angle) < -.35 ? -7 : 9);
    doc.text(label, tx, ty, { align: "center", lineHeightFactor: 1.1 });
  });

  if (!relations.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Aucune relation vérifiée n'est disponible pour ce repère.", cx, 168, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Index des liens", M, 197);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`${relations.length} relation${relations.length > 1 ? "s" : ""} vérifiée${relations.length > 1 ? "s" : ""}`, PAGE_W - M, 197, { align: "right" });

  relations.slice(0, 12).forEach((relation, index) => {
    const column = index >= 6 ? 1 : 0;
    const row = index % 6;
    const x = M + column * 89;
    const y = 204 + row * 12;
    const color = CATEGORY_RGB[relation.other.category];
    doc.setFillColor(255, 255, 252);
    doc.roundedRect(x, y, 84, 9.5, 2, 2, "F");
    doc.setFillColor(...color);
    doc.circle(x + 5, y + 4.75, 1.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...color);
    doc.text(short(relation.label, 29).toUpperCase(), x + 9, y + 3.7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(short(relation.other.label, 41), x + 9, y + 7.4);
    pending.push({
      page: doc.getNumberOfPages(),
      x,
      y,
      w: 84,
      h: 9.5,
      targetId: relation.other.id,
      fallbackUrl: wikipediaUrl(relation.other),
    });
  });
  if (relations.length > 12) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`+ ${relations.length - 12} autres relations disponibles dans Atlas`, M, 280);
  }
}

export async function exportKnowledgePdf(
  nodes: GraphNode[],
  graph: GraphData,
  title: string,
  progress?: (done: number, total: number) => void,
) {
  if (!nodes.length) return;
  const { jsPDF } = await import("jspdf");
  const unique = [...new Map(nodes.map((node) => [node.id, node])).values()];
  const enriched = await biographies(unique, progress);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const profilePages = new Map<string, number>();
  const relationPages = new Map<string, number>();
  const pending: PendingLink[] = [];

  cover(doc, unique, graph, title);
  const tocPages = Math.max(1, Math.ceil(unique.length / 10));
  for (let page = 0; page < tocPages; page++) {
    doc.addPage();
    paper(doc, [124, 156, 245]);
    pageHeader(doc, tocPages > 1 ? `Sommaire ${page + 1}/${tocPages}` : "Sommaire", [124, 156, 245]);
  }

  unique.forEach((node, index) => {
    doc.addPage();
    profilePages.set(node.id, doc.getNumberOfPages());
    profilePage(doc, node, enriched.get(node.id));
    doc.addPage();
    relationPages.set(node.id, doc.getNumberOfPages());
    relationPage(doc, node, relationsFor(node, graph), pending);
    progress?.(unique.length + index + 1, unique.length * 2);
  });

  for (let toc = 0; toc < tocPages; toc++) {
    doc.setPage(2 + toc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(27);
    doc.setTextColor(...INK);
    doc.text("Votre atlas, page par page", M, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text("Chaque fiche est suivie de sa cartographie relationnelle.", M, 51);
    unique.slice(toc * 10, (toc + 1) * 10).forEach((node, index) => {
      const y = 68 + index * 19;
      const color = CATEGORY_RGB[node.category];
      doc.setFillColor(...color);
      doc.circle(M + 3, y - 1, 2.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(short(node.label, 72), M + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...MUTED);
      doc.text(`${CATEGORY_LABELS[node.category]}  /  fiche ${profilePages.get(node.id)}  /  carte ${relationPages.get(node.id)}`, M + 10, y + 6);
      doc.setDrawColor(220, 218, 211);
      doc.line(M + 10, y + 10, PAGE_W - M, y + 10);
      doc.link(M, y - 7, PAGE_W - 2 * M, 17, { pageNumber: profilePages.get(node.id)! });
    });
  }

  pending.forEach((link) => {
    const target = profilePages.get(link.targetId);
    doc.setPage(link.page);
    if (target) doc.link(link.x, link.y, link.w, link.h, { pageNumber: target });
    else if (link.fallbackUrl) doc.link(link.x, link.y, link.w, link.h, { url: link.fallbackUrl });
  });

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    footer(doc, page, total, page === 1);
  }
  doc.setProperties({
    title: clean(title),
    subject: "Cartographie éditoriale de connaissances mathématiques",
    author: "Atlas",
    keywords: "mathématiques, graphe, relations, connaissances",
  });
  const filename = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "atlas";
  doc.save(`${filename}.pdf`);
}
