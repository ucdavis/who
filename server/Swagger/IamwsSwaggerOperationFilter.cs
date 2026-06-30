using Ietws;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Server.Controllers;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Server.Swagger;

public class IamwsSwaggerOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (context.MethodInfo.DeclaringType != typeof(IamwsController) ||
            context.MethodInfo.Name != nameof(IamwsController.GetPPSAssociation))
        {
            return;
        }

        operation.Summary = "Search PPS associations.";
        operation.Description = "Compatibility endpoint from the original people-lookup app. The field query value accepts enum names, including bouOrgOId, so callers may use /api/Iamws/PPSAssociation?field=bouOrgOId&fieldValue=<orgOid>&retType=default.";

        foreach (var parameter in operation.Parameters)
        {
            ApplyParameterDocumentation(parameter);
        }
    }

    private static void ApplyParameterDocumentation(OpenApiParameter parameter)
    {
        switch (parameter.Name)
        {
            case "key":
                parameter.Description = "People Lookup API key. URL-encode this value when building query strings manually.";
                break;
            case "field":
                parameter.Description = "PPS association search field name. Use bouOrgOId for BOU organization OID lookups.";
                parameter.Example = new OpenApiString(nameof(PPSAssociationsSearchField.bouOrgOId));
                break;
            case "fieldValue":
                parameter.Description = "Value to search for in the selected field, such as the CAES organization OID when field is bouOrgOId.";
                parameter.Example = new OpenApiString("<orgOid>");
                break;
            case "retType":
                parameter.Description = "Response shape. Use default for the standard PPS association response, or people for PeopleResults.";
                parameter.Schema.Enum = new List<IOpenApiAny>
                {
                    new OpenApiString("default"),
                    new OpenApiString("people")
                };
                parameter.Schema.Default = new OpenApiString("default");
                parameter.Example = new OpenApiString("default");
                break;
        }
    }
}