import { fetchJson, HttpError } from '@/lib/api.ts';
import { type CsvColumn } from '@/lib/csv.ts';
import { DataTable } from '@/shared/dataTable.tsx';
import { ExportDataButton } from '@/shared/exportDataButton.tsx';
import {
  getPeopleDetailHref,
  PeopleDetailsPanel,
  type PeopleLookupResponse,
  type PeopleSearchResult,
  yesNo,
} from '@/shared/peopleLookupDetails.tsx';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export const Route = createFileRoute('/(authenticated)/')({
  component: PeopleLookup,
});

type PeopleLookupSearchType =
  | 'email'
  | 'employeeId'
  | 'iamId'
  | 'kerb'
  | 'lastName'
  | 'mothraId'
  | 'ppsaDeptCode'
  | 'ppsId'
  | 'studentId';

type AppInfo = {
  provider: 'Rosetta' | 'IAM';
};

interface PeopleLookupRequest {
  searchText: string;
  searchType: PeopleLookupSearchType;
}

interface PeopleLookupSearchOption {
  label: string;
  placeholder: string;
  sensitive?: boolean;
  shortcut: string;
  value: PeopleLookupSearchType;
}

const standardSearchOptions: PeopleLookupSearchOption[] = [
  {
    label: 'Email',
    placeholder:
      'Paste emails or Outlook text; emails are extracted automatically',
    shortcut: 'e',
    value: 'email',
  },
  {
    label: 'Kerberos ID',
    placeholder: 'Paste Kerberos IDs separated by spaces, commas, or lines',
    shortcut: 'k',
    value: 'kerb',
  },
  {
    label: 'IAM ID',
    placeholder: 'Paste IAM IDs',
    shortcut: 'i',
    value: 'iamId',
  },
  {
    label: 'Last Name',
    placeholder: 'Paste last names',
    shortcut: 'l',
    value: 'lastName',
  },
  {
    label: 'PPSA Department Code',
    placeholder: 'Paste PPSA department codes',
    shortcut: 'd',
    value: 'ppsaDeptCode',
  },
];

const sensitiveSearchOptions: PeopleLookupSearchOption[] = [
  {
    label: 'Employee ID',
    placeholder: 'Paste employee IDs',
    sensitive: true,
    shortcut: 'm',
    value: 'employeeId',
  },
  {
    label: 'Student ID',
    placeholder: 'Paste student IDs',
    sensitive: true,
    shortcut: 's',
    value: 'studentId',
  },
  {
    label: 'PPS ID',
    placeholder: 'Paste PPS IDs',
    sensitive: true,
    shortcut: 'p',
    value: 'ppsId',
  },
];

const rosettaSensitiveSearchOptions: PeopleLookupSearchOption[] = [
  {
    label: 'MOTHRA ID',
    placeholder: 'Paste MOTHRA IDs',
    sensitive: true,
    shortcut: 't',
    value: 'mothraId',
  },
];

const defaultSearchType: PeopleLookupSearchType = 'email';
const detectedLineLimit = 6;

const searchTypeLengthHints: Partial<Record<PeopleLookupSearchType, number[]>> =
  {
    employeeId: [8],
    iamId: [10],
    ppsId: [7],
    studentId: [9],
  };

const emailDetectionRegex = /\b[\w%+.-]+@[\d.a-z-]+\.[a-z]{2,}\b/i;
const tokenDetectionRegex = /[\w%+.-]+@[\d.a-z-]+\.[a-z]{2,}|[\da-z-]+/gi;

