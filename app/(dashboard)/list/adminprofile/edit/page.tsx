import { getUserProfile } from "@/actions/admin/admin";
import { EditProfileForm } from "./_components/edit-profile-form";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function EditProfilePage() {
  const profile = await getUserProfile();

  // Only faculty and registrar should reach this page (middleware enforces it too)
  if (profile.role !== "faculty" && profile.role !== "registrar") {
    redirect("/list/adminprofile");
  }

  return (
    <>
      <SignedIn>
        <EditProfileForm
          profile={{
            username: profile.username,
            firstName: profile.firstName,
            lastName: profile.lastName,
            middleInit: "middleInit" in profile ? (profile.middleInit as string | null) : null,
            email: "email" in profile ? (profile.email as string | null) : null,
            phone: "phone" in profile ? (profile.phone as string | null) : null,
            address: profile.address || "",
            sex: profile.sex,
            role: profile.role,
          }}
        />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
