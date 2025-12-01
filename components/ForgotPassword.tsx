"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useSignIn } from "@clerk/nextjs";
import {
  Mail,
  ArrowRight,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetStep = "email" | "code" | "success";

export default function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState<ResetStep>("email");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [secondFactor, setSecondFactor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResendLoading, setIsResendLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    if (isSignedIn) {
      setOpen(false);
      router.push("/");
    }
  }, [isSignedIn, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0 && isResendDisabled) {
      setIsResendDisabled(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, isResendDisabled]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const startResendCountdown = () => {
    setCountdown(300); // 5 minutes
    setIsResendDisabled(true);
  };

  // Send the password reset code to the user's email
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!isLoaded || !signIn) {
      setError("Authentication system is not available");
      setIsLoading(false);
      return;
    }

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      setCurrentStep("code");
      startResendCountdown();
      setError("");
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || "Failed to send reset code");
    } finally {
      setIsLoading(false);
    }
  }

  // Reset the user's password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsResetLoading(true);

    if (!isLoaded || !signIn) {
      setError("Authentication system is not available");
      setIsResetLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsResetLoading(false);
      return;
    }

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "needs_second_factor") {
        setSecondFactor(true);
        setError("");
      } else if (result.status === "complete") {
        if (result.createdSessionId) {
          setActive({ session: result.createdSessionId });
        }
        setCurrentStep("success");
        setError("");
      }
    } catch (err: any) {
      console.log("error", err.errors?.[0]?.longMessage || "An error occurred");
      setError(err.errors?.[0]?.longMessage || "Failed to reset password");
    } finally {
      setIsResetLoading(false);
    }
  }

  // Resend the verification code
  async function handleResendCode() {
    if (isResendDisabled || !isLoaded || !signIn) return;

    setError("");
    setIsResendLoading(true);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      startResendCountdown();
      setError("");
    } catch (err: any) {
      console.log("error", err.errors?.[0]?.longMessage || "An error occurred");
      setError(err.errors?.[0]?.longMessage || "Failed to resend code");
    } finally {
      setIsResendLoading(false);
    }
  }

  const handleClose = () => {
    setOpen(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setCode("");
      setCurrentStep("email");
      setError("");
      setCountdown(0);
      setIsResendDisabled(false);
      setSecondFactor(false);
      setIsLoading(false);
      setIsResendLoading(false);
      setIsResetLoading(false);
    }, 300);
  };

  const renderStepIndicator = () => {
    const steps = ["email", "code", "success"];
    const currentIndex = steps.indexOf(currentStep);

    return (
      <div className="flex justify-center mb-6">
        <div className="flex items-center space-x-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`h-2 w-2 rounded-full ${index <= currentIndex ? "bg-blue-700" : "bg-muted"
                  }`}
              />
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 ${index < currentIndex ? "bg-blue-700" : "bg-muted"
                    }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="px-0 hover:text-blue-600">
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {currentStep === "email" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-blue-700">
                Reset your password
              </DialogTitle>
              <DialogDescription>
                Enter your email address and we&apos;ll send you a code to reset
                your password.
              </DialogDescription>
            </DialogHeader>
            {renderStepIndicator()}
            <form onSubmit={handleEmailSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-blue-700">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-10 border-blue-700 rounded-md text-sm focus:border-blue-900 focus:outline-none focus:ring-0 focus:border-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  onClick={handleClose}
                  className="mt-2 sm:mt-0 bg-blue-700 hover:bg-blue-600 text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!email || isLoading}
                  className="bg-blue-700 hover:bg-blue-600 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Code
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {currentStep === "code" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-blue-700">
                Reset your password
              </DialogTitle>
              <DialogDescription>
                Enter the code sent to {email} and your new password.
              </DialogDescription>
            </DialogHeader>
            {renderStepIndicator()}
            <form onSubmit={handleResetPassword} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-blue-700">
                  Verification code
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground text-blue-700" />
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    className="pl-10 border-blue-700 rounded-md text-sm focus:border-blue-900 focus:outline-none focus:ring-0 focus:border-2"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                    required
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Didn&apos;t receive a code?</span>
                  {isResendDisabled ? (
                    <span>Resend in {formatTime(countdown)}</span>
                  ) : (
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={handleResendCode}
                      disabled={isResendLoading}
                    >
                      {isResendLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend code"
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10 border-blue-700 rounded-md text-sm focus:border-blue-900 focus:outline-none focus:ring-0 focus:border-2"
                    placeholder="•••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 border-blue-700 rounded-md text-sm focus:border-blue-900 focus:outline-none focus:ring-0 focus:border-2"
                    placeholder="•••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              {secondFactor && (
                <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                  <p>
                    Two-factor authentication is required, but this UI does not
                    handle that yet.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  onClick={() => setCurrentStep("email")}
                  className="mt-2 sm:mt-0 bg-blue-700 hover:bg-blue-600 text-white"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !code || !password || !confirmPassword || isResetLoading
                  }
                  className="bg-blue-700 hover:bg-blue-600 text-white"
                >
                  {isResetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {currentStep === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-blue-700">
                Password reset successful
              </DialogTitle>
              <DialogDescription>
                Your password has been reset successfully.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <CheckCircle className="h-6 w-6 text-blue-700" />
              </div>
              <p className="mb-2 font-medium">Your password has been updated</p>
              <p className="text-sm text-muted-foreground">
                You can now log in with your new password.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={handleClose}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white"
              >
                Return to Dashboard
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
