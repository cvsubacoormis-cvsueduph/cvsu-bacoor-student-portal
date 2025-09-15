import React from "react";

export default function DataPrivacy() {
  return (
    <div className="p-4 text-justify">
      <h2 className="text-lg font-semibold mb-4 text-center">
        DATA PRIVACY AND CONSENT FORM FOR STUDENTS
      </h2>
      <p className="text-sm">
        <span className="font-semibold">Cavite State University (CvSU)</span> is
        required by law to process your personal information and sensitive
        personal information in order to safeguard academic freedom, uphold your
        right to quality education, and protect your right to data privacy in
        conformity with{" "}
        <span className="font-semibold">Republic Act No. 10173</span>, otherwise
        known as the{" "}
        <span className="font-semibold">Data Privacy Act of 2012</span>, and its
        implementing rules and regulations. The said law can be viewed via{" "}
        <a
          href="https://www.officialgazette.gov.ph/2012/08/15/republic-act-no-10173/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          this link
        </a>
        .
      </p>
      <h3 className="text-lg font-semibold mt-2 mb-2">
        Personal Information Collected and Stored
      </h3>
      <p className="text-sm mb-4">
        The University collects, uses and keeps your personal information, which
        include but are not limited, to the following:
      </p>
      <ul className="grid grid-cols-2 list-disc text-sm">
        <li className="ml-4">Name, age, date of birth;</li>
        <li className="ml-9">Address and contact details</li>
        <li className="ml-4">Educational records</li>
        <li className="ml-9">Learner reference number (if any)</li>
        <li className="ml-4">Photograph or image</li>
        <li className="ml-9">Signature</li>
        <li className="ml-4">
          Family data (names of parents, their citizenship, civil status, etc.);
        </li>
        <li className="ml-9">Medical history and records</li>
        <li className="ml-4">Choice of campus and degree programs</li>
        <li className="ml-9">
          Socio-economic and geographic information about your household
        </li>
      </ul>
      <p className="mt-2 text-sm">
        This information is collected directly from you, your parents, legal
        guardians, and/or other authorized representatives during your
        application for admission and in the course of your residency in the
        University. We use this information to verify your identity, determine
        your eligibility to enroll in CvSU, to document consent for the
        processing of personal data in the course of determining your
        eligibility to enroll in CvSU as well as for other education related
        purposes such as but not limited to:
      </p>
      <ul className="list-disc text-sm mt-2">
        <li className="ml-4">
          availment of scholarship grants and financial assistance whenever
          applicable.
        </li>
        <li className="ml-4">
          provision of psychological and emotional assessment as needed.
        </li>
        <li className="ml-4">
          availment of various student services within the university (i.e.
          guidance services, infirmary services, etc.).
        </li>
      </ul>
      <h3 className="text-lg font-semibold mt-2 mb-2">
        Sensitive Personal Information Collected and Stored
      </h3>
      <p className="text-sm mb-6">
        The University also processes sensitive personal information under the
        DPA. These include, but are not limited to: race, ethnicity, civil
        status, health information, government-issued ID and relevant financial
        information.
      </p>
      <p className="text-sm">
        Access to the data is restricted and given only to predetermined
        authorized personnel in relation to their specific function which
        requires them to access or process student or employee information.
      </p>
      <h3 className="text-lg font-semibold mt-4">Disclosure</h3>
      <p className="text-sm">
        To comply with its legal and regulatory duties, the University submits
        required information to relevant government agencies such as the
        Commission on Higher Education (CHED). As a rule, CvSU will only
        disclose your personal data to third parties with your consent. The
        University will disclose or share such information only when required or
        allowed by applicable laws.
      </p>
      <h3 className="text-lg font-semibold mt-4">Security</h3>
      <p className="text-sm mb-6">
        Your personal data is stored in physical repositories and secured
        databases managed by the University’s Registrar, ICT Office and/or their
        counterparts in the CvSU Campuses. The University has appropriate
        physical, technical and organizational security measures which ensure
        the confidentiality of your information. These measures will be reviewed
        over time and upgraded in line with technological developments and
        regulatory requirements.
      </p>
      <p className="text-sm mb-8">
        The University’s General Data Privacy Notice can be viewed in the
        official Cavite State University website which may be updated from time
        to time, the updates effective from the date of posting. If you have
        questions about the DPA, you may email the University’s Data Protection
        Officer at{" "}
        <span className="font-semibold underline">dpo@cvsu.edu.ph</span> You may
        personally check and update your data by contacting the University
        Registrar.
      </p>
      <p className="text-sm mb-2 italic">
        I have read the CvSU Privacy Notice and Consent Form, understood its
        contents and consent to the processing of my personal data. I understand
        that for the CvSU to carry out its functions as a state university
        pursuant to its charter, exercise its right to academic freedom under
        the 1987 Constitution, pursue its legitimate interests as allowed by the
        Data Privacy Act of 2012, and comply with legal obligations, lawful
        issuances or orders of other public authorities, as well as contractual
        obligations to me, CvSU must necessarily process my personal and
        sensitive personal information. I grant my consent to and recognize the
        authority of the CvSU to process my personal and sensitive personal
        information pursuant to the abovementioned privacy notice and applicable
        laws
      </p>
    </div>
  );
}
