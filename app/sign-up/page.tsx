import StudentSignup from "@/components/StudentSignup";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 shadow-lg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Student Registration
            </h1>
            <p className="text-muted-foreground text-sm">
              Complete your registration to access the student portal
            </p>
          </div>
          <StudentSignup />
        </div>
      </div>
    </div>
  );
}
