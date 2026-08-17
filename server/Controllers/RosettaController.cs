using Microsoft.AspNetCore.Mvc;
using UCD.Rosetta.Client.Core;
using UCD.Rosetta.Client.Core.Configuration;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RosettaController : ControllerBase
{
    public const string ClientIdHeaderName = "X-Rosetta-Client-Id";
    public const string ClientSecretHeaderName = "X-Rosetta-Client-Secret";
    public const string ScopesHeaderName = "X-Rosetta-Scopes";

    private readonly IConfiguration _configuration;

    public RosettaController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("People", Name = "GetRosettaPeople")]
    public async Task<IActionResult> GetPeople(
        [FromHeader(Name = ClientIdHeaderName)] string? clientId,
        [FromHeader(Name = ClientSecretHeaderName)] string? clientSecret,
        [FromHeader(Name = ScopesHeaderName)] string? scopes,
        string? iamId,
        string? email,
        string? loginId,
        string? lastName,
        string? department,
        string? employeeId,
        string? studentId,
        string? ppsId,
        CancellationToken cancellationToken)
    {
        if (!HasSearchValue(iamId, email, loginId, lastName, department, employeeId, studentId, ppsId))
        {
            return BadRequest("Provide at least one Rosetta people search value.");
        }

        using var client = CreateClient(clientId, clientSecret, scopes, out var errorResult);
        if (client == null)
        {
            return errorResult!;
        }

        var people = await client.Api.PeopleGETAsync(
            lastname: lastName,
            iamid: iamId,
            email: email,
            loginid: loginId,
            employeeid: employeeId,
            studentid: studentId,
            pps_id: ppsId,
            department: department,
            cancellationToken: cancellationToken);

        return Ok(people);
    }

    [HttpGet("Contact/{id}", Name = "GetRosettaContact")]
    public async Task<IActionResult> GetContact(
        string id,
        [FromHeader(Name = ClientIdHeaderName)] string? clientId,
        [FromHeader(Name = ClientSecretHeaderName)] string? clientSecret,
        [FromHeader(Name = ScopesHeaderName)] string? scopes,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return BadRequest("Provide an IAM ID.");
        }

        using var client = CreateClient(clientId, clientSecret, scopes, out var errorResult);
        if (client == null)
        {
            return errorResult!;
        }

        // Rosetta includes the legacy contact fields in its person response rather than a separate contact resource.
        var people = await client.Api.PeopleGETAsync(
            iamid: id,
            cancellationToken: cancellationToken);

        return Ok(people);
    }

    [HttpGet("PPSAssociation", Name = "GetRosettaPPSAssociation")]
    public async Task<IActionResult> GetPpsAssociation(
        [FromHeader(Name = ClientIdHeaderName)] string? clientId,
        [FromHeader(Name = ClientSecretHeaderName)] string? clientSecret,
        [FromHeader(Name = ScopesHeaderName)] string? scopes,
        string? iamId,
        string? loginId,
        string? employeeId,
        string? jobTypeId,
        string? organizationId,
        string? departmentId,
        string? divisionId,
        string? subdivisionId,
        string? subdivisionL4Id,
        CancellationToken cancellationToken)
    {
        if (!HasSearchValue(
                iamId,
                loginId,
                employeeId,
                jobTypeId,
                organizationId,
                departmentId,
                divisionId,
                subdivisionId,
                subdivisionL4Id))
        {
            return BadRequest("Provide at least one Rosetta employee-association search value.");
        }

        using var client = CreateClient(clientId, clientSecret, scopes, out var errorResult);
        if (client == null)
        {
            return errorResult!;
        }

        // Rosetta employee associations are the closest equivalent to legacy IAMWS PPS associations.
        var associations = await client.Api.EmployeeAssociationAsync(
            iamid: iamId,
            loginid: loginId,
            employeeid: employeeId,
            jobtypeid: jobTypeId,
            organizationid: organizationId,
            departmentid: departmentId,
            divisionid: divisionId,
            subdivisionid: subdivisionId,
            subdivisionl4id: subdivisionL4Id,
            cancellationToken: cancellationToken);

        return Ok(associations);
    }

    private RosettaClient? CreateClient(
        string? clientId,
        string? clientSecret,
        string? scopes,
        out IActionResult? errorResult)
    {
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            errorResult = BadRequest(
                $"Missing Rosetta credentials. Provide the {ClientIdHeaderName} and {ClientSecretHeaderName} headers.");
            return null;
        }

        var options = new RosettaClientOptions();
        _configuration.GetSection("RosettaClient").Bind(options);

        if (string.IsNullOrWhiteSpace(options.BaseUrl) || string.IsNullOrWhiteSpace(options.TokenUrl))
        {
            errorResult = Problem(
                detail: "Set RosettaClient__BaseUrl and RosettaClient__TokenUrl in the server configuration.",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Rosetta is not configured.");
            return null;
        }

        options.ClientId = clientId;
        options.ClientSecret = clientSecret;

        if (!string.IsNullOrWhiteSpace(scopes))
        {
            options.Scope = scopes.Trim();
        }

        errorResult = null;
        return new RosettaClient(options);
    }

    private static bool HasSearchValue(params string?[] values)
    {
        return values.Any(value => !string.IsNullOrWhiteSpace(value));
    }
}
