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
        if (context.MethodInfo.DeclaringType == typeof(RosettaController))
        {
            ApplyRosettaDocumentation(operation, context);
            return;
        }

        if (context.MethodInfo.DeclaringType != typeof(IamwsController))
        {
            return;
        }

        if (context.MethodInfo.Name == nameof(IamwsController.GetPPSAssociation))
        {
            operation.Summary = "Search PPS associations.";
            operation.Description = "Compatibility endpoint from the original people-lookup app. Prefer the X-Iamws-Key header for the IAMWS key; legacy callers may still use the key query parameter. The field query value accepts enum names, including bouOrgOId, so callers may use /api/Iamws/PPSAssociation?key=<key>&field=bouOrgOId&fieldValue=<orgOid>&retType=default.";
        }
        else if (context.MethodInfo.Name == nameof(IamwsController.GetContacts))
        {
            operation.Summary = "Get IAMWS contact details.";
            operation.Description = "Compatibility endpoint from the original people-lookup app. Prefer the X-Iamws-Key header for the IAMWS key; legacy callers may still use the key query parameter.";
        }
        else
        {
            return;
        }

        foreach (var parameter in operation.Parameters)
        {
            ApplyParameterDocumentation(parameter);
        }
    }

    private static void ApplyRosettaDocumentation(OpenApiOperation operation, OperationFilterContext context)
    {
        switch (context.MethodInfo.Name)
        {
            case nameof(RosettaController.GetPeople):
                operation.Summary = "Search Rosetta people.";
                operation.Description = "Calls Rosetta's people endpoint with credentials supplied in request headers. BaseUrl and TokenUrl come from the server's RosettaClient configuration. Credentials are used only for this request and are not stored by this endpoint.";
                break;
            case nameof(RosettaController.GetContact):
                operation.Summary = "Get Rosetta person and contact data by IAM ID.";
                operation.Description = "Rosetta includes contact data in its people resource, so this compatibility endpoint calls Rosetta people by IAM ID. Credentials are supplied in request headers and are not stored by this endpoint.";
                break;
            case nameof(RosettaController.GetPpsAssociation):
                operation.Summary = "Search Rosetta employee associations.";
                operation.Description = "Rosetta employee associations are the closest equivalent to IAMWS PPS associations. Credentials are supplied in request headers and are not stored by this endpoint.";
                break;
            default:
                return;
        }

        foreach (var parameter in operation.Parameters)
        {
            ApplyRosettaParameterDocumentation(parameter);
        }
    }

    private static void ApplyRosettaParameterDocumentation(OpenApiParameter parameter)
    {
        switch (parameter.Name)
        {
            case RosettaController.ClientIdHeaderName:
                parameter.Description = "OAuth client ID used for this Rosetta request.";
                parameter.Required = true;
                parameter.Example = new OpenApiString("<client-id>");
                break;
            case RosettaController.ClientSecretHeaderName:
                parameter.Description = "OAuth client secret used for this Rosetta request. Sent as a header so it does not appear in the URL.";
                parameter.Required = true;
                parameter.Schema.Format = "password";
                parameter.Example = new OpenApiString("<client-secret>");
                break;
            case RosettaController.ScopesHeaderName:
                parameter.Description = "Optional space-separated OAuth scopes. When omitted, the server's configured Rosetta scope is used.";
                parameter.Example = new OpenApiString("read:public");
                break;
            case "iamId":
                parameter.Description = "IAM ID filter.";
                break;
            case "id":
                parameter.Description = "IAM ID used to retrieve Rosetta person and contact data.";
                break;
            case "email":
                parameter.Description = "Email address filter.";
                break;
            case "loginId":
                parameter.Description = "Kerberos/login ID filter.";
                break;
            case "lastName":
                parameter.Description = "Last-name filter.";
                break;
            case "department":
                parameter.Description = "UCPath department filter used by Rosetta's people endpoint.";
                break;
            case "employeeId":
                parameter.Description = "Employee ID filter.";
                break;
            case "studentId":
                parameter.Description = "Student ID filter.";
                break;
            case "ppsId":
                parameter.Description = "PPS ID filter.";
                break;
            case "jobTypeId":
                parameter.Description = "Rosetta job type ID filter.";
                break;
            case "organizationId":
                parameter.Description = "Rosetta organization ID filter.";
                break;
            case "departmentId":
                parameter.Description = "Rosetta department ID filter.";
                break;
            case "divisionId":
                parameter.Description = "Rosetta division ID filter.";
                break;
            case "subdivisionId":
                parameter.Description = "Rosetta subdivision ID filter.";
                break;
            case "subdivisionL4Id":
                parameter.Description = "Rosetta level-four subdivision ID filter.";
                break;
        }
    }

    private static void ApplyParameterDocumentation(OpenApiParameter parameter)
    {
        switch (parameter.Name)
        {
            case "X-Iamws-Key":
                parameter.Description = "Preferred location for the IAMWS key.";
                break;
            case "key":
                parameter.Description = "Legacy query-string IAMWS key. Prefer the X-Iamws-Key header for new callers. URL-encode this value when building query strings manually.";
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
