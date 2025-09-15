import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

export default function PreRegistrationPage() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <h1 className="text-lg font-semibold">Pre-Registration</h1>
          <p className="text-xs text-gray-500">Student Pre-Registration</p>
        </div>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <p className="text-xl text-gray-500 font-semibold">Not Available</p>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
