import { useEffect, useMemo, useState } from 'react';
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
      paddingLeft: '16px',
      paddingRight: '16px',
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

export default function AppDataTable({ columns, data, progressPending = false, onRowClicked = undefined, searchPlaceholder = 'Search table...' }) {
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = (event) => setIsMobile(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) => Object.values(row || {}).map((value) => {
      if (value === null || value === undefined) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }).join(' ').toLowerCase().includes(term));
  }, [data, search]);

  const visibleColumns = useMemo(() => {
    if (!isMobile) return columns;
    const actionColumn = columns.find((column) => String(column.name).toLowerCase() === 'actions');
    const essentials = columns.filter((column) => String(column.name).toLowerCase() !== 'actions').slice(0, 2);
    return actionColumn ? [...essentials, actionColumn] : essentials;
  }, [columns, isMobile]);

  function MobileRowDetails({ data: row }) {
    return <div className="p-3 border-top bg-body-tertiary">
      {columns.filter((column) => !visibleColumns.includes(column) && String(column.name).toLowerCase() !== 'actions').map((column) => {
        let value = '-';
        if (typeof column.selector === 'function') value = column.selector(row);
        if (value === null || value === undefined || value === '') value = '-';
        if (typeof value === 'object') value = JSON.stringify(value);
        return <div className="d-flex justify-content-between gap-3 py-2 border-bottom" key={String(column.name)}><strong>{column.name}</strong><span className="text-end">{String(value)}</span></div>;
      })}
    </div>;
  }

  return (
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
      pointerOnHover
      striped
      dense
      responsive
      persistTableHead
      noDataComponent={search ? 'No matching records found.' : 'No records available.'}
      expandableRows={isMobile}
      expandableRowsComponent={MobileRowDetails}
      expandableIcon={{ collapsed: <span aria-label="Show row details">⌄</span>, expanded: <span aria-label="Hide row details">⌃</span> }}
      expandOnRowClicked={isMobile}
    />
  );
}
