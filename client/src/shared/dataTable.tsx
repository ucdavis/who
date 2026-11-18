'use no memo';

import { type ReactNode, useId, useRef } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  InitialTableState,
  type Table,
  useReactTable,
} from '@tanstack/react-table';

type TableActionsRenderer<TData extends object> =
  | ReactNode
  | ((table: Table<TData>) => ReactNode);

interface DataTableProps<TData extends object> {
  columns: ColumnDef<TData>[];
  data: TData[];
  filterPlaceholder?: string;
  getRowLabel?: (row: TData) => string;
  globalFilter?: 'left' | 'right' | 'none'; // Controls the position of the search box
  initialState?: InitialTableState; // Optional initial state for the table, use for stuff like setting page size or sorting
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  tableActions?: TableActionsRenderer<TData>;
}

export const DataTable = <TData extends object>({
  columns,
  data,
  filterPlaceholder = 'Search all columns...',
  getRowLabel,
  globalFilter = 'right',
  initialState,
  onRowClick,
  rowClassName,
  tableActions,
}: DataTableProps<TData>) => {
  const filterId = useId();
  const filterInput = useRef<HTMLInputElement>(null);
  // see note in https://tanstack.com/table/latest/docs/installation#react-table.  Added "use no memo" just to be safe but it's unnecessary.
  // once tanstack updates their docs and makes sure it works w/ react compiler (even though we aren't using it yet), we can remove this comment
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(), // basic rendering
    getFilteredRowModel: getFilteredRowModel(), // enable filtering feature
    getPaginationRowModel: getPaginationRowModel(), // enable pagination calculations
    getSortedRowModel: getSortedRowModel(), // enable sorting feature
    initialState: {
      ...initialState,
    },
  });

  const filterControl =
    globalFilter === 'none' ? null : (
      <div className="grid w-full max-w-sm gap-1">
        <label className="text-sm font-medium" htmlFor={filterId}>
          Filter results
        </label>
        <div className="input input-bordered flex w-full items-center gap-2">
          <input
            className="min-w-0 grow"
            id={filterId}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder={filterPlaceholder}
            ref={filterInput}
            type="text"
            value={table.getState().globalFilter ?? ''}
          />
          {table.getState().globalFilter && (
            <button
              aria-label="Clear results filter"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => {
                table.setGlobalFilter('');
                filterInput.current?.focus();
              }}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );

  const resolvedTableActions =
    typeof tableActions === 'function' ? tableActions(table) : tableActions;

  const totalRowCount = data.length;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const currentPageRowCount = table.getRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const firstVisibleRow = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastVisibleRow = Math.min(
    pageIndex * pageSize + currentPageRowCount,
    filteredRowCount
  );
  const isFiltered = filteredRowCount !== totalRowCount;
  const pageSizeOptions = Array.from(new Set([pageSize, 10, 25, 50, 100])).sort(
    (a, b) => a - b
  );
  const toolbarItems =
    globalFilter === 'left'
      ? [filterControl, resolvedTableActions]
      : [resolvedTableActions, filterControl];
  const hasToolbar = toolbarItems.some(Boolean);

  return (
    <div className="space-y-4">
      {hasToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {toolbarItems.map((item, index) =>
            item ? <div key={index}>{item}</div> : null
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        {' '}
        {/* enables horizontal scroll on small screens */}
        <table className="table table-zebra w-full">
          <thead className="text-base-content">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {onRowClick && headerGroup.depth === 0 && (
                  <th rowSpan={table.getHeaderGroups().length} scope="col">
                    Details
                  </th>
                )}
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      );

                  return (
                    <th
                      aria-sort={
                        sortDirection === 'asc'
                          ? 'ascending'
                          : sortDirection === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      colSpan={header.colSpan}
                      key={header.id}
                      scope={header.subHeaders.length ? 'colgroup' : 'col'}
                    >
                      {label && header.column.getCanSort() ? (
                        <button
                          className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-sm text-start hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          <span className="sr-only">Sort by</span> {label}
                          <svg
                            aria-hidden="true"
                            className="size-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.75"
                            viewBox="0 0 20 20"
                          >
                            {sortDirection !== 'desc' && (
                              <path d="m6 8 4-4 4 4" />
                            )}
                            {sortDirection !== 'asc' && (
                              <path d="m6 12 4 4 4-4" />
                            )}
                          </svg>
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const resolvedRowClassName = [
                onRowClick ? 'cursor-pointer' : undefined,
                rowClassName?.(row.original),
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr
                  className={resolvedRowClassName || undefined}
                  key={row.id}
                  onClick={(event) => {
                    if (!onRowClick) {
                      return;
                    }

                    const target = event.target as HTMLElement;
                    if (target.closest('a, button, input, select, textarea')) {
                      return;
                    }

                    event.currentTarget
                      .querySelector<HTMLButtonElement>('[data-row-details]')
                      ?.click();
                  }}
                >
                  {onRowClick && (
                    <td>
                      <button
                        aria-label={`Details for ${getRowLabel?.(row.original) || `row ${row.index + 1}`}`}
                        className="btn btn-outline btn-primary btn-sm"
                        data-row-details=""
                        onClick={(event) => {
                          event.currentTarget.focus({ preventScroll: true });
                          onRowClick(row.original);
                        }}
                        type="button"
                      >
                        Details
                      </button>
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-col gap-3 border-t border-base-300 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div
            aria-atomic="true"
            className="space-y-1 text-base-content/80"
            role="status"
          >
            <div>
              Showing {firstVisibleRow}-{lastVisibleRow} of {filteredRowCount}{' '}
              {isFiltered
                ? `filtered rows from ${totalRowCount} total`
                : 'rows'}
            </div>
            <div>
              Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="text-base-content/70">Rows</span>
              <select
                className="select select-bordered select-xs w-20"
                onChange={(event) =>
                  table.setPageSize(Number(event.target.value))
                }
                value={pageSize}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="join">
              <button
                aria-label="First page"
                className="btn btn-xs join-item"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.setPageIndex(0)}
                type="button"
              >
                First
              </button>
              <button
                aria-label="Previous page"
                className="btn btn-xs join-item"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                type="button"
              >
                Prev
              </button>
              <button
                aria-label="Next page"
                className="btn btn-xs join-item"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                type="button"
              >
                Next
              </button>
              <button
                aria-label="Last page"
                className="btn btn-xs join-item"
                disabled={!table.getCanNextPage()}
                onClick={() => table.setPageIndex(Math.max(pageCount - 1, 0))}
                type="button"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
