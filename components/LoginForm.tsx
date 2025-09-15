"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { MoonLoader } from "react-spinners";

import DataPrivacy from "@/components/DataPrivacy";
import DataPrivacyEmployee from "@/components/DataPrivacyEmployee";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { EyeIcon, EyeOffIcon } from "lucide-react";

export default function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasAgreedToPrivacy, setHasAgreedToPrivacy] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const { user, isLoaded } = useUser();
  const router = useRouter();

  const role = user?.publicMetadata.role;

  const redirectByRole = useCallback(
    (role: string) => {
      switch (role) {
        case "admin":
        case "superuser":
        case "faculty":
        case "registrar":
          router.push("/admin");
          break;
        case "student":
          router.push("/student");
          break;
        default:
          router.push("/404");
      }
    },
    [router]
  );

  useEffect(() => {
    if (!isLoaded) return;

    if (user && !hasAgreedToPrivacy) {
      setIsDialogOpen(true);
    }
  }, [isLoaded, user, hasAgreedToPrivacy]);

  useEffect(() => {
    if (!isLoaded) return;

    if (user && hasAgreedToPrivacy) {
      redirectByRole(user.publicMetadata.role as string);
    }
  }, [isLoaded, user, hasAgreedToPrivacy, redirectByRole]);

  return (
    <div>
      <SignIn.Root>
        <SignIn.Step name="start">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Login to your account</h1>
              <Clerk.GlobalError className="block text-sm text-red-400" />
              <p className="text-xs text-muted-foreground">
                Enter your username and password below to login to your account
              </p>
            </div>

            <div className="grid gap-6">
              <Clerk.Field name="identifier" className="grid gap-2">
                <Clerk.Label
                  htmlFor="username"
                  className="text-sm font-semibold"
                >
                  Username
                </Clerk.Label>
                <Clerk.Input
                  id="username"
                  type="text"
                  placeholder="19010825name"
                  className="p-3 border border-blue-700 rounded-md text-sm focus:border-blue-900 focus:outline-none focus:ring-0 focus:border-2"
                />
                <Clerk.FieldError className="block text-sm text-red-400" />
              </Clerk.Field>
            </div>

            <div className="grid gap-2">
              <Clerk.Field name="password" className="grid gap-2">
                <div className="flex items-center">
                  <Clerk.Label
                    htmlFor="password"
                    className=" text-sm font-semibold"
                  >
                    Password
                  </Clerk.Label>
                </div>
                <div className="relative">
                  <Clerk.Input
                    id="password"
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="•••••••••••"
                    className="w-full p-3 border border-blue-700 rounded-md text-sm focus:border-blue-900 focus:outline-none focus:ring-0 focus:border-2"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  >
                    {isPasswordVisible ? (
                      <EyeIcon className="w-5 h-5 text-blue-700" />
                    ) : (
                      <EyeOffIcon className="w-5 h-5 text-blue-700" />
                    )}
                  </button>
                </div>
                <Clerk.FieldError className="block text-sm text-red-400" />
              </Clerk.Field>
            </div>
            <div id="clerk-captcha" />
            <SignIn.Action
              submit
              className="w-full bg-blue-700 hover:bg-blue-600 p-2 rounded-md text-white"
            >
              <Clerk.Loading>
                {(isLoading) =>
                  isLoading ? (
                    <div className="flex justify-center">
                      <MoonLoader size={15} color="white" />
                    </div>
                  ) : (
                    "Login"
                  )
                }
              </Clerk.Loading>
            </SignIn.Action>
          </div>

          <div className="text-center text-sm hover:text-blue-600 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="underline underline-offset-4">
              Register now
            </Link>
          </div>
        </SignIn.Step>
      </SignIn.Root>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="max-w-lg w-full bg-white p-6 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg text-center font-semibold">
              Data Privacy Policy
            </AlertDialogTitle>
          </AlertDialogHeader>
          {role === "student" ? <DataPrivacy /> : <DataPrivacyEmployee />}
          <Button
            className="w-full bg-blue-700 hover:bg-blue-600 mt-4"
            onClick={() => {
              setHasAgreedToPrivacy(true);
              setIsDialogOpen(false);
            }}
          >
            I Agree
          </Button>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
