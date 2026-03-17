"use client";

import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateUserForm } from "./_components/create-user-form";
import { BulkUploadUsers } from "./_components/bulk-upload-users";

export default function CreateUserPage() {
  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="px-4 mx-auto">
            <Tabs defaultValue="manual" className="w-full space-y-6">
              <div className="flex justify-center">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="manual" className="w-full">
                <CreateUserForm />
              </TabsContent>

              <TabsContent value="bulk" className="w-full">
                <BulkUploadUsers />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
