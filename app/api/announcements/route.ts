import {
  AnnouncementSchema,
  announcementSchema,
} from "@/lib/formValidationSchemas";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "5", 10);
    const skip = (page - 1) * limit;

    const totalAnnouncements = await prisma.announcement.count();
    const announcements = await prisma.announcement.findMany({
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      announcements,
      totalPages: Math.ceil(totalAnnouncements / limit),
      currentPage: page,
    });
  } catch (error) {
    console.log("Error fetching announcements:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const result = announcementSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          message: "Invalid input",
          errors: result.error.errors,
        },

        { status: 400 }
      );
    }

    const announcementsData = result.data;

    const CreateAnnouncements = await prisma.announcement.create({
      data: {
        title: announcementsData.title,
        description: announcementsData.description || "",
        date: announcementsData.date,
      },
    });
    return NextResponse.json(CreateAnnouncements, { status: 201 });
  } catch (error) {
    console.error("Error creating announcements:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "announcement id is required" },
        { status: 400 }
      );
    }

    const deleteAnnouncement = await prisma.announcement.delete({
      where: {
        id: Number(id),
      },
    });

    if (!deleteAnnouncement) {
      return NextResponse.json(
        { message: "announcement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "announcement deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    const result = announcementSchema.safeParse(rest);

    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: result.error.errors },
        { status: 400 }
      );
    }

    const announcementData = result.data as AnnouncementSchema;

    if (!id) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }

    const updateAnnouncement = await prisma.announcement.update({
      where: { id },
      data: {
        title: announcementData.title,
        description: announcementData.description,
        date: announcementData.date,
      },
    });

    if (!updateAnnouncement) {
      return NextResponse.json(
        { message: "Announcement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updateAnnouncement, { status: 200 });
  } catch (error) {
    console.error("Error updating announcement:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
