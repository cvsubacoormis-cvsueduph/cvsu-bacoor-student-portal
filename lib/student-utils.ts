
import { Major, Status, UserSex } from "@prisma/client";

export function humanizeSex(s: UserSex) {
  return s === "MALE" ? "Male" : "Female";
}

export function humanizeMajor(m?: Major | null) {
  switch (m) {
    case "HUMAN_RESOURCE_MANAGEMENT":
      return "Human Resource Management";
    case "MARKETING_MANAGEMENT":
      return "Marketing Management";
    case "ENGLISH":
      return "English";
    case "MATHEMATICS":
      return "Mathematics";
    case "NONE":
    default:
      return "None";
  }
}

export function humanizeStatus(s: Status) {
  switch (s) {
    case "REGULAR":
      return "Regular";
    case "IRREGULAR":
      return "Irregular";
    case "NOT_ANNOUNCED":
      return "Not announced";
    case "TRANSFEREE":
      return "Transferee";
    case "RETURNEE":
      return "Returnee";
    default:
      return s;
  }
}
