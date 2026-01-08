import EmptyPage from "@/components/empty-page/EmptyPage";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { Construction } from "lucide-react";

export default function PreRegistrationPage() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <h1 className="text-lg font-semibold">Pre-Registration</h1>
          <p className="text-xs text-gray-500">Student Pre-Registration Form</p>
          <EmptyPage
            title="Coming Soon!"
            description="This feature is currently under development."
            icon={Construction}
          />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
