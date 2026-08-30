import type { ReportPdfData } from "@/lib/report-pdf";

export type XlsxDelivery = "downloaded" | "shared" | "cancelled";

const COLORS = {
  burgundy: "FF712C40",
  terracotta: "FFC2664B",
  terracottaDark: "FFA94F3B",
  rose: "FFF8E1E5",
  blush: "FFFFF4F1",
  cream: "FFFFFAF7",
  border: "FFE5D2CB",
  ink: "FF4B2E2F",
  muted: "FF806A66",
  white: "FFFFFFFF",
};

function excelDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function displayDate(value: string) {
  if (!value) return "À DÉFINIR";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function safeSheetName(value: string) {
  // ExcelJS does not escape apostrophes when it writes the sheet name into
  // print-area / print-title formulas. A project such as "L'appartement"
  // would therefore produce an invalid workbook that Excel tries to repair.
  const clean = value
    .replace(/[\\/*?:\[\]'’\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || "Compte rendu").slice(0, 31);
}

export async function buildReportXlsxBuffer(data: ReportPdfData) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.firm.name;
  workbook.lastModifiedBy = data.firm.name;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Compte rendu de chantier n°${data.report.meetingNumber}`;
  workbook.title = `${data.project.name} — CR n°${data.report.meetingNumber}`;
  workbook.company = data.firm.name;

  const worksheet = workbook.addWorksheet(
    safeSheetName(`CR ${data.report.meetingNumber} - ${data.project.name}`),
    {
      properties: { defaultRowHeight: 19 },
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.45,
          bottom: 0.45,
          header: 0.2,
          footer: 0.2,
        },
      },
      views: [{ state: "frozen", ySplit: 10, showGridLines: false }],
    },
  );

  worksheet.columns = [
    { key: "number", width: 7 },
    { key: "place", width: 25 },
    { key: "object", width: 72 },
    { key: "team", width: 24 },
  ];

  const thinBorder = {
    style: "thin" as const,
    color: { argb: COLORS.border },
  };
  const mediumBorder = {
    style: "medium" as const,
    color: { argb: COLORS.ink },
  };

  const styleMergedRow = (
    rowNumber: number,
    value: string,
    options?: {
      fill?: string;
      color?: string;
      bold?: boolean;
      size?: number;
      height?: number;
      border?: "thin" | "medium";
    },
  ) => {
    worksheet.mergeCells(`A${rowNumber}:D${rowNumber}`);
    const row = worksheet.getRow(rowNumber);
    row.height = options?.height ?? 24;
    const cell = worksheet.getCell(`A${rowNumber}`);
    cell.value = value;
    cell.font = {
      name: "Aptos",
      size: options?.size ?? 10,
      bold: options?.bold ?? false,
      color: { argb: options?.color ?? COLORS.ink },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: options?.fill ?? COLORS.cream },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
      indent: 1,
    };
    const border = options?.border === "medium" ? mediumBorder : thinBorder;
    cell.border = {
      top: border,
      bottom: border,
      left: border,
      right: border,
    };
  };

  worksheet.mergeCells("A1:C1");
  worksheet.mergeCells("D1:D2");
  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 25;
  worksheet.getCell("A1").value = data.firm.name;
  worksheet.getCell("A1").font = {
    name: "Aptos Display",
    size: 15,
    bold: true,
    color: { argb: COLORS.white },
  };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.burgundy },
  };
  worksheet.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  worksheet.mergeCells("A2:C2");
  worksheet.getCell("A2").value = `${data.firm.address} · ${data.firm.contact}`;
  worksheet.getCell("A2").font = {
    name: "Aptos",
    size: 9,
    color: { argb: COLORS.white },
  };
  worksheet.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.burgundy },
  };
  worksheet.getCell("A2").alignment = {
    vertical: "middle",
    wrapText: true,
    indent: 1,
  };
  worksheet.getCell("D1").value = `CR N°${data.report.meetingNumber}`;
  worksheet.getCell("D1").font = {
    name: "Aptos Display",
    size: 16,
    bold: true,
    color: { argb: COLORS.white },
  };
  worksheet.getCell("D1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.terracotta },
  };
  worksheet.getCell("D1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.mergeCells("A3:C3");
  worksheet.getCell("A3").value = data.project.name || "NOM DU PROJET";
  worksheet.getCell("A3").font = {
    name: "Aptos Display",
    size: 13,
    bold: true,
    color: { argb: COLORS.ink },
  };
  worksheet.getCell("A3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.rose },
  };
  worksheet.getCell("A3").alignment = { vertical: "middle", indent: 1 };
  worksheet.getRow(3).height = 25;
  worksheet.getCell("D3").value = "DATE DU CR";
  worksheet.getCell("D3").font = {
    name: "Aptos",
    size: 9,
    bold: true,
    color: { argb: COLORS.muted },
  };
  worksheet.getCell("D3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.rose },
  };
  worksheet.getCell("D3").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.mergeCells("A4:C4");
  worksheet.getCell("A4").value = [data.project.address, data.project.details]
    .filter(Boolean)
    .join(" · ");
  worksheet.getCell("A4").font = {
    name: "Aptos",
    size: 10,
    color: { argb: COLORS.ink },
  };
  worksheet.getCell("A4").alignment = {
    vertical: "middle",
    wrapText: true,
    indent: 1,
  };
  worksheet.getCell("D4").value = excelDate(data.report.meetingDate);
  worksheet.getCell("D4").numFmt = "dd/mm/yyyy";
  worksheet.getCell("D4").font = {
    name: "Aptos",
    size: 11,
    bold: true,
    color: { argb: COLORS.ink },
  };
  worksheet.getCell("D4").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  worksheet.getRow(4).height = 29;

  styleMergedRow(5, `PRÉSENTS : ${data.report.attendees || "À COMPLÉTER"}`);
  styleMergedRow(
    6,
    `DÉBUT DE CHANTIER : ${displayDate(data.project.siteStart)}`,
  );
  styleMergedRow(
    7,
    `POSE DE LA CUISINE : ${displayDate(data.project.kitchenInstall)} · FIN DE CHANTIER : ${displayDate(data.project.siteEnd)}`,
  );
  styleMergedRow(8, data.fixedWarning, {
    fill: COLORS.rose,
    color: COLORS.burgundy,
    bold: true,
    height: 26,
  });
  styleMergedRow(9, data.fixedReturn, {
    fill: COLORS.blush,
    bold: true,
    height: 24,
  });

  const headerRow = worksheet.getRow(10);
  headerRow.values = ["N°", "LOCALISATION", "OBJET", "CONCERNÉ"];
  headerRow.height = 27;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: { argb: COLORS.white },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.terracottaDark },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: mediumBorder,
      bottom: mediumBorder,
      left: thinBorder,
      right: thinBorder,
    };
  });

  const points = data.report.points.length
    ? data.report.points
    : [{ place: "", note: "", team: "" }];
  points.forEach((point, index) => {
    const row = worksheet.getRow(11 + index);
    row.values = [index + 1, point.place, point.note, point.team];
    row.height = Math.max(29, Math.min(90, 20 + Math.ceil(point.note.length / 65) * 15));
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: COLORS.ink } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? COLORS.cream : COLORS.blush },
      };
      cell.alignment = {
        vertical: "top",
        horizontal: columnNumber === 1 ? "center" : "left",
        wrapText: true,
      };
      cell.border = {
        bottom: thinBorder,
        left: columnNumber === 1 ? mediumBorder : thinBorder,
        right: columnNumber === 4 ? mediumBorder : thinBorder,
      };
    });
  });

  const lastPointRow = 10 + points.length;
  worksheet.autoFilter = {
    from: { row: 10, column: 1 },
    to: { row: lastPointRow, column: 4 },
  };

  let footerRow = lastPointRow + 2;
  styleMergedRow(
    footerRow,
    `NOTE SUPPLÉMENTAIRE : ${data.report.generalNotes || ""}`,
    { fill: COLORS.blush, height: data.report.generalNotes ? 38 : 28 },
  );
  footerRow += 1;
  styleMergedRow(footerRow, `FIN DU CR N°${data.report.meetingNumber}`, {
    fill: COLORS.burgundy,
    color: COLORS.white,
    bold: true,
    size: 11,
    height: 27,
    border: "medium",
  });
  footerRow += 1;
  styleMergedRow(footerRow, data.report.nextMeetingSentence, {
    fill: COLORS.rose,
    color: COLORS.burgundy,
    bold: true,
    height: 30,
  });
  footerRow += 1;
  styleMergedRow(
    footerRow,
    "MERCI DE VALIDER VOTRE RÉCEPTION DU COMPTE RENDU",
    { bold: true, height: 25 },
  );
  footerRow += 1;
  styleMergedRow(footerRow, data.fixedLegal, {
    color: COLORS.muted,
    size: 9,
    height: 48,
  });

  worksheet.pageSetup.printArea = `A1:D${footerRow}`;
  worksheet.pageSetup.printTitlesRow = "10:10";
  worksheet.headerFooter.oddFooter =
    `&L${data.project.name} — CR N°${data.report.meetingNumber}&RPage &P sur &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(buffer));
  return arrayBuffer;
}

export async function downloadReportXlsx(
  data: ReportPdfData,
  fileName: string,
): Promise<XlsxDelivery> {
  const arrayBuffer = await buildReportXlsxBuffer(data);
  const finalName = fileName.toLowerCase().endsWith(".xlsx")
    ? fileName
    : `${fileName}.xlsx`;
  const file = new File([arrayBuffer], finalName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (isIosDevice()) {
    try {
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Tableau du compte rendu n°${data.report.meetingNumber}`,
        });
        return "shared";
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = finalName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
