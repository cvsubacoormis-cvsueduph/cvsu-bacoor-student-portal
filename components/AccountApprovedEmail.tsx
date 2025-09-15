import * as React from "react";

interface EmailTemplateProps {
  studentName: string;
  studentNumber: string;
  loginUrl: string;
  universityName: string;
}

export function AccountApprovedEmail({
  studentName,
  studentNumber,
  loginUrl,
  universityName,
}: EmailTemplateProps) {
  return (
    <div>
      <h1>Account Approved</h1>
      <p>
        Hello {studentName}, your account has been approved by the University.
        You can now log in to your account at <a href={loginUrl}>{loginUrl}</a>.
      </p>
      <p>
        Your student number is <strong>{studentNumber}</strong>.
      </p>
      <p>
        <strong>{universityName}</strong>
      </p>
      <p>Thank you for using our service.</p>
    </div>
  );
}
