import {
  BMHRchecklistData,
  BMMMchecklistData,
  BSEDENGData,
  BSEDMATHchecklistData,
  CRIMchecklistData,
  CSchecklistData,
  HMchecklistData,
  ITchecklistData,
  PSYchecklistData,
} from "./data";

export const getCoursesByProgram = (program: string, major: string) => {
  switch (program) {
    case "BSIT":
      return ITchecklistData;
    case "BSCS":
      return CSchecklistData;
    case "BSBA":
      switch (major) {
        case "MARKETING_MANAGEMENT":
          return BMMMchecklistData;
        case "HUMAN_RESOURCE_MANAGEMENT":
          return BMHRchecklistData;
        default:
          return [];
      }
    case "BSCRIM":
      return CRIMchecklistData;
    case "BSHM":
      return HMchecklistData;
    case "BSP":
      return PSYchecklistData;
    case "BSED":
      switch (major) {
        case "ENGLISH":
          return BSEDENGData;
        case "MATHEMATICS":
          return BSEDMATHchecklistData;
      }
    default:
      return [];
  }
};

// Then modify your courseOptions to be dynamic based on the selected student
export const getCourseOptions = (program: string, major: string) => {
  const courses = getCoursesByProgram(program, major);
  return courses.map((course) => ({
    code: course.courseCode,
    title: course.courseTitle,
  }));
};
