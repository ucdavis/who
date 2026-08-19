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
    [Fact]
    public async Task LookupIds_posts_iam_ids_in_configured_batches_and_preserves_input_order()
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

        var results = await service.LookupIds(PeopleSearchField.iamId, iamIds);

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
    public async Task LookupIds_posts_employee_ids_and_maps_results_to_each_search_value()
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

        var results = await service.LookupIds(PeopleSearchField.employeeId, employeeIds);

        handler.Requests.Should().HaveCount(2);
        handler.Requests.Should().OnlyContain(request => request.FilterName == "employeeids");
        handler.Requests[0].Ids.Should().Equal("100000001", "100000002");
        handler.Requests[1].Ids.Should().Equal("100000003");
        results.Select(result => result.SearchValue).Should().Equal(employeeIds);
        results.Select(result => result.EmployeeId).Should().Equal(employeeIds);
        results.Should().OnlyContain(result => result.Found);
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
            var filterName = root.TryGetProperty("iamids", out var idsElement)
                ? "iamids"
                : "employeeids";
            if (filterName == "employeeids")
            {
                idsElement = root.GetProperty(filterName);
            }

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

            var responseBody = filterName == "iamids"
                ? JsonSerializer.Serialize(ids.Reverse().Select(id => new
                {
                    iam_id = id,
                    displayname = $"Person {id}"
                }))
                : JsonSerializer.Serialize(ids.Reverse().Select((id, index) => new
                {
                    iam_id = $"900000000{index}",
                    displayname = $"Employee {id}",
                    id = new { employee_id = id }
                }));

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            };
        }
    }

    private sealed record PeoplePostRequestRecord(
        string FilterName,
        string[] Ids,
        int Limit,
        int Offset,
        bool Count);
}
