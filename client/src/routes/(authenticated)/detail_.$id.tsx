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
  const error =
    detailQuery.error instanceof HttpError
      ? String(detailQuery.error.body || detailQuery.error.message)
      : detailQuery.error?.message;

  return (
    <div>
      <main className="container">
        <div className="mx-auto max-w-5xl pt-4 sm:pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="lg:w-24">
              <Link className="btn btn-default btn-sm mt-5" to="/">
                <svg
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
              {detailQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 p-6">
                  <span className="loading loading-spinner loading-md"></span>
                  <span>Loading person details...</span>
                </div>
              ) : null}

              {error ? (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              ) : null}

              {result && !result.found ? (
                <div className="alert alert-error alert-soft">
                  <span>
                    User not found
                    {result.errorMessage ? `: ${result.errorMessage}` : '.'}
                  </span>
                </div>
              ) : null}

              {result ? (
                <section className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="card-title text-2xl">
                          {result.fullName || result.searchValue || decodedId}
                        </h2>
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
      </main>
    </div>
  );
}
