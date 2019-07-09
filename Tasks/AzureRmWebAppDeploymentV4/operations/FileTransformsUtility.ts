import tl = require('azure-pipelines-task-lib/task');
import { TaskParameters } from './TaskParameters';
import { parse } from 'webdeployment-common-v2/ParameterParserUtility';
var deployUtility = require('webdeployment-common-v2/utility.js');
var fileTransformationsUtility = require('webdeployment-common-v2/fileTransformationsUtility.js');
var generateWebConfigUtil = require('webdeployment-common-v2/webconfigutil.js');

export class FileTransformsUtility {

    private static rootDirectoryPath: string = "D:\\home\\site\\wwwroot";
    public static async applyTransformations(webPackage: string, taskParams: TaskParameters): Promise<string> {
        tl.debug("WebConfigParameters is "+ taskParams.WebConfigParameters);
        var applyFileTransformFlag = taskParams.JSONFiles.length != 0 || taskParams.XmlTransformation || taskParams.XmlVariableSubstitution;
        if (applyFileTransformFlag || taskParams.WebConfigParameters) {
            var isFolderBasedDeployment: boolean = tl.stats(webPackage).isDirectory();
            var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, webPackage, taskParams.Package.getPackageType());
            if (taskParams.WebConfigParameters) {
                tl.debug('parsing web.config parameters');
                var webConfigParameters = parse(taskParams.WebConfigParameters);
                generateWebConfigUtil.addWebConfigFile(folderPath, webConfigParameters, this.rootDirectoryPath);
            }

            if (applyFileTransformFlag) {
                var isMSBuildPackage = !isFolderBasedDeployment && (await deployUtility.isMSDeployPackage(webPackage));
                fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, taskParams.JSONFiles, taskParams.XmlTransformation, taskParams.XmlVariableSubstitution, folderPath, isMSBuildPackage);
            }

            var output = await deployUtility.archiveFolderForDeployment(isFolderBasedDeployment, folderPath);
            webPackage = output.webDeployPkg;
        }
        else {
            tl.debug('File Tranformation not enabled');
        }

        return webPackage;
    }
}