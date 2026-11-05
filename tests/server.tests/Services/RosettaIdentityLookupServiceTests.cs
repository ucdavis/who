using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Ietws;
using Microsoft.Extensions.Options;
using Server.Models.PeopleLookup;
using Server.Services;
using UCD.Rosetta.Client.Core;
using UCD.Rosetta.Client.Core.Configuration;

namespace Server.Tests.Services;

public class RosettaIdentityLookupServiceTests
{
    [Theory]
    [InlineData(null, "loginId")]
    [InlineData(PeopleSearchField.iamId, "iamId")]
    [InlineData(PeopleSearchField.employeeId, "employeeId")]
    [InlineData(PeopleSearchField.studentId, "studentId")]
    [InlineData(PeopleSearchField.mothraId, "mothraId")]
    [InlineData(PeopleSearchField.ppsId, "ppsId")]
    public async Task Lookup_uses_camel_case_identifier_query_parameters(
        PeopleSearchField? searchField,
        string expectedParameterName)
    {
        const string search = "1000000001";
        using var restClient = new HttpClient(new PeopleWithLastUpdatedHandler(
            "2026-05-22T21:00:14.710Z",
            HttpMethod.Get,
            $"?{expectedParameterName}={search}"));
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions()));

        var result = searchField.HasValue
            ? await service.LookupId(searchField.Value, search)
            : await service.Lookup(search);

        result.ErrorMessage.Should().BeNull();
        result.Found.Should().BeTrue();
    }

    [Theory]
    [InlineData("2026-05-22T21:00:14.710", "2026-05-22T21:00:14.710+00:00", false)]
    [InlineData("2026-05-22T21:00:14.710", "2026-05-22T21:00:14.710+00:00", true)]
    [InlineData("2026-01-22T21:00:14.710", "2026-01-22T21:00:14.710+00:00", false)]
    [InlineData("2026-05-22T21:00:14.710Z", "2026-05-22T21:00:14.710+00:00", false)]
    public async Task Lookup_treats_Rosetta_modified_date_as_UTC(
        string modifiedDate,
        string expectedUtc,
        bool bulkLookup)
    {
        using var restClient = new HttpClient(new PeopleWithLastUpdatedHandler(
            modifiedDate,
            bulkLookup ? HttpMethod.Post : HttpMethod.Get));
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions()));

        var result = bulkLookup
            ? (await service.LookupMany(BulkPeopleSearchField.IamId, ["1000000001"])).Single()
            : await service.Lookup("person@example.test");

        result.Found.Should().BeTrue();
        result.LastUpdated.Should().Be(DateTimeOffset.Parse(expectedUtc, CultureInfo.InvariantCulture));
        result.LastUpdated!.Value.Offset.Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public async Task LookupMany_posts_iam_ids_in_configured_batches_and_preserves_input_order()
    {
        var handler = new PeoplePostHandler();
        using var restClient = new HttpClient(handler);
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions { RosettaBatchSize = 2 }));
        string[] iamIds = ["1000000001", "1000000002", "1000000003", "1000000004", "1000000005"];

        var results = await service.LookupMany(BulkPeopleSearchField.IamId, iamIds);

        handler.Requests.Should().HaveCount(3);
        handler.Requests.Should().OnlyContain(request => request.FilterName == "iamids");
        handler.Requests[0].Ids.Should().Equal("1000000001", "1000000002");
        handler.Requests[1].Ids.Should().Equal("1000000003", "1000000004");
        handler.Requests[2].Ids.Should().Equal("1000000005");
        handler.Requests.Select(request => request.Limit).Should().Equal(2, 2, 1);
        handler.Requests.Should().OnlyContain(request => request.Count == false && request.Offset == 0);
        results.Select(result => result.SearchValue).Should().Equal(iamIds);
        results.Should().OnlyContain(result => result.Found);
    }

    [Fact]
    public async Task LookupMany_posts_employee_ids_and_maps_results_to_each_search_value()
    {
        var handler = new PeoplePostHandler();
        using var restClient = new HttpClient(handler);
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions { RosettaBatchSize = 2 }));
        string[] employeeIds = ["100000001", "100000002", "100000003"];

        var results = await service.LookupMany(BulkPeopleSearchField.EmployeeId, employeeIds);

        handler.Requests.Should().HaveCount(2);
        handler.Requests.Should().OnlyContain(request => request.FilterName == "employeeids");
        handler.Requests[0].Ids.Should().Equal("100000001", "100000002");
        handler.Requests[1].Ids.Should().Equal("100000003");
        results.Select(result => result.SearchValue).Should().Equal(employeeIds);
        results.Select(result => result.EmployeeId).Should().Equal(employeeIds);
        results.Should().OnlyContain(result => result.Found);
    }

    [Fact]
    public async Task LookupMany_posts_105_pps_ids_in_three_batches_and_preserves_identifiers_and_order()
    {
        var handler = new PeoplePostHandler();
        using var restClient = new HttpClient(handler);
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions()));
        var ppsIds = Enumerable.Range(1, 105)
            .Select(id => id.ToString("D9", CultureInfo.InvariantCulture))
            .ToArray();

        var results = await service.LookupMany(BulkPeopleSearchField.PpsId, ppsIds);

        handler.Requests.Should().HaveCount(3);
        handler.Requests.Should().OnlyContain(request => request.FilterName == "ppsids");
        handler.Requests.Select(request => request.Ids.Length).Should().Equal(50, 50, 5);
        handler.Requests.SelectMany(request => request.Ids).Should().Equal(ppsIds);
        handler.Requests.Select(request => request.Limit).Should().Equal(50, 50, 5);
        handler.Requests.Should().OnlyContain(request => request.Count == false && request.Offset == 0);
        results.Select(result => result.SearchValue).Should().Equal(ppsIds);
        results.Select(result => result.PpsId).Should().Equal(ppsIds);
        results.Should().OnlyContain(result => result.Found && result.ErrorMessage == null);
    }

    [Theory]
    [InlineData(BulkPeopleSearchField.StudentId, "studentids")]
    [InlineData(BulkPeopleSearchField.MothraId, "mothraids")]
    public async Task LookupMany_posts_supported_identity_filters(
        BulkPeopleSearchField searchField,
        string expectedFilterName)
    {
        var handler = new PeoplePostHandler();
        using var restClient = new HttpClient(handler);
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions { RosettaBatchSize = 2 }));
        string[] ids = ["100000001", "100000002", "100000003"];

        var results = await service.LookupMany(searchField, ids);

        handler.Requests.Should().HaveCount(2);
        handler.Requests.Should().OnlyContain(request => request.FilterName == expectedFilterName);
        handler.Requests[0].Ids.Should().Equal("100000001", "100000002");
        handler.Requests[1].Ids.Should().Equal("100000003");
        results.Select(result => result.SearchValue).Should().Equal(ids);
        results.Should().OnlyContain(result => result.Found);

        if (searchField == BulkPeopleSearchField.StudentId)
        {
            results.Select(result => result.StudentId).Should().Equal(ids);
        }
        else
        {
            results.Select(result => result.MothraId).Should().Equal(ids);
        }
    }

    [Theory]
    [InlineData(BulkPeopleSearchField.Email, "emails")]
    [InlineData(BulkPeopleSearchField.LoginId, "loginids")]
    public async Task LookupMany_posts_email_and_login_filters(
        BulkPeopleSearchField searchField,
        string expectedFilterName)
    {
        var handler = new PeoplePostHandler();
        using var restClient = new HttpClient(handler);
        using var graphQlClient = new HttpClient(new PeoplePostHandler())
        {
            BaseAddress = new Uri("https://example.test/api/v1/graphql")
        };
        using var rosettaClient = new RosettaClient(restClient, graphQlClient, CreateRosettaOptions());
        var service = new RosettaIdentityLookupService(
            rosettaClient,
            Options.Create(new PeopleLookupOptions { RosettaBatchSize = 2 }));
        var searches = searchField == BulkPeopleSearchField.Email
            ? new[] { "first@example.com", "second@example.com" }
            : ["first.user", "second.user"];

        var results = await service.LookupMany(searchField, searches);

        handler.Requests.Should().ContainSingle()
            .Which.FilterName.Should().Be(expectedFilterName);
        handler.Requests[0].Ids.Should().Equal(searches);
        results.Select(result => result.SearchValue).Should().Equal(searches);
        results.Should().OnlyContain(result => result.Found);

        if (searchField == BulkPeopleSearchField.Email)
        {
            results.Select(result => result.Email).Should().Equal(searches.Select(value => value.ToUpperInvariant()));
        }
        else
        {
            results.Select(result => result.KerbId).Should().Equal(searches.Select(value => value.ToUpperInvariant()));
        }
    }

    [Fact]
    public void PeopleLookupOptions_defaults_rosetta_batch_size_to_fifty()
    {
        new PeopleLookupOptions().RosettaBatchSize.Should().Be(50);
    }

    private static RosettaClientOptions CreateRosettaOptions()
    {
        return new RosettaClientOptions
        {
            BaseUrl = "https://example.test/api/{version}/",
            TokenUrl = "https://example.test/oauth/token",
            ClientId = "test-client",
            ClientSecret = "test-secret",
            ApiVersion = "v1"
        };
    }

    private sealed class PeopleWithLastUpdatedHandler(
        string modifiedDate,
        HttpMethod expectedMethod,
        string? expectedQuery = null) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            request.Method.Should().Be(expectedMethod);
            request.RequestUri!.AbsolutePath.Should().Be("/api/v1/people");
            if (expectedQuery != null)
            {
                request.RequestUri.Query.Should().Be(expectedQuery);
            }

            var responseBody = JsonSerializer.Serialize(new[]
            {
                new
                {
                    iam_id = "1000000001",
                    displayname = "Person Example",
                    modified_date = modifiedDate
                }
            });

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            });
        }
    }

    private sealed class PeoplePostHandler : HttpMessageHandler
    {
        public List<PeoplePostRequestRecord> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            request.Method.Should().Be(HttpMethod.Post);
            request.RequestUri.Should().Be("https://example.test/api/v1/people");

            var body = await request.Content!.ReadAsStringAsync(cancellationToken);
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var filterName = new[] { "emails", "loginids", "iamids", "employeeids", "studentids", "mothraids", "ppsids" }
                .Single(name => root.TryGetProperty(name, out _));
            var idsElement = root.GetProperty(filterName);

            var ids = idsElement
                .EnumerateArray()
                .Select(value => value.GetString()!)
                .ToArray();

            Requests.Add(new PeoplePostRequestRecord(
                filterName,
                ids,
                root.GetProperty("limit").GetInt32(),
                root.GetProperty("offset").GetInt32(),
                root.GetProperty("count").GetBoolean()));

            var responseBody = CreateResponseBody(filterName, ids);

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            };
        }

        private static string CreateResponseBody(string filterName, string[] ids)
        {
            if (filterName == "iamids")
            {
                return JsonSerializer.Serialize(ids.Reverse().Select(id => new
                {
                    iam_id = id,
                    displayname = $"Person {id}"
                }));
            }

            if (filterName == "emails")
            {
                return JsonSerializer.Serialize(ids.Reverse().Select((id, index) => new
                {
                    iam_id = $"900000000{index}",
                    displayname = $"Person {id}",
                    email = new { health = id.ToUpperInvariant() }
                }));
            }

            if (filterName == "loginids")
            {
                return JsonSerializer.Serialize(ids.Reverse().Select((id, index) => new
                {
                    iam_id = $"900000000{index}",
                    displayname = $"Person {id}",
                    id = new { login_id = id.ToUpperInvariant() }
                }));
            }

            return JsonSerializer.Serialize(ids.Reverse().Select((id, index) => new
            {
                iam_id = $"900000000{index}",
                displayname = $"Person {id}",
                id = filterName switch
                {
                    "employeeids" => new Dictionary<string, string> { ["employee_id"] = id },
                    "studentids" => new Dictionary<string, string> { ["student_id"] = id },
                    "mothraids" => new Dictionary<string, string> { ["mothra_id"] = id },
                    "ppsids" => new Dictionary<string, string> { ["pps_id"] = id },
                    _ => throw new InvalidOperationException($"Unsupported test filter {filterName}.")
                }
            }));
        }
    }

    private sealed record PeoplePostRequestRecord(
        string FilterName,
        string[] Ids,
        int Limit,
        int Offset,
        bool Count);
}
