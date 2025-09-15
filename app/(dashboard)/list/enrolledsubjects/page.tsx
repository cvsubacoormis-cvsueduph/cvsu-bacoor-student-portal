import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

export default function EnrolledSubjectsPage() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <h1 className="text-lg font-semibold">Subject Enrolled</h1>
        </div>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <h1 className="text-lg font-semibold">Registration Form(s)</h1>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
