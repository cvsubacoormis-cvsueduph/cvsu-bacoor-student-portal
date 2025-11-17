"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  ListCheck,
  MessageSquare,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";

export default function PortalGuide() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  const openImagePreview = (imageName: string) => {
    setPreviewImage(imageName);
    setImagePreviewOpen(true);
  };
  const steps = [
    {
      title: "Welcome to the Student Portal",
      description: "Your one-stop platform for all academic needs",
      icon: GraduationCap,
      content: (
        <div className="space-y-4">
          <p>
            Welcome to{" "}
            <span className="font-medium">
              Cavite State University Bacoor City Campus Student Portal!
            </span>{" "}
            This guide will walk you through the main features and help you get
            started with the platform.
          </p>
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">Key Benefits:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Access your <span className="font-medium">courses</span> and{" "}
                <span className="font-medium">grades</span> in one place
              </li>
              <li>Track your academic progress and grades</li>
              <li>
                View the recent <span className="font-medium">events</span> and{" "}
                <span className="font-medium">announcements</span>
              </li>
              <li>
                Print your{" "}
                <span className="font-medium">certificate of grades</span> and{" "}
                <span className="font-medium">academic checklists</span>
              </li>
              <li>Access important resources and support services</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "Login & Account Setup",
      description: "Accessing your student account",
      icon: User,
      content: (
        <div className="space-y-4">
          <p>
            To access the Student Portal, you&apos;ll need to log in with your
            provided credentials. If this is your first time, you&apos;ll need
            to complete fill up the registration link below.
          </p>
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <h4 className="font-medium">Getting Started:</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Visit the portal login page at{" "}
                <span className="font-medium">
                  studentportal.cvsu-bacoor.com
                </span>
              </li>
              <li>
                Enter your username and password provided in your registration.
              </li>
              <li>
                Click the{" "}
                <span className="font-medium">
                  Fill up this form to register if you don&apos;t have an
                  account
                </span>{" "}
                link.
              </li>
              <li>Create up a new secure password in the registration form.</li>
              <li>
                Go to the MIS Coordinator and submit the registration form to
                approve your account.
              </li>
            </ol>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> For security reasons, use a strong password
              and never share your login credentials with others.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Dashboard Overview",
      description: "Your personalized homepage",
      icon: LayoutDashboard,
      content: (
        <div className="space-y-4">
          <p>
            The Dashboard is your personalized homepage that provides a quick
            overview of your academic information and important notifications.
          </p>
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium">Dashboard Features:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium">Announcements:</span> Important
                updates from the university and your courses
              </li>
              <li>
                <span className="font-medium">Events:</span> Important Events
                happening in your campus.
              </li>
              <li>
                <span className="font-medium">Grades</span>
                <span className="font-medium">: </span> Your academic progress
                and grades.
              </li>
              <li>
                <span className="font-medium">Academic Checklists:</span> Lists
                of your academic checklists.
              </li>
              <li>
                <span className="font-medium">News:</span> Latest news and
                updates.
              </li>
              <li>
                <span className="font-medium">Enrolled Subjects:</span> Not yet
                available.
              </li>
              <li>
                <span className="font-medium">Pre-Registration:</span> Not yet
                available.
              </li>
              <li>
                <span className="font-medium">Profile:</span> Your personal
                information.
              </li>
              <li>
                <span className="font-medium">Download Grades in PDF:</span>{" "}
                Download your grades based on academic year.
              </li>
            </ul>
          </div>
          <div
            className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openImagePreview("Dashboard")}
          >
            <Image src="/dash.png" alt="Dashboard" width={500} height={500} />
          </div>
        </div>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[100px]">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="gap-2 bg-blue-700 hover:bg-blue-600">
            <GraduationCap className="h-5 w-5" />
            Open Student Portal Guide
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {(() => {
                const IconComponent = steps[currentStep].icon;
                return IconComponent ? (
                  <IconComponent className="h-5 w-5 text-primary" />
                ) : null;
              })()}
              <DialogTitle>{steps[currentStep].title}</DialogTitle>
            </div>
            <DialogDescription>
              {steps[currentStep].description}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">{steps[currentStep].content}</div>

          <div className="flex justify-center my-4">
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    currentStep === index ? "w-8 bg-blue-700" : "w-2 bg-muted"
                  }`}
                  onClick={() => setCurrentStep(index)}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between gap-2">
            <Button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="gap-2 bg-blue-700 hover:bg-blue-900"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={nextStep}
                className="gap-2 bg-blue-700 hover:bg-blue-900"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="bg-blue-700 hover:bg-blue-900"
                onClick={() => setOpen(false)}
              >
                Finish Guide
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="sm:max-w-[1800px] max-h-full">
          <DialogHeader>
            <DialogTitle>{previewImage} Preview</DialogTitle>
          </DialogHeader>
          <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center">
            <div className="text-center p-8">
              <p className="text-xl font-medium text-slate-700 dark:text-slate-300">
                <Image
                  src="/dash.png"
                  alt="Dashboard"
                  width={2000}
                  height={2000}
                />
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This is where the full-size {previewImage.toLowerCase()} preview
                image would appear.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setImagePreviewOpen(false)}
              className="bg-blue-700 hover:bg-blue-900"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
