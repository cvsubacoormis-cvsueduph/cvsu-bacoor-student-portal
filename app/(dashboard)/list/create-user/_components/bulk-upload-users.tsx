"use client";

import type React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { bulkCreateUsers, type BulkUserPayload } from "@/actions/user/bulk-user-action";
import { bulkUserSchema } from "@/schemas/user-schema";

export function BulkUploadUsers() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<BulkUserPayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload a valid Excel (.xlsx/.xls) or CSV file.");
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (file: File) => {
    setIsProcessingFile(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Validate and map rows
        const mappedData: BulkUserPayload[] = jsonData.map((row: any) => ({
          username: row.username?.toString() || "",
          firstName: row.firstName?.toString() || "",
          lastName: row.lastName?.toString() || "",
          middleInit: row.middleInit?.toString() || "",
          email: row.email?.toString() || undefined,
          phone: row.phone?.toString() || undefined,
          address: row.address?.toString() || "",
          sex: (row.sex?.toString().toUpperCase() === "FEMALE" ? "FEMALE" : "MALE") as "MALE" | "FEMALE",
          role: (row.role?.toString().toLowerCase() === "registrar" ? "registrar" : "faculty") as "faculty" | "registrar",
        }));

        // Validate row by row to filter out invalid items early
        const validRows: BulkUserPayload[] = [];
        const validationErrors: string[] = [];

        mappedData.forEach((row, i) => {
          // Check minimal requirement so empty rows are cleanly ignored before throwing schema errors
          if (!row.username && !row.firstName && !row.lastName) {
            return;
          }

          const parsed = bulkUserSchema.element.safeParse(row);
          if (parsed.success) {
            validRows.push(parsed.data as BulkUserPayload);
          } else {
            validationErrors.push(`Row ${i + 1} (${row.username || "Unknown"}): ${parsed.error.errors[0]?.message}`);
          }
        });

        setParsedData(validRows);

        if (validRows.length === 0) {
          toast.error("No valid data found. Ensure required columns are present and valid.");
        } else if (validationErrors.length > 0) {
          toast.error(`Parsed ${validRows.length} rows. Encountered ${validationErrors.length} validation issues. See console.`, { duration: 5000 });
          console.warn("Validation parsing issues:", validationErrors);
        } else {
          toast.success(`Successfully parsed ${validRows.length} rows.`);
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to parse the file. Please check its format.");
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read the file.");
      setIsProcessingFile(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleClear = () => {
    setFile(null);
    setParsedData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast.error("No valid data to upload.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await bulkCreateUsers(parsedData);

      if (result.success) {
        toast.success(`Successfully created ${result.data?.successful} users!`);
        if (result.data?.failed && result.data.failed > 0) {
          toast.error(`${result.data.failed} users failed to create. Check console for details.`);
          console.error("Upload errors:", result.data.errors);
        }
        handleClear();
      } else {
        toast.error("An error occurred during bulk upload.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">Bulk Upload Users</CardTitle>
        <CardDescription className="text-sm">
          Upload an Excel (.xlsx) or CSV file containing user details. columns:
          username, firstName, lastName, middleInit, email, phone, address, sex, role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center bg-gray-50 transition-colors hover:bg-gray-100 relative">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading || isProcessingFile}
          />
          <div className="text-center space-y-2 pointer-events-none">
            <div className="flex justify-center">
              {isProcessingFile ? (
                <Loader2 className="h-10 w-10 text-gray-500 animate-spin" />
              ) : (
                <Upload className="h-10 w-10 text-gray-400" />
              )}
            </div>
            {file ? (
              <div className="flex flex-col items-center space-y-1">
                <div className="flex items-center space-x-2 text-sm text-gray-700 font-medium">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {parsedData.length} records ready
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">
                  Click or drag and drop to upload
                </p>
                <p className="text-xs text-gray-500">
                  Excel (.xlsx) or CSV format up to 5MB
                </p>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {file && (
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              type="button"
              onClick={handleClear}
              disabled={isLoading || isProcessingFile}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <X className="mr-2 h-4 w-4" /> Cancel Selection
            </Button>

            <Button
              type="button"
              onClick={handleUpload}
              disabled={isLoading || parsedData.length === 0 || isProcessingFile}
              className="min-w-[140px] bg-blue-700 hover:bg-blue-900 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${parsedData.length} Users`
              )}
            </Button>
          </div>
        )}

        {/* Data Preview */}
        {parsedData.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              Data Preview
              <span className="ml-2 text-sm font-normal text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
                Showing top 5 rows
              </span>
            </h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Sex</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.username}</TableCell>
                      <TableCell>{`${row.firstName} ${row.lastName}`}</TableCell>
                      <TableCell className="capitalize">{row.role}</TableCell>
                      <TableCell>{row.email || "-"}</TableCell>
                      <TableCell>{row.sex}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedData.find(row => !row.address) && (
              <div className="flex items-start flex-row space-x-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm border border-amber-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>Some records have missing fields (like address or email). Only required fields (Username, First Name, Last Name) are strictly enforced by the backend validation. Make sure your file is formatted correctly to avoid DB constraints errors.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
