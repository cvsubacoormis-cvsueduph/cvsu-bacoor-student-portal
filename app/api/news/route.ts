import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
export const runtime = "nodejs";


export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const news = await prisma.news.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(news);
  } catch (error) {
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "superuser" && role !== "registrar_staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkApiRateLimit("news_write", 15, 60);
  if (rl.error) return rl.error;

  const { title, category, content, important, author } = await request.json();
  try {
    const news = await prisma.news.create({
      data: {
        title,
        category,
        description: content,
        author,
        important: important,
      },
    });
    return NextResponse.json(news);
  } catch (error) {
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "superuser" && role !== "registrar_staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkApiRateLimit("news_write", 15, 60);
  if (rl.error) return rl.error;

  const { title, category, description, important, author, id } =
    await request.json();

  if (!id) {
    return NextResponse.json(
      { message: "News ID is required" },
      { status: 400 }
    );
  }

  try {
    const existingNews = await prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      return NextResponse.json({ message: "News not found" }, { status: 404 });
    }

    // Update news
    const news = await prisma.news.update({
      where: { id },
      data: {
        title,
        category,
        description,
        author,
        important: important,
      },
    });
    return NextResponse.json(news);
  } catch (error) {
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "superuser" && role !== "registrar_staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkApiRateLimit("news_write", 15, 60);
  if (rl.error) return rl.error;

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json(
      { message: "News ID is required" },
      { status: 400 }
    );
  }

  try {
    const existingNews = await prisma.news.findUnique({
      where: { id },
    });
    if (!existingNews) {
      return NextResponse.json({ message: "News not found" }, { status: 404 });
    }

    // Delete news
    await prisma.news.delete({
      where: { id },
    });
    return NextResponse.json({ message: "News deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting news" });
  }
}
