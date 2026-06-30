using Ietws;
using Microsoft.AspNetCore.Mvc;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IamwsController : ControllerBase
{

    [HttpGet("PPSAssociation", Name = "GetPPSAssociation")]
    public async Task<IActionResult> GetPPSAssociation(
        string key,
        PPSAssociationsSearchField field,
        string fieldValue,
        string retType = "default")
    {
        var client = new IetClient(key);

        if (retType.Equals("people", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(await client.PPSAssociations.Search<PeopleResults>(field, fieldValue, "people"));
        }

        return Ok(await client.PPSAssociations.Search(field, fieldValue));
    }

    [HttpGet("Contact/{id}", Name = "GetContact")]
    public async Task<IActionResult> GetContacts(string key, string id)
    {
        var client = new IetClient(key);

        return Ok(await client.Contacts.Get(id));
    }
}