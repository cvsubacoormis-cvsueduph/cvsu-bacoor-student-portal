"use client";
import AnnouncementsTable from "@/components/AnnouncementsTable";
import CreateAnnouncements from "@/components/announcements/create-announcement";
import { RedirectToSignIn, SignedIn, SignedOut, useUser } from "@clerk/nextjs";

export default function AnnouncementsLists() {
  const { user, isLoaded } = useUser();

  const role = isLoaded ? user?.publicMetadata?.role : undefined;

  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          {/* TOP */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">
              All Announcements{" "}
              <span className=" flex text-xs text-gray-500">
                Lists of Announcements
              </span>
            </h1>
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-4 self-end">
                {/* Show CreateAnnouncements only if the user is an admin */}
                {role === "admin" && "superuser" && <CreateAnnouncements />}
              </div>
            </div>
          </div>
          {/* LIST */}
          <AnnouncementsTable />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
