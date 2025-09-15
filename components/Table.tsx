// import { Grade } from "@/app/(dashboard)/list/[grades]/page";
import {Prisma} from "@prisma/client";
import React from "react";

type Grade = Prisma.GradeGetPayload<{}>;

const Table = ({
  columns,
  renderRow,
  data,
}: {
  columns: { header: string; accessor: string; className?: string }[];
  renderRow: (item: Grade) => React.ReactNode;
  data: Grade[];
}) => {
  return (
    <table className="w-full mt-4">
      <thead>
        <tr className="text-left text-gray-500 text-sm">
          {columns.map((col) => (
            <th
              key={col.accessor}
              style={{ width: `${100 / columns.length}%` }}
              className={col.className}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <React.Fragment key={item.studentNumber}>
            {renderRow(item)}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

export default Table;