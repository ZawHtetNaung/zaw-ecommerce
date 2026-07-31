import { isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import DataTable from 'react-data-table-component';

const paginationComponentOptions = {
  rowsPerPageText: 'Rows',
  rangeSeparatorText: 'of',
};

const adminTableStyles = {
  table: {
    style: {
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-surface, #ffffff)',
    },
  },
  tableWrapper: {
    style: {
      backgroundColor: 'var(--admin-surface, #ffffff)',
    },
  },
  responsiveWrapper: {
    style: {
      overflowX: 'hidden',
      backgroundColor: 'var(--admin-surface, #ffffff)',
    },
  },
  subHeader: {
    style: {
      minHeight: '68px',
      padding: '8px 0 14px',
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-surface, #ffffff)',
    },
  },
  headRow: {
    style: {
      minHeight: '54px',
      color: 'var(--admin-muted, #6b7280)',
      backgroundColor: 'var(--admin-surface-soft, #f7f7f8)',
      borderTop: '1px solid var(--admin-border, #e5e7eb)',
      borderBottom: '1px solid var(--admin-border, #e5e7eb)',
    },
  },
  headCells: {
    style: {
      paddingLeft: '16px',
      paddingRight: '16px',
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  rows: {
    style: {
      minHeight: '62px',
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-surface, #ffffff)',
      borderBottomColor: 'var(--admin-border, #e5e7eb)',
    },
    stripedStyle: {
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-surface-soft, #f7f7f8)',
    },
    highlightOnHoverStyle: {
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-hover, #f2f3f5)',
      outline: 'none',
    },
  },
  cells: {
    style: {
      minWidth: 0,
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
  expanderCell: {
    style: {
      flex: '0 0 46px',
    },
  },
  pagination: {
    style: {
      minHeight: '64px',
      color: 'var(--admin-muted, #6b7280)',
      backgroundColor: 'var(--admin-surface, #ffffff)',
      borderTop: '1px solid var(--admin-border, #e5e7eb)',
    },
    pageButtonsStyle: {
      color: 'var(--admin-text, #171717)',
      fill: 'var(--admin-text, #171717)',
      borderRadius: '10px',
    },
  },
  progress: {
    style: {
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-surface, #ffffff)',
    },
  },
  noData: {
    style: {
      minHeight: '140px',
      color: 'var(--admin-muted, #6b7280)',
      backgroundColor: 'var(--admin-surface, #ffffff)',
    },
  },
  expanderRow: {
    style: {
      color: 'var(--admin-text, #171717)',
      backgroundColor: 'var(--admin-surface-soft, #f7f7f8)',
    },
  },
};

function visibleDataColumnLimit(width) {
  if (width < 560) return 2;
  if (width < 800) return 3;
  if (width < 1050) return 4;
  return 6;
}

export default function AppDataTable({ columns, data, progressPending = false, onRowClicked = undefined, searchPlaceholder = 'Search table...' }) {
  const [search, setSearch] = useState('');
  const [tableWidth, setTableWidth] = useState(() => window.innerWidth);
  const tableShellRef = useRef(null);

  useEffect(() => {
    const shell = tableShellRef.current;
    if (!shell) return undefined;

    const updateWidth = () => setTableWidth(Math.round(shell.getBoundingClientRect().width));
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) => Object.values(row || {}).map((value) => {
      if (value === null || value === undefined) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }).join(' ').toLowerCase().includes(term));
  }, [data, search]);

  const { visibleColumns, hiddenColumns } = useMemo(() => {
    const actionColumn = columns.find((column) => String(column.name).toLowerCase() === 'actions');
    const dataColumns = columns.filter((column) => String(column.name).toLowerCase() !== 'actions');
    const visibleLimit = visibleDataColumnLimit(tableWidth);
    const essentials = dataColumns.slice(0, visibleLimit);

    return {
      visibleColumns: actionColumn ? [...essentials, actionColumn] : essentials,
      hiddenColumns: dataColumns.slice(visibleLimit),
    };
  }, [columns, tableWidth]);

  function ExpandedRowDetails({ data: row }) {
    return (
      <div className="admin-expanded-fields border-top bg-body-tertiary">
        {hiddenColumns.map((column, index) => {
          let value = '-';
          if (typeof column.cell === 'function') value = column.cell(row);
          else if (typeof column.format === 'function') value = column.format(row);
          else if (typeof column.selector === 'function') value = column.selector(row);
          if (value === null || value === undefined || value === '') value = '-';
          if (typeof value === 'object' && !isValidElement(value)) value = JSON.stringify(value);

          return (
            <div className="admin-expanded-field" key={`${String(column.name)}-${index}`}>
              <strong>{column.name}</strong>
              <span>{value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="app-data-table-shell" ref={tableShellRef}>
      <DataTable
        className="admin-data-table"
        columns={visibleColumns}
        data={filteredData}
        customStyles={adminTableStyles}
        progressPending={progressPending}
        onRowClicked={onRowClicked}
        pagination
        paginationPerPage={10}
        paginationRowsPerPageOptions={[10, 25, 50, 100]}
        paginationComponentOptions={paginationComponentOptions}
        subHeader
        subHeaderComponent={<div className="d-flex gap-2 align-items-center w-100 justify-content-end py-2"><input type="search" className="form-control form-control-sm" style={{ maxWidth: 320 }} placeholder={searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search table" />{search && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSearch('')}>Clear</button>}</div>}
        highlightOnHover
        pointerOnHover={Boolean(onRowClicked)}
        striped
        dense
        responsive
        persistTableHead
        noDataComponent={search ? 'No matching records found.' : 'No records available.'}
        expandableRows={hiddenColumns.length > 0}
        expandableRowsComponent={ExpandedRowDetails}
        expandableIcon={{
          collapsed: <span className="admin-row-expand-icon" aria-label="Show more columns">+</span>,
          expanded: <span className="admin-row-expand-icon" aria-label="Hide extra columns">−</span>,
        }}
        expandOnRowClicked={false}
      />
    </div>
  );
}
