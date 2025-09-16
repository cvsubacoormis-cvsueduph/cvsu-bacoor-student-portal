"use client";
import CreateUserSkeleton from "@/components/skeleton/CreateUserSkeleton";
import React from "react";
import { HashLoader } from "react-spinners";

export default function loading() {
  return <CreateUserSkeleton />;
}
