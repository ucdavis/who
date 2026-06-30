using Ietws;
using Microsoft.AspNetCore.Mvc;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IamwsController : ControllerBase
{
    private const string IamwsKeyHeaderName = "X-Iamws-Key";
    private const string MissingIamwsKeyMessage = "Missing IAMWS key. Provide the X-Iamws-Key header or key query parameter.";

    [HttpGet("PPSAssociation", Name = "GetPPSAssociation")]
    public async Task<IActionResult> GetPPSAssociation(
        [FromHeader(Name = IamwsKeyHeaderName)] string? headerKey,
        [FromQuery(Name = "key")] string? queryKey,
        PPSAssociationsSearchField field,
        string fieldValue,
        string retType = "default")
    {
        var iamwsKey = GetIamwsKey(headerKey, queryKey);

        if (iamwsKey == null)
        {
            return BadRequest(MissingIamwsKeyMessage);
        }

        var client = new IetClient(iamwsKey);

        if (retType.Equals("people", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(await client.PPSAssociations.Search<PeopleResults>(field, fieldValue, "people"));
        }

        return Ok(await client.PPSAssociations.Search(field, fieldValue));
    }

    [HttpGet("Contact/{id}", Name = "GetContact")]
    public async Task<IActionResult> GetContacts(
        string id,
        [FromHeader(Name = IamwsKeyHeaderName)] string? headerKey,
        [FromQuery(Name = "key")] string? queryKey)
    {
        var iamwsKey = GetIamwsKey(headerKey, queryKey);

        if (iamwsKey == null)
        {
            return BadRequest(MissingIamwsKeyMessage);
        }

        var client = new IetClient(iamwsKey);

        return Ok(await client.Contacts.Get(id));
    }

    private static string? GetIamwsKey(string? headerKey, string? queryKey)
    {
        if (!string.IsNullOrWhiteSpace(headerKey))
        {
            return headerKey;
        }

        return !string.IsNullOrWhiteSpace(queryKey) ? queryKey : null;
    }
}