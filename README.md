# SIR Media Upload

Media upload web app for Smart Incident Reporting

## Foundry connection POC

After a photo passes the malware and image conversion checks, the POC checks access to the central Foundry project by listing deployments. It does not analyse photos or verify model-inference permissions. Failures are logged without blocking uploads. Existing APIM Content Safety checks are unchanged.

Set this environment variable to enable the check:

```env
AZURE_AI_PROJECT_ENDPOINT=https://defra-foundry-dev.services.ai.azure.com/api/projects/DEVFAISIRPRJ1401
```

Authentication uses `DefaultAzureCredential` with scope `https://ai.azure.com/.default`. In DEV/TST, enable the App Service managed identity with project access. Set `AZURE_CLIENT_ID` only for a user-assigned identity. Locally, install Azure CLI and run `az login` with an account that has project access; this does not test the App Service identity. No API key or deployment-name setting is needed.

Console logs show the image type and size, connection attempt and first page of deployments. Failure logs exclude HTTP request headers and tokens. Images are not sent to Foundry.

## License

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

>Contains public sector information licensed under the Open Government Licence v3.0.

### About the license

The Open Government Licence (OGL) v3.0 was developed by the The National Archives to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
