"use client";

/**
 * Shared Certificate of Grades (COG) PDF builder.
 *
 * Extracted verbatim from the original per-component implementations so the
 * student portal, the admin list, and the "View Grades" term button all emit
 * an identical document. `cog-variant` only decides the variant-specific
 * footer/watermark; the rest of the layout is shared.
 *
 * This is a client module: it uses `document`, `crypto.subtle`, and triggers a
 * browser download via `doc.save()`.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { storeCogVerification } from "@/actions/cog-verification";
import {
  courseClerkshipMap,
  courseMap,
  coursePositionMap,
  formatMajor,
} from "@/lib/courses";
import { semesterMap } from "@/lib/utils";

export type CogGrade = {
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string | null;
  remarks: string;
  instructor: string;
  academicYear: string;
  semester: string;
};

export type CogStudent = {
  studentNumber: string;
  firstName: string;
  middleInit?: string | null;
  lastName: string;
  course: string;
  major: string | null;
  grades: CogGrade[];
};

export type CogVariant = "admin" | "student";

/**
 * Name + position printed on the signature line.
 *
 * Resolved by the caller because it depends on *who* is generating:
 * staff sign as themselves, while a student-generated COG carries the
 * registrar assigned to the student's program.
 */
export interface CogSignatory {
  /** Printed above the signature line. */
  name: string;
  /** Printed beneath the signature line; omitted when blank. */
  position: string;
}

export interface CogPdfOptions {
  student: CogStudent;
  grades: CogGrade[];
  academicYear: string;
  semester: string;
  yearLevel: string;
  purpose: string;
  includeStamp: boolean;
  variant: CogVariant;
  /**
   * Who signs the document. When omitted, falls back to the registrar assigned
   * to the student's program via {@link resolveDefaultSignatory} — the correct
   * behaviour for a student generating their own copy.
   */
  signatory?: CogSignatory;
}

/**
 * Fallback signatory: the registrar clerk/campus registrar assigned to a
 * program. Used when no staff member is signing as themselves.
 */
export function resolveDefaultSignatory(course: string): CogSignatory {
  return {
    name: courseClerkshipMap(course).trim(),
    position: coursePositionMap(course).trim(),
  };
}

/**
 * Resolves who signs a COG, given the acting user's role and name.
 *
 * - `admin` / `registrar` sign as themselves.
 * - anyone else (notably a student generating their own copy) falls back to the
 *   registrar assigned to the student's program.
 *
 * A staff member whose Clerk name is missing also falls back, so the signature
 * line is never rendered empty for want of a profile field.
 */
