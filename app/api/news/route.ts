import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
    console.log("Error fetching news:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { title, category, content, important, author } = await request.json();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    console.log("Error creating news:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Validate request body
  const { title, category, description, important, author, id } =
    await request.json();

  console.log({ title, category, description, important, author, id });

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

    console.log("News updated successfully", news);
    return NextResponse.json(news);
  } catch (error) {
    console.log("Error updating news:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

    console.log("News deleted successfully");
    return NextResponse.json({ message: "News deleted successfully" });
  } catch (error) {
    console.log("Error deleting news:", error);
    return NextResponse.json({ message: "Error deleting news" });
  }
}
