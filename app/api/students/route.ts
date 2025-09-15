// import { StudentSchema, studentSchema } from "@/lib/formValidationSchemas";
import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { Courses, Major, Status, UserSex } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";


// export async function GET() {
//   try {
//     const students = await prisma.student.findMany({
//       orderBy: {
//         createdAt: "desc",
//       },
//     });
//     return NextResponse.json(students);
//   } catch (error) {
//     console.error("Error fetching students:", error);
//     return NextResponse.json(
//       { message: "An unexpected error occurred" },
//       { status: 500 }
//     );
//   }
// }

// // export async function POST(request: NextRequest) {
// //   try {
// //     const body = await request.json();
// //     const result = studentSchema.safeParse(body);

// //     console.log(result);
// //     if (!result.success) {
// //       return NextResponse.json(
// //         {
// //           message: "Invalid input",
// //           errors: result.error.errors,
// //         },

// //         { status: 400 }
// //       );
// //     }

// //     const studentData = result.data;

// //     const clerk = await clerkClient();
// //     const user = await clerk.users.createUser({
// //       username: `${studentData.studentNumber}${studentData.firstName}`,
// //       password: `cvsubacoor${studentData.firstName}${studentData.studentNumber}`,
// //       firstName: studentData.firstName,
// //       lastName: studentData.lastName,
// //       publicMetadata: { role: "student" },
// //     });

// //     const Createstudent = await prisma.student.create({
// //       data: {
// //         id: user.id,
// //         studentNumber: String(studentData.studentNumber),
// //         username: `${studentData.studentNumber}${studentData.firstName}`,
// //         status: studentData.status as Status,
// //         course: studentData.course as Courses,
// //         major: (studentData?.major as Major) ?? "",
// //         firstName: studentData.firstName,
// //         lastName: studentData.lastName,
// //         middleInit: studentData?.middleInit,
// //         email: studentData?.email,
// //         phone: studentData.phone.toString(),
// //         address: studentData.address,
// //         sex: studentData.sex as UserSex,
// //       },
// //     });
// //     return NextResponse.json(Createstudent, { status: 201 });
// //   } catch (error) {
// //     console.error("Error creating student:", error);
// //     return NextResponse.json(
// //       { message: "An unexpected error occurred" },
// //       { status: 500 }
// //     );
// //   }
// // }

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "student id is required" },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    await clerk.users.deleteUser(id);

    const deleteStudent = await prisma.student.delete({
      where: {
        id,
      },
    });

    if (!deleteStudent) {
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
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
// export async function PUT(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const { id, ...rest } = body;
//     // const result = studentSchema.safeParse(rest);

//     if (!result.success) {
//       return NextResponse.json(
//         { message: "Invalid input", errors: result.error.errors },
//         { status: 400 }
//       );
//     }

//     const studentData = result.data as StudentSchema;

//     if (!id) {
//       return NextResponse.json({ message: "id is required" }, { status: 400 });
//     }

//     const updateStudent = await prisma.student.update({
//       where: { id },
//       data: {
//         studentNumber: String(studentData.studentNumber),
//         // username: studentData.username,
//         firstName: studentData.firstName,
//         lastName: studentData.lastName,
//         middleInit: studentData.middleInit || "",
//         email: studentData.email || "",
//         phone: studentData.phone,
//         address: studentData.address,
//         // birthday: studentData.birthday,
//         course: studentData.course,
//         sex: studentData.sex,
//         status: studentData.status,
//       },
//     });

//     if (!updateStudent) {
//       return NextResponse.json(
//         { message: "Student not found" },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json(updateStudent, { status: 200 });
//   } catch (error) {
//     console.error("Error updating student:", error);
//     return NextResponse.json(
//       { message: "An unexpected error occurred" },
//       { status: 500 }
//     );
//   }
// }
