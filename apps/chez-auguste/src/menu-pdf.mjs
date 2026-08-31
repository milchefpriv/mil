import { jsPDF } from "jspdf";
import robotoVfs from "pdfmake/build/vfs_fonts.js";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const COURSE_ORDER = ["Entrée", "Plat", "Dessert"];
const COURSE_LABELS = {
  Entrée: "ENTRÉES",
  Plat: "PLATS",
  Dessert: "DESSERTS",
};

const COLORS = {
  paper: [252, 250, 247],
  red: [136, 31, 42],
  ink: [31, 28, 26],
  muted: [112, 104, 97],
  line: [225, 217, 207],
  warm: [178, 139, 92],
};

function cleanText(value) {
  return String(value || "")
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2026", "...")
    .replaceAll("\u00a0", " ");
}

function setColor(doc, color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function tracked(value) {
  return cleanText(value).split("").join(" ");
}

function registerFonts(doc) {
  const fonts = [
    ["Roboto-Regular.ttf", "normal"],
    ["Roboto-Medium.ttf", "bold"],
    ["Roboto-Italic.ttf", "italic"],
    ["Roboto-MediumItalic.ttf", "bolditalic"],
  ];
  for (const [filename, style] of fonts) {
    doc.addFileToVFS(filename, robotoVfs[filename]);
    doc.addFont(filename, "Roboto", style);
  }
}

function priceLabel(value) {
  const normalized = Number(value || 0).toFixed(2).replace(".", ",");
  return normalized.endsWith(",00") ? normalized.slice(0, -3) : normalized;
}

function fileSlug(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "carte";
}

function drawFooter(doc, pageNumber) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(22, 281, 188, 281);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.2);
  setColor(doc, COLORS.muted);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 286);
  doc.text("PRIX NETS EN EUROS · SERVICE COMPRIS", 105, 286, { align: "center" });
  doc.setFont("Roboto", "bold");
  setColor(doc, COLORS.ink);
  doc.text(String(pageNumber).padStart(2, "0"), 188, 286, { align: "right" });
}

function drawPage(doc, menuTitle, period, pageNumber, firstPage, logoDataUrl) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  if (firstPage) {
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 82, 15, 46, 33.3, undefined, "FAST");
    else {
      doc.setFont("Roboto", "bold");
      doc.setFontSize(17);
      setColor(doc, COLORS.red);
      doc.text(tracked("CHEZ AUGUSTE"), 105, 34, { align: "center" });
    }

    doc.setFont("Roboto", "bold");
    doc.setFontSize(6.2);
    setColor(doc, COLORS.red);
    doc.text(tracked("LA CARTE"), 105, 54, { align: "center" });
    doc.setFont("Roboto", "bold");
    doc.setFontSize(18);
    setColor(doc, COLORS.ink);
    const titleLines = doc.splitTextToSize(cleanText(menuTitle), 150).slice(0, 2);
    doc.text(titleLines, 105, 63, { align: "center", lineHeightFactor: 1.04 });
    const titleBottom = 63 + Math.max(0, titleLines.length - 1) * 6.8;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(6.5);
    setColor(doc, COLORS.muted);
    doc.text(tracked(cleanText(period).toUpperCase()), 105, titleBottom + 7.2, { align: "center" });
    doc.setDrawColor(...COLORS.warm);
    doc.setLineWidth(0.45);
    doc.line(96, titleBottom + 13.5, 114, titleBottom + 13.5);
    drawFooter(doc, pageNumber);
    return titleBottom + 23;
  }

  doc.setFont("Roboto", "bold");
  doc.setFontSize(8);
  setColor(doc, COLORS.red);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 21);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8.5);
  setColor(doc, COLORS.ink);
  doc.text(cleanText(menuTitle), 188, 21, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(22, 27, 188, 27);
  drawFooter(doc, pageNumber);
  return 38;
}

function drawSectionTitle(doc, label, y, sectionIndex) {
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7);
  setColor(doc, COLORS.warm);
  doc.text(String(sectionIndex + 1).padStart(2, "0"), 24, y);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(8.6);
  setColor(doc, COLORS.red);
  const displayLabel = tracked(label);
  doc.text(displayLabel, 36, y);
  const labelWidth = doc.getTextWidth(displayLabel);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(43 + labelWidth, y - 0.7, 186, y - 0.7);
  return y + 9.5;
}

