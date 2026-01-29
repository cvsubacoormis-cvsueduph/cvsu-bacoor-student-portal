import { currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";

export default async function Menu() {
  const user = await currentUser();
  const role = user?.publicMetadata.role as string;
  const menuItems = [
    {
      title: "MENU",
      items: [
        {
          icon: "/home.png",
          label: "Dashboard",
          href: "/admin",
          visible: ["admin", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/home.png",
          label: "Dashboard",
          href: "/admin",
          visible: ["superuser"],
        },
        {
          icon: "/home.png",
          label: "Dashboard",
          href: "/student",
          visible: ["student"],
        },
        {
          icon: "/calendar.png",
          label: "Course Curriculum",
          href: "/list/curriculum",
          visible: ["admin", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/calendar.png",
          label: "Subject Offerings",
          href: "/list/subject-offering",
          visible: ["admin", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/student.png",
          label: "Students",
          href: "/list/students",
          visible: ["admin", "superuser", "registrar"],
        },
        {
          icon: "/student.png",
          label: "Pending Approvals",
          href: "/list/approve-students",
          visible: ["admin", "superuser",],
        },
        {
          icon: "/profile.png",
          label: "Admins",
          href: "/list/admin-lists",
          visible: ["admin", "superuser"],
        },
        {
          icon: "/subject.png",
          label: "Enrolled Subjects",
          href: "/list/enrolledsubjects",
          visible: ["student"],
        },
        {
          icon: "/attendance.png",
          label: "Pre-Registration",
          href: "/list/preregistration",
          visible: ["student"],
        },
        {
          icon: "/calendar.png",
          label: "Events",
          href: "/list/events",
          visible: ["admin", "student", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/result.png",
          label: "Grades",
          href: "/list/grades",
          visible: ["student"],
        },
        {
          icon: "/result.png",
          label: "Upload / Insert Grades",
          href: "/list/uploading",
          visible: ["admin", "superuser", "faculty"],
        },
        {
          icon: "/calendar.png",
          label: "Grades Lists",
          href: "/list/grades-lists",
          visible: ["admin", "superuser", "registrar", "faculty"],
        },
        {
          icon: "/assignment.png",
          label: "Checklist",
          href: "/list/checklists",
          visible: ["student"],
        },
        {
          icon: "/announcement.png",
          label: "Announcements",
          href: "/list/announcements",
          visible: ["admin", "student", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/assignment.png",
          label: "News",
          href: "/list/news",
          visible: ["admin", "superuser", "faculty", "registrar"],
        },
      ],
    },
    {
      title: "OTHER",
      items: [
        {
          icon: "/profile.png",
          label: "Profile",
          href: "/list/profile",
          visible: ["student"],
        },
        {
          icon: "/profile.png",
          label: "Admin Profile",
          href: "/list/adminprofile",
          visible: ["admin", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/profile.png",
          label: "Create Admin",
          href: "/list/create-admin",
          visible: ["superuser"],
        },
        {
          icon: "/result.png",
          label: "Logs",
          href: "/list/logs",
          visible: ["admin", "superuser", "faculty", "registrar"],
        },
        {
          icon: "/profile.png",
          label: "Create User",
          href: "/list/create-user",
          visible: ["admin"],
        },
        {
          icon: "/subject.png",
          label: "Seed a Subject Offering",
          href: "/list/seed",
          visible: ["admin"],
        },
        {
          icon: "/subject.png",
          label: "Logged in Schedule",
          href: "/list/schedule",
          visible: ["admin"],
        },
      ],
    },
  ];

  return (
    <div className="mt-4 text-sm">
      {menuItems.map((i) => (
        <div className="flex flex-col gap-2" key={i.title}>
          <span className="hidden lg:block text-gray-400 font-light my-4">
            {i.title}
          </span>
          {i.items.map((item) => {
            if (item.visible.includes(role!)) {
              return (
                <Link
                  href={item.href}
                  key={item.label}
                  className="flex items-center justify-center lg:justify-start gap-4 text-gray-500 py-2 md:px-2 rounded-md hover:bg-gray-100"
                >
                  <Image src={item.icon} alt="icons" width={20} height={20} />
                  <span className="hidden lg:block">{item.label}</span>
                </Link>
              );
            }
          })}
        </div>
      ))}
    </div>
  );
}
