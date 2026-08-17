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
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            return BadRequest(
                $"Missing Rosetta credentials. Provide the {ClientIdHeaderName} and {ClientSecretHeaderName} headers.");
        }

        if (!HasSearchValue(iamId, email, loginId, lastName, department, employeeId, studentId, ppsId))
        {
            return BadRequest("Provide at least one Rosetta people search value.");
        }

        var options = new RosettaClientOptions();
        _configuration.GetSection("RosettaClient").Bind(options);

        if (string.IsNullOrWhiteSpace(options.BaseUrl) || string.IsNullOrWhiteSpace(options.TokenUrl))
        {
            return Problem(
                detail: "Set RosettaClient__BaseUrl and RosettaClient__TokenUrl in the server configuration.",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Rosetta is not configured.");
        }

        options.ClientId = clientId;
        options.ClientSecret = clientSecret;

        if (!string.IsNullOrWhiteSpace(scopes))
        {
            options.Scope = scopes.Trim();
        }

        using var client = new RosettaClient(options);
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

    private static bool HasSearchValue(params string?[] values)
    {
        return values.Any(value => !string.IsNullOrWhiteSpace(value));
    }
}
