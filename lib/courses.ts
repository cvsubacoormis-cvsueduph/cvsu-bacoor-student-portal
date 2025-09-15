export function courseMap(courseAbbreviation: string) {
  switch (courseAbbreviation) {
    case "BSBA":
      return "Bachelor of Science in Business Administration";
      break;
    case "BSCS":
      return "Bachelor of Science in Computer Science";
      break;
    case "BSHM":
      return "Bachelor of Science in Hospitality Management";
      break;
    case "BSIT":
      return "Bachelor of Science in Information Technology";
      break;
    case "BSP":
      return "Bachelor of Science in Psychology";
      break;
    case "BSCRIM":
      return "Bachelor of Science in Criminology";
      break;
    case "BSED":
      return "Bachelor of Secondary Education";
      break;
    default:
      return "";
      break;
  }
}

export function courseClerkshipMap(courseClerksAbbreviation: string) {
  switch (courseClerksAbbreviation) {
    case "BSBA":
      return "BON-ART C. BAGAINDOC";
      break;
    case "BSCS":
      return "MICHAEL D. ANSUAS";
      break;
    case "BSHM":
      return "JOHN CARLO J. BENJAMIN";
      break;
    case "BSIT":
      return "TENEE D. DADAP";
      break;
    case "BSP":
      return "MILDRED Q. VALDEPEÑA";
      break;
    case "BSCRIM":
      return " JIMWELL G. DACANAY";
      break;
    case "BSED":
      return "MICHAEL D. ANSUAS";
      break;
    default:
      return "";
      break;
  }
}

export function coursePositionMap(coursePositionAbbreviation: string) {
  switch (coursePositionAbbreviation) {
    case "BSBA":
      return "Registrar Clerk";
      break;
    case "BSCS":
      return "Registrar Clerk";
      break;
    case "BSHM":
      return "Registrar Clerk";
      break;
    case "BSIT":
      return "Registrar Clerk";
      break;
    case "BSP":
      return "Registrar Clerk";
      break;
    case "BSCRIM":
      return "Campus Registrar";
      break;
    case "BSED":
      return "Registrar Clerk";
      break;
    default:
      return "";
      break;
  }
}

export function formatMajor(major: string) {
  //HUMAN_RESOURCE_MANAGEMENT
  return major
    .replace(/_/g, " ")
    .replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}
