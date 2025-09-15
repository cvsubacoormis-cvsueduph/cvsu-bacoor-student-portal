import Announcements from "@/components/Announcements";
import BigCalendar from "@/components/BigCalendar";
import EventCalendar from "@/components/EventCalendar";
import { NewsAndUpdates } from "@/components/NewsAndUpdates";
import { StudentCard } from "@/components/StudentCard";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

export default function StudentPage() {
  return (
    <>
      <SignedIn>
        <div className="p-4 flex gap-4 flex-col xl:flex-row">
          {/* LEFT */}
          <div className="w-full xl:w-2/3">
            <div className="h-full bg-white p-4 rounded-md">
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <span className="text-xs flex text-gray-500 mb-4 font-semibold">
                Student Dashboard
              </span>
              <div className="mb-4">
                <StudentCard />
              </div>
              <NewsAndUpdates />
            </div>
          </div>
          {/* RIGHT */}
          <div className="w-full xl:w-1/3 flex flex-col gap-8">
            <EventCalendar />
            <Announcements />
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
