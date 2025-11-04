"use client";

import LoginForm from "@/components/LoginForm";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import PortalGuide from "@/components/PortalGuide";
import ForgotPassword from "@/components/ForgotPassword";

const Homepage = () => {
  const [hasAgreedToPrivacy, setHasAgreedToPrivacy] = useState(false);

  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const redirectByRole = (role: string) => {
      switch (role) {
        case "admin":
        case "superuser":
        case "faculty":
        case "registrar":
          router.replace("/admin");
          break;
        case "student":
          router.replace("/student");
          break;
        default:
          router.replace("/sign-in");
      }
    };

    if (user && hasAgreedToPrivacy) {
      redirectByRole(user.publicMetadata.role as string);
    }
  }, [isLoaded, user, hasAgreedToPrivacy, router]);

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10 border-r border-solid border-r-gray-300 dark:border-r-gray-700">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex items-center justify-center rounded-md text-primary-foreground">
              <Image src="/logos.png" alt="" width={150} height={150} />
            </div>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
            <div className="mt-4 text-center">
              <ForgotPassword />
            </div>
          </div>
        </div>
        <div>
          <PortalGuide />
        </div>
      </div>
      <div className="relative hidden lg:block">
        <Image
          src="/logos.png"
          alt="Image"
          className="absolute top-1/2 left-1/2 max-w-[600px] -translate-x-1/2 -translate-y-1/2 object-cover dark:brightness-[0.2] dark:grayscale"
          width={500}
          height={500}
        />
      </div>
    </div>
  );
};

export default Homepage;