const standardCsvColumns: CsvColumn<PeopleSearchResult>[] = [
  { header: 'Search', key: 'searchValue' },
  { header: 'Found', key: 'found' },
  { header: 'Kerb Id', key: 'kerbId' },
  { header: 'IAM Id', key: 'iamId' },
  { header: 'Email', key: 'email' },
  { header: 'Display Name', key: 'displayName' },
  { header: 'Full Lived Name', key: 'fullLivedName' },
  { header: 'Pronouns', key: 'pronouns' },
  { header: 'First Name', key: 'firstName' },
  { header: 'Last Name', key: 'lastName' },
  { header: 'Employee', key: 'isEmployee' },
  { header: 'Student', key: 'isStudent' },
  { header: 'Faculty', key: 'isFaculty' },
  { header: 'Staff', key: 'isStaff' },
  { header: 'HS Employee', key: 'isHsEmployee' },
  { header: 'External', key: 'isExternal' },
  { header: 'Roles', key: 'expandedAffiliation' },
  { header: 'Dept(s)', key: 'departments' },
  { header: 'Title(s)', key: 'title' },
  { header: 'Work Phone', key: 'workPhone' },
  { header: 'Errors', key: 'errorMessage' },
];

const sensitiveCsvColumns: CsvColumn<PeopleSearchResult>[] = [
  { header: 'Mothra Id', key: 'mothraId' },
  { header: 'PPS Id', key: 'ppsId' },
  { header: 'Employee Id', key: 'employeeId' },
  { header: 'Student Id', key: 'studentId' },
  { header: 'Banner PIDM', key: 'bannerPidm' },
  { header: 'Other Emails', key: 'otherEmails' },
  { header: 'Reports To', key: 'reportsToIamId' },
  { header: 'Exception', key: 'exceptionMessage' },
];

function getDetailId(result: PeopleSearchResult) {
  return result.kerbId?.trim() ?? '';
}

export function detectSearchTypeFromText(
  text: string,
  availableOptions: PeopleLookupSearchOption[]
) {
  const availableSearchTypes = new Set(
    availableOptions.map((option) => option.value)
  );
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, detectedLineLimit);

  if (lines.length === 0) {
    return null;
  }

  const sampleText = lines.join('\n');

  if (
    emailDetectionRegex.test(sampleText) &&
    availableSearchTypes.has('email')
  ) {
    return 'email';
  }

  const labeledSearchType = detectLabeledSearchType(
    sampleText,
    availableSearchTypes
  );

  if (labeledSearchType) {
    return labeledSearchType;
  }

  const tokens = lines.flatMap((line) => line.match(tokenDetectionRegex) ?? []);

  if (tokens.length === 0) {
    return null;
  }

  const numericSearchType = detectNumericSearchType(
    tokens,
    availableSearchTypes
  );

  if (numericSearchType) {
    return numericSearchType;
  }

  if (looksLikeLastNames(tokens) && availableSearchTypes.has('lastName')) {
    return 'lastName';
  }

  if (looksLikeKerbIds(tokens) && availableSearchTypes.has('kerb')) {
    return 'kerb';
  }

  return null;
}

function detectLabeledSearchType(
  text: string,
  availableSearchTypes: Set<PeopleLookupSearchType>
) {
  if (/\biam\b/i.test(text) && availableSearchTypes.has('iamId')) {
    return 'iamId';
  }

  if (/\bmothra\b/i.test(text) && availableSearchTypes.has('mothraId')) {
    return 'mothraId';
  }

  if (
    /\b(emp|employee)\b/i.test(text) &&
    availableSearchTypes.has('employeeId')
  ) {
    return 'employeeId';
  }

  if (/\bstudent\b/i.test(text) && availableSearchTypes.has('studentId')) {
    return 'studentId';
  }

  if (/\bpps\b/i.test(text) && availableSearchTypes.has('ppsId')) {
    return 'ppsId';
  }

  return null;
}

