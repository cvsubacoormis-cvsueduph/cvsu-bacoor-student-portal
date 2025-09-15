"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ isPasswordSet: false }, { status: 401 });
  }
  try {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { isPasswordSet: true },
    });
    if (!student) {
      return NextResponse.json({ isPasswordSet: false }, { status: 404 });
    }
    return NextResponse.json({ isPasswordSet: student.isPasswordSet });
  } catch (error) {
    return NextResponse.json({ isPasswordSet: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { password } = await req.json();
  const { userId } = await auth();

  if (!userId || !password) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await prisma.student.update({
    where: { id: userId },
    data: {
      isPasswordSet: true,
    },
  });

  return NextResponse.json({ success: true });
}