export function resolveSignatory({
  role,
  firstName,
  lastName,
  course,
}: {
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  course: string;
}): CogSignatory {
  if (!COG_SIGNING_ROLES.includes(role as CogSigningRole)) {
    return resolveDefaultSignatory(course);
  }

  const staffName = [firstName, lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  if (!staffName) {
    return resolveDefaultSignatory(course);
  }

  return {
    name: staffName,
    position: coursePositionForRole(role as CogSigningRole),
  };
}

/** Only printing is permitted — prevents grade tampering by recipients. */
const PDF_PERMISSIONS: ["print"] = ["print"];

/**
 * Roles that sign a COG as themselves rather than deferring to the program's
 * assigned registrar.
 *
 * This mirrors {@link COG_GENERATION_ROLES} in `lib/cog-roles.ts` exactly —
 * `registrar_staff` is deliberately excluded there and therefore never reaches
 * a COG surface, so it must not be listed here either. Keeping the two in step
 * means the signing branch can only run for a role that is allowed to generate
 * the document in the first place.
 */
const COG_SIGNING_ROLES = ["admin", "registrar"] as const;

type CogSigningRole = (typeof COG_SIGNING_ROLES)[number];

/**
 * Position printed beneath a staff signatory's name.
 *
 * Both permitted roles sign in the capacity of the campus registrar.
 */
function coursePositionForRole(role: CogSigningRole): string {
  switch (role) {
    case "registrar":
    case "admin":
      return "Campus Registrar";
  }
}

/**
 * Grades that earn no credit and are excluded from the enrolled-unit total.
 */
const NON_CREDIT_GRADES = ["DRP", "INC", "FAILED", "4.00", "5.00", "US"];

/** Grades rendered in red in the grade / remarks columns. */
const FAILING_GRADES = ["DRP", "INC", "4.00", "5.00", "US"];

/** Remarks rendered in red. */
const FAILING_REMARKS = ["FAILED", "CON. FAILURE", "LACK OF REQ", "DROPPED"];

/**
 * Resolves the grade used for GPA math.
 * INC/DRP fall back to the re-exam; otherwise the better of the two passes.
 * Returns null when the subject cannot contribute to a GPA.
 */
export function resolveFinalGrade(grade: {
  grade: string;
  reExam?: string | null;
}): number | null {
  if (["INC", "DRP"].includes(grade.grade)) {
    if (grade.reExam === null || grade.reExam === undefined) return null;
    if (["INC", "DRP"].includes(grade.reExam)) return null;
    return parseFloat(grade.reExam);
  }

  const originalGrade = !isNaN(parseFloat(grade.grade))
    ? parseFloat(grade.grade)
    : null;
  const reExamGrade =
    grade.reExam && !isNaN(parseFloat(grade.reExam))
      ? parseFloat(grade.reExam)
      : null;

  if (originalGrade === null && reExamGrade === null) return null;
  if (originalGrade === null) return reExamGrade;
  if (reExamGrade === null) return originalGrade;
  return Math.min(originalGrade, reExamGrade);
}

/**
 * SHA-256 of the grade payload, embedded in the PDF for tamper detection.
 * The registrar can recompute it to prove the grades were not altered.
 */
export async function generateIntegrityHash(
  grades: CogGrade[],
): Promise<string> {
  const data = JSON.stringify(
    grades.map((g) => ({
      c: g.courseCode,
      g: g.grade,
      r: g.reExam,
      u: g.creditUnit,
      rm: g.remarks,
    })),
  );
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(data),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Filename for the generated document. */
export function cogFileName(studentNumber: string): string {
  return `Certificate-of-Grades-${studentNumber}.pdf`;
}

/**
 * Multi-layered blue wavy background used on every COG page.
 *
 * Written to a canvas and embedded as a PNG. This is safe for file size because
 * the artwork is smooth gradient fills that deflate to a few KB — the real
 * saving comes from {@link generateCOGPdf}'s `compress: true`, without which
 * jsPDF stores the bitmap uncompressed.
 */
function drawWavyBackground(doc: jsPDF) {
  // Rendered at 4x A4 (≈400 DPI) so the wave edges stay crisp in print. The
  // PNG that results is small enough that this costs almost nothing once the
  // PDF stream is compressed.
  const scale = 4;
  const canvas = document.createElement("canvas");
  const w = Math.round(210 * scale);
  const h = Math.round(297 * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const drawWaveLayer = (
    colorStops: [number, string][],
    maxY: number,
    cpOffsets: number[],
  ) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, maxY);
    const segments = 6;
    const segW = w / segments;
    for (let i = segments - 1; i >= 0; i--) {
      const x1 = (i + 1) * segW;
      const x2 = i * segW;
      const cp1x = x1 - segW * 0.5;
      const cp1y = maxY + cpOffsets[i % cpOffsets.length] * scale;
      const cp2x = x2 + segW * 0.5;
      const cp2y = maxY + cpOffsets[(i + 1) % cpOffsets.length] * scale;
      ctx.bezierCurveTo(
        cp1x,
        cp1y,
        cp2x,
        cp2y,
        x2,
        maxY + cpOffsets[(i + 2) % cpOffsets.length] * scale * 0.3,
      );
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, maxY + 40 * scale);
    for (const [stop, color] of colorStops) {
      grad.addColorStop(stop, color);
    }
    ctx.fillStyle = grad;
    ctx.fill();
  };

  drawWaveLayer(
    [
      [0, "rgba(100, 160, 220, 0.12)"],
      [0.6, "rgba(130, 185, 235, 0.06)"],
      [1, "rgba(180, 210, 245, 0.01)"],
    ],
    h * 0.25,
    [50, -20, 35, -10, 45, 0],
  );
  drawWaveLayer(
    [
      [0, "rgba(140, 195, 240, 0.10)"],
      [0.5, "rgba(160, 210, 242, 0.05)"],
      [1, "rgba(200, 225, 250, 0.01)"],
    ],
    h * 0.38,
    [-15, 45, -30, 25, -5, 40],
  );
  drawWaveLayer(
    [
      [0, "rgba(170, 215, 245, 0.09)"],
      [0.4, "rgba(185, 222, 248, 0.05)"],
      [1, "rgba(215, 235, 252, 0.01)"],
    ],
    h * 0.52,
    [30, -40, 20, -25, 50, -10],
  );
  drawWaveLayer(
    [
      [0, "rgba(195, 228, 250, 0.05)"],
      [0.3, "rgba(210, 235, 252, 0.03)"],
      [1, "rgba(235, 245, 255, 0.005)"],
    ],
    h * 0.62,
    [-25, 20, -35, 15, -10, 30],
  );

  // Keep PNG: this artwork deflates to a few KB losslessly (it is smooth
  // gradient fills), so a lossy format would risk artifacts for no gain. The
  // size win comes from `compress: true` on the document, not from here.
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
}

/** Institution letterhead. */
function drawHeader(doc: jsPDF) {
  const logoWidth = 18;
  const logoHeight = 15;
  const logoX = 40;
  const logoY = 5;

  doc.addImage("/printlogo.png", "PNG", logoX, logoY, logoWidth, logoHeight);
  doc.setFontSize(9);
  doc.text("Republic of the Philippines", 105, 11, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CAVITE STATE UNIVERSITY", 105, 16, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Bacoor City Campus", 105, 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("SHIV, Molino VI City of Bacoor", 105, 25, { align: "center" });
  doc.addImage("/phone.png", "PNG", 91, 28, 2, 2);
  doc.text("(046) 476-5029", 105, 30, { align: "center" });
  doc.text("cvsubacoor@cvsu.edu.ph", 105, 35, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("OFFICE OF THE CAMPUS REGISTRAR", 105, 45, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 139);
  doc.text("CERTIFICATE OF GRADES", 105, 50, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

/** Student identity / term block beneath the letterhead. */
function drawStudentBlock(
  doc: jsPDF,
  student: CogStudent,
  academicYear: string,
  semester: string,
  yearLevel: string,
) {
  const fullName = `${student.firstName}, ${student.middleInit || ""} ${
    student.lastName
  }`;
  const studentNo = student.studentNumber;
  const course = student.course;
  const major =
    student.major !== "NONE" && student.major ? student.major : "NONE";

  doc.setFontSize(7);
  doc.setTextColor(139, 0, 0);
  doc.text("Fullname:", 20, 60);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "bold");
  doc.text(fullName, 35, 60);
  const textWidth = doc.getTextWidth(fullName);
  doc.line(35, 61, 35 + textWidth, 61);
  doc.setTextColor(139, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Student No.:", 120, 60);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "bold");
  doc.text(studentNo, 140, 60);
  const studentNoWidth = doc.getTextWidth(studentNo);
  doc.line(140, 61, 140 + studentNoWidth, 61);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(139, 0, 0);
  doc.text("Year Level:", 20, 65);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "italic");
  doc.text(yearLevel, 35, 65);
  doc.setTextColor(139, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Academic Year:", 120, 65);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "italic");
  doc.text(
    `${semester ? semesterMap(semester).toUpperCase() : ""} ${
      academicYear ? academicYear.replace(/_/g, "-") : ""
    }`,
    140,
    65,
  );

  doc.setTextColor(139, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Degree:", 20, 70);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "italic");
  doc.text(courseMap(course).toUpperCase(), 35, 70);

  doc.setTextColor(139, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Major:", 20, 75);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "italic");
  doc.text(formatMajor(major) || "", 35, 75);
  doc.setTextColor(139, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Date:", 120, 70);
  doc.setTextColor(0, 0, 139);
  doc.setFont("helvetica", "italic");
  doc.text(
    new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    130,
    70,
  );
}

/** Main grades table. */
function drawGradesTable(doc: jsPDF, grades: CogGrade[]) {
  autoTable(doc, {
    startY: 85,
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1 },
    headStyles: {
      fillColor: [254, 240, 138],
      textColor: 0,
      halign: "center",
      lineWidth: 0.3,
      lineColor: 0,
    },
    bodyStyles: {
      lineWidth: 0.3,
      lineColor: 0,
      textColor: 0,
    },
    columnStyles: {
      2: { halign: "left", fontStyle: "italic" },
      0: { halign: "center" },
      1: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
    },
    theme: "grid",
    head: [
      [
        "CODE",
        "UNITS",
        "COURSE TITLE",
        "GRADE",
        "RE-EXAM",
        "REMARKS",
        "FACULTY",
      ],
    ],
    body: grades.map((g) => [
      g.courseCode,
      FAILING_GRADES.includes(g.grade) ? "0" : g.creditUnit.toString(),
      g.courseTitle,
      FAILING_GRADES.includes(g.grade)
        ? { content: g.grade || "-", styles: { textColor: [255, 0, 0] } }
        : { content: g.grade || "-", styles: { textColor: [0, 0, 0] } },
      g.reExam || "",
      FAILING_REMARKS.includes(g.remarks)
        ? { content: g.remarks || "", styles: { textColor: [255, 0, 0] } }
        : { content: g.remarks || "", styles: { textColor: [0, 0, 0] } },
      g.instructor || "",
    ]),
  });
}

/**
 * Totals block. Unit/GPA math intentionally matches the original documents:
 * DRP/INC/FAILED/4.00/5.00/US earn no credit, and CVSU 101 "S" counts toward
 * the GPA denominator but contributes no grade points.
 */
function drawTotals(doc: jsPDF, grades: CogGrade[], purpose: string) {
  const lastY = (doc as any).lastAutoTable.finalY;

  const totalSubjectsEnrolled = grades.length;

  const totalUnitsEnrolled = grades.reduce((acc, g) => {
    if (NON_CREDIT_GRADES.includes(String(g.grade))) return acc;
    return acc + g.creditUnit;
  }, 0);

  const totalGPAUnits = grades.reduce((acc, cur) => {
    if (NON_CREDIT_GRADES.includes(String(cur.grade))) return acc;
    if (cur.courseCode === "CVSU 101" && cur.grade === "S") {
      return acc + cur.creditUnit;
    }
    const finalGrade = resolveFinalGrade(cur);
    if (finalGrade === null || isNaN(finalGrade)) return acc;
    return acc + cur.creditUnit;
  }, 0);

  const totalCreditsEarned = grades.reduce((acc, cur) => {
    if (NON_CREDIT_GRADES.includes(String(cur.grade))) return acc;
    if (cur.courseCode === "CVSU 101") return acc;
    const finalGrade = resolveFinalGrade(cur);
    if (finalGrade === null || isNaN(finalGrade)) return acc;
    return acc + cur.creditUnit * finalGrade;
  }, 0);

  const gpa =
    totalGPAUnits > 0 && !isNaN(totalCreditsEarned)
      ? (totalCreditsEarned / totalGPAUnits).toFixed(2)
      : "0.00";

  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text(`Total Subjects Enrolled: ${totalSubjectsEnrolled}`, 20, lastY + 10);
  doc.text(`Total Credits Enrolled: ${totalUnitsEnrolled}`, 150, lastY + 10);
  doc.text(
    `Total Credits Earned: ${totalCreditsEarned.toFixed(2)}`,
    20,
    lastY + 16,
  );
  doc.text(`Grade Point Average: ${gpa}`, 150, lastY + 16);

  doc.setFont("helvetica", "bold");
  doc.text(`PURPOSE: ${purpose.toUpperCase()}`, 20, lastY + 38);

  return { gpa, totalSubjectsEnrolled, totalUnitsEnrolled, totalCreditsEarned };
}

/**
 * Registrar signature block.
 *
 * Renders the supplied signatory's name above a ruled signature line, with the
 * position beneath. Vertical placement is unchanged from the original
 * implementation; the position is now printed at the same x as the name (it
 * previously sat 5mm to the right, breaking the left alignment).
 */
function drawSignature(doc: jsPDF, signatory: CogSignatory) {
  const lastY = (doc as any).lastAutoTable.finalY;
  const { name, position } = signatory;

  if (!name && !position) return;

  doc.setFont("helvetica", "bold");

  if (name) {
    doc.text(name, 153, lastY + 38);
    const nameWidth = doc.getTextWidth(name);
    doc.line(153, lastY + 39, 153 + nameWidth, lastY + 39);
  } else {
    // No name to measure — still rule a line so the document can be signed.
    doc.line(153, lastY + 39, 203, lastY + 39);
  }

  if (position) {
    doc.text(position, 153, lastY + 42);
  }
}

/** Grading-system reference table plus the dry-seal note. */
function drawGradingSystem(doc: jsPDF) {
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 55,
    styles: {
      font: "helvetica",
      fontSize: 6,
      cellPadding: 1,
      halign: "center",
      lineWidth: 0.1,
      lineColor: 0,
    },
    headStyles: { fillColor: [255, 255, 255], textColor: 0 },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      lineWidth: 0.1,
      lineColor: 0,
    },
    theme: "striped",
    tableLineWidth: 0.1,
    tableLineColor: 0,
    body: [
      ["Grading System", "", "", "", "", ""],
      ["1.00", "Marked Excellent", "96.7 - 100", "2.75", "Fair", "73.4 - 76.6"],
      ["1.25", "Excellent", "93.4 - 96.6", "3.00", "Passed", "70.0 - 73.3"],
      [
        "1.50",
        "Very Superior",
        "90.1 - 93.3",
        "4.00",
        "Conditional Failure",
        "50.0 - 69.9",
      ],
      ["1.75", "Superior", "86.7 - 90.0", "5.00", "Failed", "below 50"],
      ["2.00", "Very Good", "83.4 - 86.6", "INC", "Incomplete", ""],
      ["2.25", "Good", "80.1 - 83.3", "DRP", "Dropped Subject", ""],
      ["2.50", "Satisfactory", "76.7 - 80.0", "", "", ""],
    ],
  });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(
    "Note: Not Valid without school dry seal.",
    20,
    (doc as any).lastAutoTable.finalY + 8,
  );
}

/** Stores the verification record and draws the "scan to verify" QR code. */
async function drawVerificationQr(
  doc: jsPDF,
  {
    student,
    grades,
    academicYear,
    semester,
    yearLevel,
    purpose,
    gpa,
    totalSubjectsEnrolled,
    totalUnitsEnrolled,
    totalCreditsEarned,
  }: {
    student: CogStudent;
    grades: CogGrade[];
    academicYear: string;
    semester: string;
    yearLevel: string;
    purpose: string;
    gpa: string;
    totalSubjectsEnrolled: number;
    totalUnitsEnrolled: number;
    totalCreditsEarned: number;
  },
) {
  try {
    const { hash } = await storeCogVerification({
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      middleInit: student.middleInit || "",
      course: student.course,
      major: student.major,
      grades: grades.map((g) => ({
        courseCode: g.courseCode,
        courseTitle: g.courseTitle,
        creditUnit: g.creditUnit,
        grade: g.grade,
        reExam: g.reExam,
        remarks: g.remarks,
        instructor: g.instructor,
      })),
      academicYear: academicYear || "",
      semester: semester || "",
      yearLevel,
      gpa,
      totalSubjects: totalSubjectsEnrolled,
      totalCredits: totalUnitsEnrolled,
      totalCreditsEarned: parseFloat(totalCreditsEarned.toFixed(2)),
      purpose,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const qrDataUrl = await QRCode.toDataURL(`${baseUrl}/verify/${hash}`, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    const qrY = (doc as any).lastAutoTable.finalY + 8;
    doc.addImage(qrDataUrl, "PNG", 165, qrY, 22, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text("Scan to verify", 165, qrY + 24, { align: "left" });
    doc.setTextColor(0, 0, 0);
  } catch (err) {
    // QR/verification is non-critical — log but don't block the download.
    console.warn("Failed to generate verification QR code:", err);
  }
}

/**
 * Draws a background image watermark across the page(s).
 * Ported as-is from the original implementation; the `watermarkText` parameter
 * is retained for signature compatibility with existing call sites.
 */
export function addWatermark(
  doc: jsPDF,
  watermarkText: string,
  options?: {
    backgroundImage?: string;
    imageOpacity?: number;
    imageWidth?: number;
    imageHeight?: number;
    centered?: boolean;
  },
) {
  const totalPages = (doc as any).internal.getNumberOfPages();
  const pageWidth = (doc as any).internal.pageSize.width;
  const pageHeight = (doc as any).internal.pageSize.height;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (options?.backgroundImage) {
      const opacity = options.imageOpacity ?? 0.1;
      const imgWidth = options.imageWidth ?? 406;
      const imgHeight = options.imageHeight ?? 100;

      const originalFillStyle = (doc as any).getFillColor?.();
      (doc as any).setGState(new (doc as any).GState({ opacity }));

      const xPos = (pageWidth - imgWidth) / 2;
      const yPos = (pageHeight - imgHeight) / 2;
      doc.addImage(
        options.backgroundImage,
        "PNG",
        xPos,
        yPos,
        imgWidth,
        imgHeight,
      );

      (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
      if (originalFillStyle) (doc as any).setFillColor?.(originalFillStyle);
    }
  }

  (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
  return doc;
}

/**
 * Builds and downloads the Certificate of Grades.
 *
 * The document carries:
 *  - a blue wavy background and CvSU letterhead,
 *  - the student/term block and the grades table,
 *  - a SHA-256 integrity hash written as invisible text,
 *  - a QR code linking to the public verification page,
 *  - owner-password encryption permitting printing only.
 */
export async function generateCOGPdf({
  student,
  grades,
  academicYear,
  semester,
  yearLevel,
  purpose,
  includeStamp,
  variant,
  signatory,
}: CogPdfOptions): Promise<void> {
  const ownerPassword = crypto.randomUUID();

  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    // Flate-compress the content streams. Without this jsPDF stores them
    // uncompressed, which is what made a text-plus-background COG balloon to
    // several megabytes.
    compress: true,
    encryption: {
      ownerPassword,
      userPermissions: [...PDF_PERMISSIONS],
    },
  });

  drawWavyBackground(doc);
  drawHeader(doc);
  drawStudentBlock(doc, student, academicYear, semester, yearLevel);
  drawGradesTable(doc, grades);

  const integrityHash = await generateIntegrityHash(grades);
  doc.setProperties({
    title: "Certificate of Grades",
    subject: `COG - ${student.studentNumber}`,
    author: "Cavite State University - Bacoor Campus Registrar",
    keywords: `COG,${student.studentNumber},${academicYear},${semester}`,
    creator: "CvSU Bacoor Portal",
  });

  // Invisible text carrying the tamper-evident hash and the owner password.
  // Note: the content stream is Flate-compressed and encrypted, so recovering
  // this marker requires inflating/decrypting the stream rather than grepping
  // the raw file bytes.
  doc.setFontSize(0.01);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `INTEGRITY_HASH:${integrityHash}|OWNER_PW:${ownerPassword}`,
    0.1,
    (doc as any).lastAutoTable.finalY + 70,
    { charSpace: -2 },
  );

  const totals = drawTotals(doc, grades, purpose);
  // Explicit signatory wins; otherwise defer to the program's registrar, which
  // is the correct default for a student-generated copy.
  drawSignature(doc, signatory ?? resolveDefaultSignatory(student.course));
  drawGradingSystem(doc);

  await drawVerificationQr(doc, {
    student,
    grades,
    academicYear,
    semester,
    yearLevel,
    purpose,
    gpa: totals.gpa,
    totalSubjectsEnrolled: totals.totalSubjectsEnrolled,
    totalUnitsEnrolled: totals.totalUnitsEnrolled,
    totalCreditsEarned: totals.totalCreditsEarned,
  });

  if (includeStamp) {
    doc.addImage(
      "/stamp.png",
      "PNG",
      15,
      (doc as any).lastAutoTable.finalY + 15,
      40,
      20,
    );
  }

  if (variant === "student") {
    // Students receive a clearly-marked electronic copy with a full-page mark.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ELECTRONIC COPY", 20, (doc as any).lastAutoTable.finalY + 15);

    addWatermark(doc, "ELECTRONIC COPY", {
      backgroundImage: "/ec.png",
      imageOpacity: 0.15,
      imageWidth: 210,
      imageHeight: 297,
      centered: true,
    });
  }

  doc.save(cogFileName(student.studentNumber));
}