function detectNumericSearchType(
  tokens: string[],
  availableSearchTypes: Set<PeopleLookupSearchType>
) {
  const numericTokens = tokens.filter((token) => /^\d+$/.test(token));

  if (numericTokens.length === 0 || numericTokens.length < tokens.length / 2) {
    return null;
  }

  const sampleLengths = numericTokens.map((token) => token.length);
  const candidates = Object.entries(searchTypeLengthHints)
    .filter(([searchType]) =>
      availableSearchTypes.has(searchType as PeopleLookupSearchType)
    )
    .map(([searchType, lengths]) => ({
      matches: sampleLengths.filter((length) => lengths.includes(length))
        .length,
      searchType: searchType as PeopleLookupSearchType,
    }))
    .filter((candidate) => candidate.matches > 0)
    .sort((left, right) => right.matches - left.matches);

  if (candidates.length === 0) {
    return null;
  }

  if (
    candidates.length > 1 &&
    candidates[0].matches === candidates[1].matches
  ) {
    return null;
  }

  return candidates[0].searchType;
}

function looksLikeLastNames(tokens: string[]) {
  return (
    tokens.every((token) => /^[a-z]['a-z-]{1,49}$/i.test(token)) &&
    tokens.some((token) => token.length > 10 || /^[A-Z]['a-z-]+$/.test(token))
  );
}

function looksLikeKerbIds(tokens: string[]) {
  return tokens.every((token) => /^[\da-z]{2,10}$/i.test(token));
}

function hasLookupIssue(result: PeopleSearchResult) {
  return (
    !result.found ||
    Boolean(result.errorMessage?.trim()) ||
    Boolean(result.exceptionMessage?.trim())
  );
}

function submitLookupFromKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
  if ((!event.ctrlKey && !event.metaKey) || event.key !== 'Enter') {
    return;
  }

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function OpenDetailPageLink({
  className = 'btn btn-primary',
  kerbId,
}: {
  className?: string;
  kerbId: string;
}) {
  return (
    <Link
      className={className}
      params={{ id: kerbId }}
      rel="noopener noreferrer"
      target="_blank"
      to="/detail/$id"
    >
      Open Detail Page
    </Link>
  );
}
export function PeopleLookup() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [selectedSearchType, setSelectedSearchType] =
    useState<PeopleLookupSearchType>(defaultSearchType);
  const [singleLookup, setSingleLookup] = useState('');
  const [selectedResult, setSelectedResult] =
    useState<PeopleSearchResult | null>(null);

  const optionsQuery = useQuery({
    queryFn: ({ signal }) =>
      fetchJson<PeopleLookupResponse>('/api/peoplelookup/options', {}, signal),
    queryKey: ['people-lookup', 'options'],
    staleTime: 5 * 60_000,
  });

  const { data: appInfo } = useQuery({
    queryFn: ({ signal }) => fetchJson<AppInfo>('/api/app-info', {}, signal),
    queryKey: ['app-info'],
    staleTime: Infinity,
  });

  const lookupMutation = useMutation({
    mutationFn: (value: PeopleLookupRequest) =>
      fetchJson<PeopleLookupResponse>('/api/peoplelookup/search', {
        body: JSON.stringify(value),
        method: 'POST',
      }),
  });

  const allowSensitiveInfo =
    lookupMutation.data?.allowSensitiveInfo ??
    optionsQuery.data?.allowSensitiveInfo ??
    false;
  const searchOptions = useMemo(() => {
    if (!allowSensitiveInfo) {
      return standardSearchOptions;
    }

    return appInfo?.provider === 'Rosetta'
      ? [
          ...standardSearchOptions,
          ...sensitiveSearchOptions,
          ...rosettaSensitiveSearchOptions,
        ]
      : [...standardSearchOptions, ...sensitiveSearchOptions];
  }, [allowSensitiveInfo, appInfo?.provider]);
  const activeSearchType = searchOptions.some(
    (option) => option.value === selectedSearchType
  )
    ? selectedSearchType
    : defaultSearchType;
  const selectedSearchOption =
    searchOptions.find((option) => option.value === activeSearchType) ??
    standardSearchOptions[0];
  const results = lookupMutation.data?.results ?? [];
  const hasResults = results.length > 0;
  const searchTextValue = searchText.trim();
  const singleLookupValue = singleLookup.trim();
  const hasLookupStateToClear =
    Boolean(searchTextValue) ||
    activeSearchType !== defaultSearchType ||
    Boolean(lookupMutation.data) ||
    Boolean(lookupMutation.error) ||
    Boolean(selectedResult);
  const csvColumns = allowSensitiveInfo
    ? [...standardCsvColumns, ...sensitiveCsvColumns]
    : standardCsvColumns;

  useEffect(() => {
    if (selectedResult) {
      return;
    }

    const selectSearchType = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || !event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const searchOption = searchOptions.find(
        (option) => option.shortcut === event.key.toLowerCase()
      );

      if (!searchOption) {
        return;
      }

      event.preventDefault();
      setSelectedSearchType(searchOption.value);
    };

    window.addEventListener('keydown', selectSearchType);
    return () => window.removeEventListener('keydown', selectSearchType);
  }, [searchOptions, selectedResult]);

  const columns = useMemo<ColumnDef<PeopleSearchResult>[]>(
    () => [
      {
        accessorKey: 'searchValue',
        header: 'Search',
      },
      {
        accessorKey: 'found',
        cell: ({ getValue }) => yesNo(getValue<boolean>()),
        header: 'Found',
      },
      {
        accessorKey: 'kerbId',
        header: 'Kerb Id',
      },
      {
        accessorKey: 'iamId',
        header: 'IAM Id',
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'displayName',
        header: 'Display Name',
      },
      {
        accessorKey: 'isStudent',
        cell: ({ getValue }) => yesNo(getValue<boolean>()),
        header: 'Student',
      },
      {
        accessorKey: 'isFaculty',
        cell: ({ getValue }) => yesNo(getValue<boolean>()),
        header: 'Faculty',
      },
      {
        accessorKey: 'isStaff',
        cell: ({ getValue }) => yesNo(getValue<boolean>()),
        header: 'Staff',
      },
      {
        accessorKey: 'departments',
        header: 'Dept(s)',
      },
      {
        accessorKey: 'title',
        header: 'Title(s)',
      },
      {
        accessorKey: 'errorMessage',
        header: 'Errors',
      },
    ],
    []
  );

  const openSingleLookup = () => {
    if (!singleLookupValue) {
      return;
    }

    void navigate({
      href: getPeopleDetailHref(singleLookupValue),
    });
  };

  const submitLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!searchTextValue || lookupMutation.isPending) {
      return;
    }

    lookupMutation.mutate({
      searchText: searchTextValue,
      searchType: activeSearchType,
    });
  };

  const detectSearchTypeForPaste = (
    event: ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const detectedSearchType = detectSearchTypeFromText(
      event.clipboardData.getData('text'),
      searchOptions
    );

    if (detectedSearchType) {
      setSelectedSearchType(detectedSearchType);
    }
  };

  const handleSingleLookupKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    openSingleLookup();
  };

  const mutationError =
    lookupMutation.error instanceof HttpError
      ? String(lookupMutation.error.body || lookupMutation.error.message)
      : lookupMutation.error?.message;
  const lookupNotice =
    lookupMutation.data?.message ||
    (lookupMutation.isSuccess && !hasResults ? 'No results found.' : '');

  return (
    <>
      <title>Bulk User Lookup | Who</title>
      <div className="container">
        <div className="mx-auto pt-20 space-y-8">
          <header className="space-y-3">
            <div className="flex items-center gap-3">
              <img alt="Who" className="who-logo h-10 w-10" src="/who.svg" />
              <h1 className="text-4xl font-bold">Bulk User Lookup</h1>
            </div>
            <div className="max-w-3xl space-y-2 text-base-content/70">
              <p className="leading-relaxed">
                Choose a search field, paste your values, then submit the
                lookup.
                <br />
                We will try to detect the search type when you paste, so review
                the selected field before submitting.
              </p>
              <p className="flex flex-col items-start gap-x-3 gap-y-2 text-sm md:flex-row md:flex-wrap md:items-center">
                <span className="font-semibold text-base-content/80">
                  Keyboard shortcuts
                </span>
                <span>
                  <kbd className="kbd kbd-sm">Ctrl</kbd> +{' '}
                  <span className="underline underline-offset-2">
                    underlined letter
                  </span>{' '}
                  switches what to search.
                </span>
                <span
                  aria-hidden="true"
                  className="hidden text-base-content/30 md:inline"
                >
                  •
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="kbd kbd-sm">Ctrl</kbd>
                  <span>/</span>
                  <kbd className="kbd kbd-sm">⌘</kbd>
                  <span>+</span>
                  <kbd className="kbd kbd-sm">Enter</kbd>
                  <span>searches.</span>
                </span>
              </p>
            </div>
          </header>

          <section className="card shadow-xl">
            <div className="card-body">
              <form className="space-y-6" onSubmit={submitLookup}>
                <div className="space-y-4">
                  <fieldset className="min-w-0">
                    <legend className="mb-2 font-medium uppercase">
                      Search For
                    </legend>
                    <div className="flex flex-wrap gap-1 rounded-box bg-base-200 p-1">
                      {searchOptions.map((option) => {
                        const shortcutIndex = option.label
                          .toLowerCase()
                          .indexOf(option.shortcut);

                        return (
                          <label
                            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-field px-3 text-sm text-base-content hover:bg-base-100 has-checked:bg-base-100 has-checked:font-semibold has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-primary"
                            key={option.value}
                          >
                            <input
                              aria-keyshortcuts={`Control+${option.shortcut.toUpperCase()}`}
                              aria-label={option.label}
                              checked={activeSearchType === option.value}
                              className="size-4 shrink-0 accent-primary"
                              name="search-type"
                              onChange={() =>
                                setSelectedSearchType(option.value)
                              }
                              type="radio"
                              value={option.value}
                            />
                            <span>
                              {option.label.slice(0, shortcutIndex)}
                              <span className="underline underline-offset-2">
                                {option.label[shortcutIndex]}
                              </span>
                              {option.label.slice(shortcutIndex + 1)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="form-control w-full">
                    <span className="label-text mb-2 font-medium uppercase">
                      Values
                    </span>
                    <textarea
                      aria-label="Values"
                      className="textarea textarea-bordered min-h-36 w-full mt-2"
                      onChange={(event) => setSearchText(event.target.value)}
                      onKeyDown={submitLookupFromKeyboard}
                      onPaste={detectSearchTypeForPaste}
                      placeholder={selectedSearchOption.placeholder}
                      value={searchText}
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="btn btn-primary"
                      disabled={lookupMutation.isPending || !searchTextValue}
                      type="submit"
                    >
                      {lookupMutation.isPending ? (
                        <span
                          aria-hidden="true"
                          className="loading loading-spinner loading-sm"
                        />
                      ) : null}
                      Lookup Users
                    </button>
                    <button
                      className="btn btn-outline"
                      disabled={!hasLookupStateToClear}
                      onClick={() => {
                        setSearchText('');
                        setSelectedSearchType(defaultSearchType);
                        lookupMutation.reset();
                        setSelectedResult(null);
                      }}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label
                      className="text-sm font-medium whitespace-nowrap text-base-content/70"
                      htmlFor="single-user-lookup"
                    >
                      Single user
                    </label>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <input
                        aria-label="Single user lookup"
                        className="input input-bordered w-full sm:w-80"
                        id="single-user-lookup"
                        onChange={(event) =>
                          setSingleLookup(event.target.value)
                        }
                        onKeyDown={handleSingleLookupKeyDown}
                        placeholder="Searchable info, Email, kerb, etc."
                        type="text"
                        value={singleLookup}
                      />
                      <button
                        className="btn btn-primary whitespace-nowrap"
                        disabled={!singleLookupValue}
                        onClick={openSingleLookup}
                        type="button"
                      >
                        Open Details
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </section>

          {mutationError ? (
            <div className="alert alert-error" role="alert">
              <span>{mutationError}</span>
            </div>
          ) : null}

          <div
            aria-atomic="true"
            className={lookupNotice ? undefined : 'sr-only'}
            role="status"
          >
            {lookupMutation.isPending && 'Looking up users.'}
            {lookupNotice ? (
              <p
                className={
                  hasResults
                    ? 'alert border-info bg-base-200 text-base-content'
                    : 'rounded-lg border-2 border-dashed border-base-300 bg-base-200/50 p-8 text-center text-xl font-semibold'
                }
              >
                {lookupNotice}
              </p>
            ) : (
              hasResults &&
              `Lookup complete. ${results.length} ${results.length === 1 ? 'result' : 'results'}.`
            )}
          </div>

          {hasResults ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">Results</h2>
                <p className="text-sm">
                  Use the table search to filter visible rows, open Details for
                  the full row, or export all current results.
                </p>
              </div>

              <DataTable
                columns={columns}
                data={results}
                filterPlaceholder="Search results..."
                getRowLabel={(result) =>
                  result.displayName ||
                  result.searchValue ||
                  result.kerbId ||
                  ''
                }
                globalFilter="left"
                initialState={{ pagination: { pageSize: 25 } }}
                onRowClick={setSelectedResult}
                rowClassName={(result) =>
                  hasLookupIssue(result)
                    ? '[&>td]:!bg-error/15 [&>td]:text-base-content [&>td:first-child]:border-l-4 [&>td:first-child]:border-error hover:[&>td]:!bg-error/20'
                    : undefined
                }
                tableActions={(table) => {
                  const hasActiveFilter =
                    String(table.getState().globalFilter ?? '').trim() !== '';
                  const filteredRows = table
                    .getFilteredRowModel()
                    .rows.map((row) => row.original);

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <ExportDataButton
                        columns={csvColumns}
                        data={results}
                        filename="people-lookup.csv"
                      />
                      {hasActiveFilter ? (
                        <ExportDataButton
                          columns={csvColumns}
                          data={filteredRows}
                          filename="people-lookup-filtered.csv"
                          label="Export filtered"
                        />
                      ) : null}
                    </div>
                  );
                }}
              />
            </section>
          ) : null}
        </div>
      </div>

      {selectedResult ? (
        <PersonDetailsModal
          allowSensitiveInfo={allowSensitiveInfo}
          onClose={() => setSelectedResult(null)}
          result={selectedResult}
        />
      ) : null}
    </>
  );
}

function PersonDetailsModal({
  allowSensitiveInfo,
  onClose,
  result,
}: {
  allowSensitiveInfo: boolean;
  onClose: () => void;
  result: PeopleSearchResult;
}) {
  const detailKerbId = getDetailId(result);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      aria-labelledby="person-details-title"
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="modal-box max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 wrap-anywhere">
            <h2 className="text-lg font-bold" id="person-details-title">
              Person Details
            </h2>
            <p className="text-sm text-base-content/70">
              {result.displayName || result.searchValue || 'Lookup result'}
            </p>
          </div>
          <button
            aria-label="Close details"
            className="btn btn-ghost btn-sm btn-circle shrink-0"
            onClick={onClose}
            type="button"
          >
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>

        <div className="mt-6">
          <PeopleDetailsPanel
            allowSensitiveInfo={allowSensitiveInfo}
            result={result}
          />
        </div>

        <div className="modal-action">
          {detailKerbId ? <OpenDetailPageLink kerbId={detailKerbId} /> : null}
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
      <button
        aria-label="Close details overlay"
        className="modal-backdrop"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
    </dialog>
  );
}
