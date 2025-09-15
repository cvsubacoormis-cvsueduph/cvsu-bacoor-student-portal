import * as React from "react";
import { Html, Head, Body, Container } from "@react-email/components";

interface EmailTemplateProps {
  studentName: string;
  studentNumber: string;
  loginUrl: string;
  universityName: string;
}

export default function AccountRejectedEmail(props: EmailTemplateProps) {
  const { studentName, studentNumber, loginUrl, universityName } = props;
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <div>
            <h1>Account Rejected</h1>
            <p>
              Hello {studentName}, your account has been rejected by the
              University. You can now log in to your account at{" "}
              <a href={loginUrl}>{loginUrl}</a>.
            </p>
            <p>
              Your student number is <strong>{studentNumber}</strong>.
            </p>
            <p>
              <strong>{universityName}</strong>
            </p>
            <p>Thank you for using our service.</p>
          </div>
        </Container>
      </Body>
    </Html>
  );
}
