'use strict';
import * as tl from 'azure-pipelines-task-lib/task';

import * as deploymentHelper from '../utils/DeploymentHelper';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import * as utils from '../utils/utilities';
import * as TaskInputParameters from '../models/TaskInputParameters';

import { Kubectl } from 'kubernetes-common-v2/kubectl-object-model';

export async function promote(ignoreSslErrors?: boolean) {

    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);

    if (canaryDeploymentHelper.isCanaryDeploymentStrategy()) {
        tl.debug('Deploying input manifests');
        await deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, 'None');
        tl.debug('Deployment strategy selected is Canary. Deleting canary and baseline workloads.');
        try {
            canaryDeploymentHelper.deleteCanaryDeployment(kubectl, TaskInputParameters.manifests);
        } catch (ex) {
            tl.warning('Exception occurred while deleting canary and baseline workloads. Exception: ' + ex);
        }
    } else {
        tl.debug('Strategy is not canary deployment. Invalid request.');
        throw (tl.loc('InvalidPromotetActionDeploymentStrategy'));
    }
}