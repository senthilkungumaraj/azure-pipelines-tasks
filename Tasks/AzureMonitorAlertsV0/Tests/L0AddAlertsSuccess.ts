import * as path from "path";
import * as mocks from "./L0Mocks";
import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";
var nock = require("nock");

let tmr: TaskMockRunner = new TaskMockRunner(path.join(__dirname, '..', 'azuremonitoralerts.js'));

tmr.setInput("ConnectedServiceName", "azureRMSpn");
tmr.setInput("ResourceGroupName", "testRg");
tmr.setInput("ResourceType", "testResource.provider/type");
tmr.setInput("ResourceName", "testResourceName");
tmr.setInput("AlertRules", JSON.stringify(mocks.mockAlertRules));

nock("https://login.windows.net", {
	reqheaders: {
		"content-type": "application/x-www-form-urlencoded; charset=utf-8"
		}
})
.post("/tenantId/oauth2/token/")
.reply(200, { 
	access_token: "accessToken"
}).persist(); 
	

nock("http://example.com", {
		reqheaders: {
        	'authorization': 'Bearer accessToken',
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.get(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/*/)
	.query({"api-version": "2016-03-01"})
	.reply(404)
	.persist();

nock("http://example.com", {
		reqheaders: {
        	"authorization": "Bearer accessToken",
        	"content-type": "application/json; charset=utf-8",
    		"user-agent": "TFS_useragent"
      	}
	})
	.get("/subscriptions/sId/resources?$filter=resourceType%20EQ%20%27testResource.provider%2Ftype%27%20AND%20name%20EQ%20%27testResourceName%27&api-version=2016-07-01")
	.reply(200, {
		value: [{ 
			id: "id",
			name: "myRule",
			location: "testlocation"
		}]
	})
	.persist();


console.log(mocks.getMetricRequestBody("Rule1", "testlocation", "GreaterThan", "metric1", "20", "PT5M"));
nock("http://example.com", {
		reqheaders: {
        	"authorization": "Bearer accessToken",
        	"content-type": "application/json; charset=utf-8",
    		"user-agent": "TFS_useragent"
      	}
	})
	.put(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule1/, mocks.getMetricRequestBody("Rule1", "testlocation", "GreaterThan", "metric1", "20", "PT5M"))
	.query({
		"api-version": "2016-03-01"
	})
	.reply(201);

console.log(mocks.getMetricRequestBody("Rule2", "testlocation", "LessThanOrEqual", "metric2", "10", "PT10M"));

nock("http://example.com", {
		reqheaders: {
        	"authorization": "Bearer accessToken",
        	"content-type": "application/json; charset=utf-8",
    		"user-agent": "TFS_useragent"
      	}
	})
	.put(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule2/, mocks.getMetricRequestBody("Rule2", "testlocation", "LessThanOrEqual", "metric2", "10", "PT10M"))
	.query({
		"api-version": "2016-03-01"
	})
	.reply(201);
tmr.run();
