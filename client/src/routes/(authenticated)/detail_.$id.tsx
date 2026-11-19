import {
  PeopleAffiliations,
  PeopleDetailsPanel,
  type PeopleLookupResponse,
} from '@/shared/peopleLookupDetails.tsx';
import { fetchJson, HttpError } from '@/lib/api.ts';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/(authenticated)/detail_/$id')({
  component: PeopleLookupDetail,
});

function PeopleLookupDetail() {
  const { id } = Route.useParams();
  const decodedId = decodeURIComponent(id);
  const detailQuery = useQuery({
    queryFn: ({ signal }) =>
      fetchJson<PeopleLookupResponse>(
        `/api/peoplelookup/detail/${encodeURIComponent(decodedId)}`,
        {},
        signal
      ),
    queryKey: ['people-lookup', 'detail', decodedId],
    staleTime: 5 * 60_000,
  });

  const result = detailQuery.data?.results[0];
  const personLabel = result?.displayName || result?.searchValue || decodedId;
  const notFound = detailQuery.isSuccess && !result?.found;
  const error =
    detailQuery.error instanceof HttpError
      ? String(detailQuery.error.body || detailQuery.error.message)
      : detailQuery.error?.message;

  return (
    <>
      <title>{`Person details for ${personLabel} | Who`}</title>
      <div className="container">
        <div className="mx-auto max-w-5xl pt-4 sm:pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="lg:w-24">
              <Link className="btn btn-default btn-sm mt-5" to="/">
                <svg
                  aria-hidden="true"
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 19l-7-7 7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                Lookup
              </Link>
            </div>

            <div className="min-w-0 flex-1 space-y-6">
              {!result && (
                <h1 className="sr-only">Person details for {personLabel}</h1>
              )}
              <div
                className={
                  detailQuery.isLoading || notFound ? undefined : 'sr-only'
                }
                role="status"
              >
                {detailQuery.isLoading ? (
                  <div className="flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 p-6">
                    <span
                      aria-hidden="true"
                      className="loading loading-spinner loading-md"
                    />
                    <span>Loading person details...</span>
                  </div>
                ) : notFound ? (
                  <div className="alert alert-error alert-soft">
                    <span className="wrap-anywhere">
                      User not found
                      {result?.errorMessage ? `: ${result.errorMessage}` : '.'}
                    </span>
                  </div>
                ) : result?.found ? (
                  `Person details loaded for ${personLabel}.`
                ) : null}
              </div>

              <div
                className={error ? 'alert alert-error' : 'sr-only'}
                role="alert"
              >
                {error && <span className="wrap-anywhere">{error}</span>}
              </div>

              {result ? (
                <section className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 wrap-anywhere">
                        <h1 className="card-title text-2xl">{personLabel}</h1>
                        {result.email ? (
                          <p className="text-base-content/70">{result.email}</p>
                        ) : null}
                      </div>
                      <PeopleAffiliations
                        className="sm:mt-1 sm:max-w-md sm:justify-end"
                        result={result}
                      />
                    </div>

                    <div className="mt-4">
                      <PeopleDetailsPanel
                        allowSensitiveInfo={
                          detailQuery.data?.allowSensitiveInfo ?? false
                        }
                        groupHeading="h2"
                        result={result}
                        showAffiliations={false}
                        showSearchField={false}
                      />
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
