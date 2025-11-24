
export function getBetterGrade(grade?: string, reExam?: string) {
  const parsedGrade = parseFloat(grade ?? "");
  const parsedReExam = parseFloat(reExam ?? "");

  const isGradeValid = !isNaN(parsedGrade);
  const isReExamValid = !isNaN(parsedReExam);

  if (isGradeValid && isReExamValid) {
    return parsedGrade < parsedReExam ? grade : reExam;
  }

  if (!isGradeValid && isReExamValid) {
    return reExam;
  }

  if (isGradeValid && !isReExamValid) {
    return grade;
  }

  return grade || reExam || "-";
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case "Completed":
    case "Passed":
    case "Satisfactory":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
    case "Enrolled":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100";
    case "Failed":
    case "Unsatisfactory":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
    case "Dropped":
    case "Incomplete":
    case "Lack of Req.":
    case "Con. Failure":
      return "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";
    default: // "Not Taken"
      return "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100";
  }
};

export const getGradeColor = (grade?: string) => {
  if (!grade) return "text-gray-400";
  const numGrade = Number.parseFloat(grade);
  if (isNaN(numGrade)) return "text-gray-600";
  if (numGrade <= 3.0) return "text-green-600";
  if (numGrade <= 4.0 || 5.0) return "text-red-600";
  return "text-red-600";
};