function measureDish(doc, dish) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10.6);
  const title = `${cleanText(dish.name)}${dish.vegetarian ? "  (V)" : ""}`;
  const titleLines = doc.splitTextToSize(title, 132);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.7);
  const descriptionLines = doc.splitTextToSize(cleanText(dish.description), 152).slice(0, 3);
  const height = titleLines.length * 4.25 + (descriptionLines.length ? descriptionLines.length * 3.3 + 1 : 0) + 4.8;
  return { titleLines, descriptionLines, height };
}

function drawDish(doc, dish, y, measured) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10.6);
  setColor(doc, COLORS.ink);
  doc.text(measured.titleLines, 36, y, { lineHeightFactor: 1.06 });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.2);
  setColor(doc, COLORS.ink);
  doc.text(`${priceLabel(dish.price)} €`, 184, y, { align: "right" });

  const descriptionY = y + measured.titleLines.length * 4.6 + 0.2;
  if (measured.descriptionLines.length) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.7);
    setColor(doc, COLORS.muted);
    doc.text(measured.descriptionLines, 36, descriptionY, { lineHeightFactor: 1.2 });
  }
  return y + measured.height;
}

/**
 * Build the exact PDF document used by the browser download.
 * @param {{ menuTitle: string, period: string, dishes: Array<{ course: string, name: string, description: string, price: number, vegetarian?: boolean }> }} options
 */
export function buildMenuPdf({ menuTitle, period, dishes, logoDataUrl }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc);
  const safeTitle = cleanText(menuTitle || "La carte");
  const safePeriod = cleanText(period || "Carte du moment");
  let pageNumber = 1;
  let y = drawPage(doc, safeTitle, safePeriod, pageNumber, true, logoDataUrl);

  for (const [sectionIndex, course] of COURSE_ORDER.entries()) {
    const items = dishes.filter((dish) => dish.course === course);
    if (!items.length) continue;

    if (y + 15 > 270) {
      doc.addPage();
      pageNumber += 1;
      y = drawPage(doc, safeTitle, safePeriod, pageNumber, false, logoDataUrl);
    }
    y = drawSectionTitle(doc, COURSE_LABELS[course], y, sectionIndex);

    for (const dish of items) {
      const measured = measureDish(doc, dish);
      if (y + measured.height > 272) {
        doc.addPage();
        pageNumber += 1;
        y = drawPage(doc, safeTitle, safePeriod, pageNumber, false, logoDataUrl);
        y = drawSectionTitle(doc, `${COURSE_LABELS[course]} - SUITE`, y, sectionIndex);
      }
      y = drawDish(doc, dish, y, measured);
    }
    y += 5;
  }

  doc.setProperties({
    title: `${safeTitle} - Chez Auguste`,
    subject: "Carte du restaurant Chez Auguste",
    author: "Chez Auguste",
    creator: "Le carnet de cuisine Chez Auguste",
  });
  return doc;
}

export function downloadMenuPdf(options) {
  const doc = buildMenuPdf(options);
  const filename = `carte-chez-auguste-${fileSlug(options.period || options.menuTitle)}.pdf`;
  doc.save(filename);
  return filename;
}

const TOTAL_PAGES_TOKEN = "{total_pages_count_string}";

function marginLabel(recipe) {
  const price = Number(recipe.price || 0);
  const cost = Number(recipe.cost || 0);
  return price > 0 ? `${Math.round(((price - cost) / price) * 100)} %` : "-";
}

