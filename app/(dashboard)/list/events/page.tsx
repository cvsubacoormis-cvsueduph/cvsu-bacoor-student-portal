import EventsTable from "@/components/EventsTable";
import CreateEvents from "@/components/events/create-event";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function EventsLists() {
  const authResult = await auth();
  const { sessionClaims } = authResult;

  const role = (sessionClaims?.metadata as { role?: string })?.role;

  return (
    <>
      <SignedIn>
        <div className="flex-1 m-4 mt-0">
          {/* TOP CARD */}
          <div className="bg-white p-4 rounded-md mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold">All Events</h1>
                <p className="text-xs text-gray-500">Lists of Events</p>
              </div>

              {(role === "admin" || role === "superuser") && <CreateEvents />}
            </div>
          </div>

          {/* LIST CARD */}
          <div className="bg-white p-4 rounded-md">
            <EventsTable />
          </div>
        </div>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
