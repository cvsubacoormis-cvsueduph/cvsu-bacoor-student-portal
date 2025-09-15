import React from "react";

export default function RetakeHistory({
  courseCode,
  allAttempts,
}: {
  courseCode: string;
  allAttempts: any[];
}) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-2">Retake History for {courseCode}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Attempt</th>
            <th className="text-left py-2">AY/Semester</th>
            <th className="text-left py-2">Grade</th>
            <th className="text-left py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {allAttempts.map((attempt, idx) => (
            <tr key={idx} className="border-b">
              <td className="py-2">#{attempt.attemptNumber}</td>
              <td className="py-2">
                AY {attempt.academicYear.split("_").slice(1).join("-")} /
                {attempt.semester === "FIRST"
                  ? "1st"
                  : attempt.semester === "SECOND"
                  ? "2nd"
                  : "Midyear"}{" "}
                Sem
              </td>
              <td className="py-2">{attempt.grade || "-"}</td>
              <td className="py-2">
                {attempt.remarks?.includes("FAILED")
                  ? "Failed"
                  : attempt.remarks?.includes("PASSED")
                  ? "Passed"
                  : attempt.remarks || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
