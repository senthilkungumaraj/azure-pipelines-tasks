import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';
import * as utils from './utils/FileHelper';
import * as kubectlutility from 'kubernetes-common-v2/kubectlutility';

export class Connection {
    public ignoreSSLErrors: boolean;

    public open() {
        let kubeconfig: string;
        let kubeconfigFile: string;
        const kubernetesServiceConnection = tl.getInput('kubernetesServiceConnection', true);
        const authorizationType = tl.getEndpointDataParameter(kubernetesServiceConnection, 'authorizationType', true);

        if (!authorizationType || authorizationType === 'Kubeconfig') {
            kubeconfig = kubectlutility.getKubeconfigForCluster(kubernetesServiceConnection);
        } else if (authorizationType === 'ServiceAccount' || authorizationType === 'AzureSubscription') {
            kubeconfig = kubectlutility.createKubeconfig(kubernetesServiceConnection);
        }

        kubeconfigFile = path.join(utils.getNewUserDirPath(), 'config');
        fs.writeFileSync(kubeconfigFile, kubeconfig);
        tl.setVariable('KUBECONFIG', kubeconfigFile);
        this.ignoreSSLErrors = tl.getEndpointDataParameter(kubernetesServiceConnection, 'acceptUntrustedCerts', true) === 'true';
    }

    public close() {
        if (tl.getVariable('KUBECONFIG')) {
            tl.setVariable('KUBECONFIG', '');
        }
    }
}
