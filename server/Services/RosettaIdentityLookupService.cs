using Ietws;
using Microsoft.Extensions.Options;
using Server.Models.PeopleLookup;
using UCD.Rosetta.Client.Core;
using UCD.Rosetta.Client.Generated;

namespace Server.Services;

public class RosettaIdentityLookupService : IIdentityLookupService, IBulkIdentityLookupService
{
    private const string MaskedValue = "*******";

    private readonly RosettaClient _client;
    private readonly int _batchSize;

    public RosettaIdentityLookupService(RosettaClient client, IOptions<PeopleLookupOptions> options)
    {
        _client = client;
        _batchSize = options.Value.RosettaBatchSize;

        if (_batchSize <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options),
                _batchSize,
                $"{PeopleLookupOptions.SectionName}:RosettaBatchSize must be greater than zero.");
        }
    }

    public async Task<PeopleSearchResult> Lookup(string search)
    {
        var searchResult = new PeopleSearchResult
        {
            SearchValue = search
        };

        try
        {
            ICollection<Person> people;

            if (search.Contains('@', StringComparison.Ordinal))
            {
                people = await _client.Api.PeopleGETAsync(email: search);
            }
            else
            {
                people = await _client.Api.PeopleGETAsync(loginid: search);
            }

            var person = people.FirstOrDefault();
            return person == null ? searchResult : MapPerson(person, search);
        }
        catch (Exception e)
        {
            searchResult.ErrorMessage = "Error Occurred";
            searchResult.ExceptionMessage = $"(Lookup) Error: {e.Message} Inner: {e.InnerException?.Message} {e}";
            return searchResult;
        }
    }

    public async Task<PeopleSearchResult[]> LookupLastName(string search)
    {
        try
        {
            var people = await _client.Api.PeopleGETAsync(lastname: search);
            return MapPeople(people, search);
        }
        catch (Exception e)
        {
            return
            [
                new PeopleSearchResult
                {
                    SearchValue = search,
                    ErrorMessage = "Error Occurred",
                    ExceptionMessage = $"(LookupLastName) Error: {e.Message} Inner: {e.InnerException?.Message} {e}"
                }
            ];
        }
    }

    public async Task<PeopleSearchResult[]> LookupPpsaCode(string search)
    {
        try
        {
            // Low confidence: Rosetta's department filter is the closest available match for the legacy PPSA admin department code.
            var people = await _client.Api.PeopleGETAsync(department: search);
            return MapPeople(people, search);
        }
        catch (Exception e)
        {
            return
            [
                new PeopleSearchResult
                {
                    SearchValue = search,
                    ErrorMessage = "Error Occurred",
                    ExceptionMessage = $"(Lookup PPSA Code) Error: {e.Message} Inner: {e.InnerException?.Message} {e}"
                }
            ];
        }
    }

    public async Task<PeopleSearchResult> LookupId(PeopleSearchField searchField, string search)
    {
        var searchResult = new PeopleSearchResult
        {
            SearchValue = search
        };

        try
        {
            ICollection<Person> people;

            switch (searchField)
            {
                case PeopleSearchField.iamId:
                    people = await _client.Api.PeopleGETAsync(iamid: search);
                    break;
                case PeopleSearchField.employeeId:
                    people = await _client.Api.PeopleGETAsync(employeeid: search);
                    break;
                case PeopleSearchField.studentId:
                    people = await _client.Api.PeopleGETAsync(studentid: search);
                    break;
                case PeopleSearchField.mothraId:
                    people = await _client.Api.PeopleGETAsync(mothraid: search);
                    break;
                case PeopleSearchField.ppsId:
                    people = await _client.Api.PeopleGETAsync(pps_id: search);
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(searchField), searchField, "Unsupported people search field.");
            }

            var person = people.FirstOrDefault();
            return person == null ? searchResult : MapPerson(person, search);
        }
        catch (Exception e)
        {
            searchResult.ErrorMessage = "Error Occurred";
            searchResult.ExceptionMessage = $"(LookupId) Error: {e.Message} Inner: {e.InnerException?.Message} {e}";
            return searchResult;
        }
    }

    public async Task<PeopleSearchResult[]> LookupIds(
        PeopleSearchField searchField,
        IReadOnlyCollection<string> searches)
    {
        if (searchField != PeopleSearchField.iamId && searchField != PeopleSearchField.employeeId)
        {
            throw new ArgumentOutOfRangeException(
                nameof(searchField),
                searchField,
                "Bulk Rosetta lookup currently supports IAM IDs and employee IDs only.");
        }

        var results = new List<PeopleSearchResult>(searches.Count);

        foreach (var batch in searches.Chunk(_batchSize))
        {
            try
            {
                var people = await _client.Api.PeoplePOSTAsync(CreatePostRequest(searchField, batch));
                var peopleBySearchValue = people
                    .Select(person => new
                    {
                        SearchValue = GetSearchValue(person, searchField),
                        Person = person
                    })
                    .Where(item => item.SearchValue != null)
                    .GroupBy(item => item.SearchValue!, StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.First().Person, StringComparer.Ordinal);

                foreach (var search in batch)
                {
                    results.Add(peopleBySearchValue.TryGetValue(search, out var person)
                        ? MapPerson(person, search)
                        : new PeopleSearchResult { SearchValue = search });
                }
            }
            catch (Exception e)
            {
                foreach (var search in batch)
                {
                    results.Add(new PeopleSearchResult
                    {
                        SearchValue = search,
                        ErrorMessage = "Error Occurred",
                        ExceptionMessage = $"(LookupIds) Error: {e.Message} Inner: {e.InnerException?.Message} {e}"
                    });
                }
            }
        }

        return results.ToArray();
    }

    private static PeoplePostRequest CreatePostRequest(PeopleSearchField searchField, string[] batch)
    {
        var request = new PeoplePostRequest
        {
            Count = false,
            Limit = batch.Length,
            Offset = 0
        };

        if (searchField == PeopleSearchField.iamId)
        {
            request.Iamids = batch;
        }
        else
        {
            request.Employeeids = batch;
        }

        return request;
    }

    private static string? GetSearchValue(Person person, PeopleSearchField searchField)
    {
        if (searchField == PeopleSearchField.iamId)
        {
            return FirstValue(person.Iam_id, person.Id?.Iam_id);
        }

        return FirstValue(
            person.Id?.Employee_id,
            FirstValue((person.Employee_association ?? [])
                .Select(association => association.Employee_id)
                .ToArray()));
    }

    private static PeopleSearchResult[] MapPeople(ICollection<Person> people, string search)
    {
        var results = people.Select(person => MapPerson(person, search)).ToArray();

        return results.Length > 0
            ? results
            : [new PeopleSearchResult { SearchValue = search }];
    }

    private static PeopleSearchResult MapPerson(Person person, string search)
    {
        var affiliation = person.Affiliation;
        var employmentStatus = person.Employment_status;
        var employeeAssociations = person.Employee_association ?? [];
        var primaryEmail = FirstValue(person.Email?.Campus, person.Email?.Health, person.Email?.Personal);

        // High confidence: these values are direct Rosetta equivalents of the existing identifiers and person attributes.
        var iamId = FirstValue(person.Iam_id, person.Id?.Iam_id);
        var isEmployee = IsYes(affiliation?.Employee);
        var isStudent = IsYes(affiliation?.Student);
        var isFaculty = IsYes(affiliation?.Faculty) || IsYes(employmentStatus?.Is_faculty);
        var isHsEmployee = IsYes(employmentStatus?.Is_health_employee);

        // High confidence: Rosetta exposes categorized emails, while the existing result distinguishes primary from "other" email.
        // Unlikely we will ever see Personal Email.
        var otherEmails = GetOtherEmails(primaryEmail, person.Email?.Campus, person.Email?.Health, person.Email?.Personal);

        // Low confidence: Rosetta has no exact standalone IETws staff flag, so this is a best-effort derivation.
        var isStaff = isEmployee && !isFaculty && !IsYes(employmentStatus?.Is_academic);

        // High confidence: the existing external flag maps directly to Rosetta's temporary-affiliate flag.
        var isExternal = IsYes(affiliation?.Temporary_affiliate);

        // TODO: Not currently mapped: student-applicant, health, COSMOS, CPE, UC ANR, and USDA WHNRC affiliates.
        // PeopleSearchResult has no good destination for them yet; retain this note for future result fields.

        // Medium confidence: Rosetta employee associations represent the same concepts, but not the legacy PPSA source records.
        var titles = JoinDistinct(employeeAssociations.Select(association => association.Position_title));
        var departments = FormatDepartments(employeeAssociations);
        var reportsToIamId = FirstValue(
            person.Manager_iam_id,
            FirstValue(employeeAssociations.Select(association => association.Reports_to_iam_id).ToArray()));
        var employeeId = FirstValue(
            person.Id?.Employee_id,
            FirstValue(employeeAssociations.Select(association => association.Employee_id).ToArray()));

        // High confidence: display name maps directly; lived first, middle, and last name map to FullLivedName.
        return new PeopleSearchResult
        {
            SearchValue = search,
            Found = !string.IsNullOrWhiteSpace(iamId),
            DisplayName = NormalizeValue(person.Displayname),
            FullLivedName = JoinName(person.Name?.Lived_first_name, person.Name?.Lived_middle_name, person.Name?.Lived_last_name),
            FirstName = NormalizeValue(person.Name?.Lived_first_name),
            LastName = NormalizeValue(person.Name?.Lived_last_name),
            Pronouns = NormalizeValue(person.Name?.Lived_pronouns),
            KerbId = NormalizeValue(person.Id?.Login_id),
            IamId = iamId,
            Email = primaryEmail,
            OtherEmails = otherEmails,
            IsEmployee = isEmployee,
            IsHsEmployee = isHsEmployee,
            IsFaculty = isFaculty,
            IsStudent = isStudent,
            IsExternal = isExternal,
            IsStaff = isStaff,
            PpsId = NormalizeValue(person.Id?.Pps_id),
            StudentId = NormalizeValue(person.Id?.Student_id),
            BannerPidm = NormalizeValue(person.Id?.Pidm),
            EmployeeId = employeeId,
            MothraId = NormalizeValue(person.Id?.Mothra_id),
            LastUpdated = person.Modified_date,
            Title = titles,
            ReportsToIamId = reportsToIamId,
            WorkPhone = NormalizeValue(person.Phone?.Work),
            Departments = departments
        };
    }

    private static string? GetOtherEmails(string? primaryEmail, params string?[] emailValues)
    {
        var emails = emailValues
            .Select(NormalizeValue)
            .Where(value => value != null)
            .Select(value => value!.ToLowerInvariant())
            .Where(value => !string.Equals(value, primaryEmail, StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return emails.Length > 0 ? string.Join("; ", emails) : null;
    }

    private static string? FormatDepartments(IEnumerable<Employee_association> employeeAssociations)
    {
        var departments = JoinDistinct(employeeAssociations.Select(association => association.Department_title));
        var departmentCodes = JoinDistinct(employeeAssociations.Select(association => association.Department_id));

        if (string.IsNullOrWhiteSpace(departments))
        {
            return departmentCodes;
        }

        return string.IsNullOrWhiteSpace(departmentCodes)
            ? departments
            : $"{departments} ({departmentCodes})";
    }

    private static string? JoinDistinct(IEnumerable<string?> values)
    {
        var distinctValues = values
            .Select(NormalizeValue)
            .Where(value => value != null)
            .Select(value => value!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return distinctValues.Length > 0 ? string.Join(", ", distinctValues) : null;
    }

    private static string? JoinName(params string?[] values)
    {
        var name = string.Join(" ", values.Select(NormalizeValue).Where(value => value != null));
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    private static string? FirstValue(params string?[] values)
    {
        return values.Select(NormalizeValue).FirstOrDefault(value => value != null);
    }

    private static bool IsYes(string? value)
    {
        return string.Equals(NormalizeValue(value), "Y", StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeValue(string? value)
    {
        // High confidence: Rosetta uses seven asterisks to mask unavailable values; masked values are absent to Who.
        return string.IsNullOrWhiteSpace(value) || value.Contains(MaskedValue, StringComparison.Ordinal)
            ? null
            : value;
    }
}
