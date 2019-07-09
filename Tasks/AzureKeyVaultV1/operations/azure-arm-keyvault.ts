import msRestAzure = require('azure-arm-rest-v2/azure-arm-common');
import azureServiceClient = require("azure-arm-rest-v2/AzureServiceClient");
import tl = require('azure-pipelines-task-lib/task');
import webClient = require("azure-arm-rest-v2/webClient");

export class AzureKeyVaultSecret {
    name: string;
    enabled: boolean;
    expires: Date;
    contentType: string;
}

export class KeyVaultClient extends azureServiceClient.ServiceClient {
    private keyVaultName;
    private keyVaultUrl;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, 
        subscriptionId: string,
        keyVaultName: string,
        keyVaultUrl: string) {

        super(credentials, subscriptionId);

        this.keyVaultName = keyVaultName;
        this.keyVaultUrl = keyVaultUrl;
        this.apiVersion = '2016-10-01';
    }

    public async invokeRequest(request: webClient.WebRequest): Promise<webClient.WebResponse> {
        try {
            var response = await this.beginRequest(request);
            if (response.statusCode == 401) {
                var vaultResourceId = this.getValidVaultResourceId(response);
                if(!!vaultResourceId) {
                    console.log(tl.loc("RetryingWithVaultResourceIdFromResponse", vaultResourceId));
                    
                    this.getCredentials().activeDirectoryResourceId = vaultResourceId; // update vault resource Id
                    this.getCredentials().getToken(true); // Refresh authorization token in cache
                    var response = await this.beginRequest(request);
                }
            }
            return response;
        } catch(exception) {
            throw exception;
        }
    }

    public getValidVaultResourceId(response: webClient.WebResponse) {
        if (!!response.headers) {
            var authenticateHeader = response.headers['www-authenticate'];
            if (!!authenticateHeader) {
                var parsedParams = authenticateHeader.split(",").map(pair => pair.split("=").map(function(item) {
                    return item.trim();
                }));

                const properties = {};
                parsedParams.forEach(([key,value]) => properties[key] = value);
                if(properties['resource']) {
                    return properties['resource'].split('"').join('');
                }
            }
        }

        return null;
    }

    public getSecrets(nextLink: string, callback: azureServiceClient.ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Create HTTP transport objects
        var url = nextLink;
        if (!url)
        {
            url = this.getRequestUriForBaseUri(
                this.keyVaultUrl,
                '/secrets',
                {},
                ['maxresults=25']);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = url;

        console.log(tl.loc("DownloadingSecretsUsing", url));
        
        this.invokeRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            var result = [];
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }
                
                if (response.body.nextLink) {
                    var nextResult = await this.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new azureServiceClient.ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);

                    var listOfSecrets = this.convertToAzureKeyVaults(result);
                    return new azureServiceClient.ApiResult(null, listOfSecrets);
                }
                else {
                    var listOfSecrets = this.convertToAzureKeyVaults(result);
                    return new azureServiceClient.ApiResult(null, listOfSecrets);
                }
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response));
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public getSecretValue(secretName: string, callback: azureServiceClient.ApiCallback) {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Create HTTP transport objects
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.getRequestUriForBaseUri(
            this.keyVaultUrl,
            '/secrets/{secretName}',
            {
                '{secretName}': secretName
            }
        );

        console.log(tl.loc("DownloadingSecretValue", secretName));
        this.invokeRequest(httpRequest).then(async (response: webClient.WebResponse) => {
            if (response.statusCode == 200) {
                var result = response.body.value;
                return new azureServiceClient.ApiResult(null, result);
            }
            else if (response.statusCode == 400) {
                return new azureServiceClient.ApiResult(tl.loc('GetSecretFailedBecauseOfInvalidCharacters', secretName));
            }
            else {
                return new azureServiceClient.ApiResult(azureServiceClient.ToError(response));
            }
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    private convertToAzureKeyVaults(result: any[]): AzureKeyVaultSecret[] {
        var listOfSecrets: AzureKeyVaultSecret[] = [];
        result.forEach((value: any, index: number) => {
            var expires;
            if (value.attributes.exp)
            {
                expires = new Date(0);
                expires.setSeconds(parseInt(value.attributes.exp));
            }

            var secretIdentifier: string = value.id;
            var lastIndex = secretIdentifier.lastIndexOf("/");
            var name: string = secretIdentifier.substr(lastIndex + 1, secretIdentifier.length);

            var azkvSecret: AzureKeyVaultSecret = {
                name: name,
                contentType: value.contentType,
                enabled: value.attributes.enabled,
                expires: expires
            };

            listOfSecrets.push(azkvSecret);
        });

        return listOfSecrets;
    }
}