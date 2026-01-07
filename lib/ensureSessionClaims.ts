import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const clerk = await clerkClient();

export async function ensureUserClaims(userId?: string | null) {
    if (!userId) {
        const authData = await auth();
        userId = authData.userId;
    }

    if (userId) {
        const user = await clerk.users.getUser(userId);

        const hasCourse = (user.publicMetadata as any)?.course;

        if (!hasCourse) {
            const student = await prisma.student.findUnique({
                where: { id: userId },
                select: { course: true },
            });

            if (student?.course) {
                await clerk.users.updateUser(userId, {
                    publicMetadata: {
                        ...user.publicMetadata,
                        course: student.course,
                    },
                });
            }
        }
    }
}
