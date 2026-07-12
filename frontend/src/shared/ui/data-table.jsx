import { cn } from "@/shared/lib/cn";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/shared/ui/icon";
export function DataTable({ rows, columns, getRowKey, className, tableClassName, rowClassName, onRowClick, isLoading = false, loadingMessage = "Đang tải dữ liệu...", emptyMessage = "Không có dữ liệu phù hợp.", footer, minWidth, pagination, }) {
    const fallbackColumnWidth = columns.length > 0 ? `${100 / columns.length}%` : undefined;
    const [page, setPage] = useState(1);
    const paginationEnabled = Boolean(pagination);
    const pageSize = Math.max(1, pagination?.pageSize ?? 8);
    const pageCount = paginationEnabled ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
    const currentPage = paginationEnabled ? Math.min(Math.max(page, 1), pageCount) : 1;
    const displayRows = useMemo(() => {
        if (!paginationEnabled)
            return rows;
        const startIndex = (currentPage - 1) * pageSize;
        return rows.slice(startIndex, startIndex + pageSize);
    }, [currentPage, pageSize, paginationEnabled, rows]);
    const firstItemNumber = rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const lastItemNumber = Math.min(currentPage * pageSize, rows.length);
    useEffect(() => {
        if (!paginationEnabled)
            return;
        setPage(1);
    }, [pageSize, paginationEnabled, rows.length]);
    function goToPage(nextPage) {
        setPage(Math.min(Math.max(nextPage, 1), pageCount));
    }
    const paginationFooter = paginationEnabled && rows.length > 0 ? (<div className="flex flex-col gap-3 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
                <span>
                    Hiển thị {firstItemNumber}-{lastItemNumber} / {rows.length} {pagination?.itemLabel ?? "bản ghi"}
                </span>
                <div className="flex items-center gap-2">
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-high text-on-surface-variant transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang đầu" title="Trang đầu" disabled={currentPage <= 1} onClick={() => goToPage(1)}>
                        <Icon name="keyboard_double_arrow_left" className="text-lg"/>
                    </button>
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-high text-on-surface-variant transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang trước" title="Trang trước" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
                        <Icon name="chevron_left" className="text-lg"/>
                    </button>
                    <span className="min-w-24 text-center font-medium text-on-surface">
                        Trang {currentPage} / {pageCount}
                    </span>
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-high text-on-surface-variant transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang sau" title="Trang sau" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>
                        <Icon name="chevron_right" className="text-lg"/>
                    </button>
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-high text-on-surface-variant transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang cuối" title="Trang cuối" disabled={currentPage >= pageCount} onClick={() => goToPage(pageCount)}>
                        <Icon name="keyboard_double_arrow_right" className="text-lg"/>
                    </button>
                </div>
            </div>) : null;
    return (<div className={cn("overflow-hidden rounded-[1.25rem] border border-outline-variant/10 bg-surface", className)}>
            <div className="overflow-x-auto">
                <table className={cn("w-full min-w-full table-fixed text-left", tableClassName)} style={{ minWidth }}>
                    <colgroup>
                        {columns.map((column) => (<col key={column.key} style={{ width: column.width ?? fallbackColumnWidth }}/>))}
                    </colgroup>
                    <thead className="bg-surface-container-low/90">
                        <tr>
                            {columns.map((column) => (<th key={column.key} className={cn("px-5 py-3 text-[11px] font-label uppercase tracking-widest text-on-surface-variant/70", column.align === "center" && "text-center", column.align === "right" && "text-right", column.nowrap && "whitespace-nowrap", !column.nowrap && "break-words", column.className, column.headerClassName)}>
                                    {column.title}
                                </th>))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (<tr>
                                <td className="px-5 py-8 text-center text-sm text-on-surface-variant" colSpan={columns.length}>
                                    {loadingMessage}
                                </td>
                            </tr>) : null}
                        {!isLoading && rows.length === 0 ? (<tr>
                                <td className="px-5 py-8 text-center text-sm text-on-surface-variant" colSpan={columns.length}>
                                    {emptyMessage}
                                </td>
                            </tr>) : null}
                        {!isLoading &&
            displayRows.map((row, index) => (<tr key={getRowKey(row)} onClick={() => onRowClick?.(row)} className={cn(index % 2 === 0 ? "bg-surface" : "bg-surface-container-low/35", "border-t border-outline-variant/10 transition hover:bg-surface-container-lowest", onRowClick && "cursor-pointer", rowClassName?.(row))}>
                                    {columns.map((column) => (<td key={column.key} className={cn("px-5 py-4 align-top text-sm leading-6 text-on-surface", column.align === "center" && "text-center", column.align === "right" && "text-right", column.nowrap && "whitespace-nowrap", !column.nowrap && "break-words", column.className, column.cellClassName)}>
                                            {column.render(row)}
                                        </td>))}
                                </tr>))}
                    </tbody>
                </table>
            </div>
            {footer || paginationFooter ? (<div className="space-y-3 border-t border-outline-variant/10 bg-surface-container-low px-5 py-4">
                    {footer}
                    {paginationFooter}
                </div>) : null}
        </div>);
}
