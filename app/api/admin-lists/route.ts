import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAdminSchema } from "@/lib/formValidationSchemas";
import { clerkClient } from "@clerk/nextjs/server";
import { UserSex } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admins = await prisma.admin.findMany();
    return NextResponse.json(admins, { status: 200 });
  } catch (error) {
    console.log("Error fetching admins:", error);
    return NextResponse.json(
      { message: "Failed to fetch admins" },
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
        { message: "admin id is required" },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    await clerk.users.deleteUser(id);

    const deleteAdmin = await prisma.admin.delete({
      where: {
        id,
      },
    });

    if (!deleteAdmin) {
      return NextResponse.json(
        { message: "student not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "student deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error deleting student:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "No id provided" }, { status: 400 });
  }

  const data = await request.json();

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUser(id, {
      firstName: data.firstName,
      lastName: data.lastName,
      publicMetadata: { role: "admin" },
    });

    await prisma.admin.update({ where: { id }, data });
    return NextResponse.json(
      { message: "Admin updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating admin:", error);
    return NextResponse.json(
      { message: "Failed to update admin" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await request.json();
  const result = createAdminSchema.safeParse(data);

  if (!result.success) {
    return NextResponse.json(
      {
        message: "Invalid input",
        errors: result.error.errors,
      },
      { status: 400 }
    );
  }

  const adminData = result.data;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.createUser({
      username: adminData.username,
      password: adminData.password,
      firstName: adminData.firstName,
      emailAddress: [adminData.email],
      lastName: adminData.lastName,
      publicMetadata: { role: "admin" },
    });

    const CreateAdmin = await prisma.admin.create({
      data: {
        id: user.id,
        firstName: adminData.firstName,
        middleInit: adminData.middleInit,
        lastName: adminData.lastName,
        username: adminData.username,
        email: adminData.email,
        address: adminData.address,
        phone: adminData.phone.toString(),
        birthday: adminData.birthday,
        sex: adminData.sex as UserSex,
      },
    });
    return NextResponse.json(CreateAdmin, { status: 201 });
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