function quantityLabel(quantity, unit) {
  const value = Number(quantity || 0);
  if (unit === "g" && value >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  if (unit === "ml" && value >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${cleanText(unit)}`;
}

function drawRecipeBookFooter(doc, pageNumber) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(22, 281, 188, 281);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.2);
  setColor(doc, COLORS.muted);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 286);
  doc.text("LIVRE DE RECETTES · DOCUMENT DE TRAVAIL", 105, 286, { align: "center" });
  doc.setFont("Roboto", "bold");
  setColor(doc, COLORS.ink);
  doc.text(`${String(pageNumber).padStart(2, "0")} / ${TOTAL_PAGES_TOKEN}`, 188, 286, { align: "right" });
}

function drawRecipeBookCover(doc, recipes, logoDataUrl, pageNumber) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 76, 24, 58, 42, undefined, "FAST");
  else {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(17);
    setColor(doc, COLORS.red);
    doc.text(tracked("CHEZ AUGUSTE"), 105, 48, { align: "center" });
  }

  doc.setFont("Roboto", "bold");
  doc.setFontSize(7);
  setColor(doc, COLORS.red);
  doc.text(tracked("CARNET DE CUISINE"), 105, 83, { align: "center" });
  doc.setFontSize(26);
  setColor(doc, COLORS.ink);
  doc.text("Le livre de recettes", 105, 99, { align: "center" });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.5);
  setColor(doc, COLORS.muted);
  doc.text("Fiches techniques imprimables · ingrédients · méthode · coûts", 105, 109, { align: "center" });

  doc.setDrawColor(...COLORS.warm);
  doc.setLineWidth(0.5);
  doc.line(92, 121, 118, 121);

  const counts = COURSE_ORDER.map((course) => ({ course, count: recipes.filter((recipe) => recipe.course === course).length }));
  const startX = 34;
  counts.forEach(({ course, count }, index) => {
    const x = startX + index * 48;
    doc.setFillColor(255, 253, 250);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(x, 139, 42, 33, 3, 3, "FD");
    doc.setFont("Roboto", "bold");
    doc.setFontSize(17);
    setColor(doc, COLORS.ink);
    doc.text(String(count), x + 21, 153, { align: "center" });
    doc.setFontSize(6.5);
    setColor(doc, COLORS.red);
    doc.text(tracked(`${course.toUpperCase()}S`), x + 21, 163, { align: "center" });
  });

  doc.setFont("Roboto", "bold");
  doc.setFontSize(34);
  setColor(doc, COLORS.red);
  doc.text(String(recipes.length), 105, 208, { align: "center" });
  doc.setFontSize(7);
  setColor(doc, COLORS.muted);
  doc.text(tracked("RECETTES AU TOTAL"), 105, 218, { align: "center" });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7);
  doc.text(`Édité le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}`, 105, 236, { align: "center" });
  drawRecipeBookFooter(doc, pageNumber);
}

function drawRecipeContinuationHeader(doc, recipe, pageNumber, label) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7.2);
  setColor(doc, COLORS.red);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 20);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  setColor(doc, COLORS.ink);
  doc.text(`${cleanText(recipe.name)} · ${label}`, 188, 20, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.line(22, 27, 188, 27);
  drawRecipeBookFooter(doc, pageNumber);
  return 38;
}

function drawRecipeHeader(doc, recipe, pageNumber) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7.2);
  setColor(doc, COLORS.red);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 19);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.5);
  setColor(doc, COLORS.muted);
  doc.text(tracked("FICHE TECHNIQUE"), 188, 19, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.line(22, 26, 188, 26);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(6.8);
  setColor(doc, COLORS.red);
  doc.text(tracked(`${cleanText(recipe.course)} · ${cleanText(recipe.family)}`), 22, 37);
  doc.setFontSize(18);
  setColor(doc, COLORS.ink);
  const titleLines = doc.splitTextToSize(cleanText(recipe.name), 158).slice(0, 2);
  doc.text(titleLines, 22, 49, { lineHeightFactor: 1.04 });
  let y = 49 + titleLines.length * 7;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.7);
  setColor(doc, COLORS.muted);
  const descriptionLines = doc.splitTextToSize(cleanText(recipe.description), 165).slice(0, 3);
  doc.text(descriptionLines, 22, y, { lineHeightFactor: 1.22 });
  y += Math.max(1, descriptionLines.length) * 3.8 + 7;

  const metrics = [
    ["COÛT / PORTION", `${priceLabel(recipe.cost)} €`],
    ["PRIX CARTE", `${priceLabel(recipe.price)} €`],
    ["MARGE BRUTE", marginLabel(recipe)],
    ["MISE EN PLACE", `${Number(recipe.prep || 0)} min`],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 22 + index * 41.5;
    doc.setFillColor(255, 253, 250);
    doc.setDrawColor(...COLORS.line);
    doc.rect(x, y, 41.5, 22, "FD");
    doc.setFont("Roboto", "normal");
    doc.setFontSize(5.6);
    setColor(doc, COLORS.muted);
    doc.text(label, x + 4, y + 7);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(10.5);
    setColor(doc, COLORS.ink);
    doc.text(value, x + 4, y + 16);
  });
  drawRecipeBookFooter(doc, pageNumber);
  return y + 33;
}

function drawBookSectionTitle(doc, title, y) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7);
  setColor(doc, COLORS.red);
  doc.text(tracked(title), 22, y);
  const labelWidth = doc.getTextWidth(tracked(title));
  doc.setDrawColor(...COLORS.line);
  doc.line(28 + labelWidth, y - 0.7, 188, y - 0.7);
  return y + 8;
}

/**
 * Build the printable technical recipe book used by the browser download.
 * @param {{ recipes: Array<object>, portions?: number, logoDataUrl?: string }} options
 */
export function buildRecipeBookPdf({ recipes, portions = 10, logoDataUrl }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc);
  const orderedRecipes = [...recipes].sort((left, right) => {
    const courseDifference = COURSE_ORDER.indexOf(left.course) - COURSE_ORDER.indexOf(right.course);
    return courseDifference || cleanText(left.name).localeCompare(cleanText(right.name), "fr");
  });
  let pageNumber = 1;
  drawRecipeBookCover(doc, orderedRecipes, logoDataUrl, pageNumber);

  for (const recipe of orderedRecipes) {
    doc.addPage();
    pageNumber += 1;
    let y = drawRecipeHeader(doc, recipe, pageNumber);
    y = drawBookSectionTitle(doc, `INGRÉDIENTS · POUR ${portions} PORTIONS`, y);

    for (const ingredient of recipe.ingredients || []) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7.7);
      const nameLines = doc.splitTextToSize(cleanText(ingredient.name), 125);
      const rowHeight = Math.max(7, nameLines.length * 3.5 + 2);
      if (y + rowHeight > 270) {
        doc.addPage();
        pageNumber += 1;
        y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "ingrédients — suite");
        y = drawBookSectionTitle(doc, "INGRÉDIENTS · SUITE", y);
      }
      doc.setDrawColor(...COLORS.line);
      doc.line(22, y + rowHeight - 1.2, 188, y + rowHeight - 1.2);
      setColor(doc, COLORS.ink);
      doc.text(nameLines, 24, y + 2.7, { lineHeightFactor: 1.15 });
      doc.setFont("Roboto", "bold");
      doc.text(quantityLabel(Number(ingredient.quantity || 0) * portions, ingredient.unit), 186, y + 2.7, { align: "right" });
      y += rowHeight;
    }

    y += 8;
    if (y + 18 > 270) {
      doc.addPage();
      pageNumber += 1;
      y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "méthode");
    }
    y = drawBookSectionTitle(doc, "MÉTHODE", y);
    for (const [index, step] of (recipe.steps || []).entries()) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7.7);
      const stepLines = doc.splitTextToSize(cleanText(step), 146);
      const rowHeight = Math.max(10, stepLines.length * 3.8 + 3);
      if (y + rowHeight > 270) {
        doc.addPage();
        pageNumber += 1;
        y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "méthode — suite");
        y = drawBookSectionTitle(doc, "MÉTHODE · SUITE", y);
      }
      doc.setFillColor(...COLORS.red);
      doc.circle(27, y + 2, 3.2, "F");
      doc.setFont("Roboto", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(255, 253, 250);
      doc.text(String(index + 1), 27, y + 2.8, { align: "center" });
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7.7);
      setColor(doc, COLORS.ink);
      doc.text(stepLines, 36, y, { lineHeightFactor: 1.2 });
      y += rowHeight;
    }

    const allergens = (recipe.allergens || []).length ? recipe.allergens.join(" · ") : "Aucun allergène déclaré";
    const allergenLines = doc.splitTextToSize(cleanText(allergens), 135);
    const allergenHeight = Math.max(16, allergenLines.length * 3.5 + 9);
    if (y + allergenHeight + 5 > 270) {
      doc.addPage();
      pageNumber += 1;
      y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "informations");
    }
    y += 5;
    doc.setFillColor(248, 243, 236);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(22, y, 166, allergenHeight, 2.5, 2.5, "FD");
    doc.setFont("Roboto", "bold");
    doc.setFontSize(6.2);
    setColor(doc, COLORS.red);
    doc.text("ALLERGÈNES", 27, y + 6);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.2);
    setColor(doc, COLORS.ink);
    doc.text(allergenLines, 52, y + 6, { lineHeightFactor: 1.15 });
  }

  if (typeof doc.putTotalPages === "function") doc.putTotalPages(TOTAL_PAGES_TOKEN);
  doc.setProperties({
    title: "Livre de recettes - Chez Auguste",
    subject: "Fiches techniques de cuisine",
    author: "Chez Auguste",
    creator: "Le carnet de cuisine Chez Auguste",
  });
  return doc;
}

export function downloadRecipeBookPdf(options) {
  const doc = buildRecipeBookPdf(options);
  const filename = "livre-recettes-chez-auguste.pdf";
  doc.save(filename);
  return filename;
}
