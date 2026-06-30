import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

/**
 * GET /api/download/grade-change-form
 *
 * Serves the official UREG-QF-12 Request for Change of Grades form (.docx).
 * Faculty must download, complete, and email this form to the registrar
 * before submitting grade changes through the portal.
 */
export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = [
    "admin",
    "superuser",
    "registrar",
    "registrar_staff",
    "faculty",
  ];
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "UREG-QF-12-Request-for-Change-of-Grades.docx"
  );

  let fileBuffer: Buffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
  } catch {
    return NextResponse.json(
      { error: "Form file not found. Please contact the administrator." },
      { status: 404 }
    );
  }

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        'attachment; filename="UREG-QF-12-Request-for-Change-of-Grades.docx"',
      "Content-Length": String(fileBuffer.length),
    },
  });
}
