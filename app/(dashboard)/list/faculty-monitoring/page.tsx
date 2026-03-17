import { currentUser } from "@clerk/nextjs/server";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { FacultyMonitoringClient } from "@/components/FacultyMonitoringClient";

export default async function FacultyMonitoringPage() {
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const isAuthorized = role === "admin" || role === "superuser" || role === "registrar";

  if (!isAuthorized) {
    return (
      <div className="p-4 m-4 mt-0 bg-white rounded-md flex items-center justify-center h-64">
        <p className="text-gray-500">You are not authorized to view this page.</p>
      </div>
    );
  }

  return (
    <div className="">
      <SignedIn>
        <div className="bg-white p-4 rounded-md m-4 mt-0">
          <h2 className="text-lg font-semibold mb-1">Faculty Upload Monitoring</h2>
          <p className="text-sm text-gray-500 mb-6">
            Monitor which faculties have uploaded grades for specific academic terms.
          </p>
          <FacultyMonitoringClient />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
}
