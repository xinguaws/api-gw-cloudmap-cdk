import cdk = require('aws-cdk-lib');

import { FargateVpcEndpointService } from './fargate';

const app = new cdk.App();

if (!process.env.AWS_ACCOUNT) {
  throw Error('AWS_ACCOUNT environment var not found');
}
if (!process.env.AWS_REGION) {
  throw Error('AWS_REGION environment var not found');
}
if (!process.env.GATEWAY_AWS_ACCOUNT) {
  throw Error('GATEWAY_AWS_ACCOUNT environment var not found');
}

const CONTAINER_PORT = 8080;
const region = process.env.AWS_REGION;
const account = process.env.AWS_ACCOUNT;
const gatewayAccount = process.env.GATEWAY_AWS_ACCOUNT;
const serviceName = 'employee-service';
const imageTag = '001';
const repositoryArn = `arn:aws:ecr:${region}:${account}:repository/${serviceName}`;
const allowedPrincipalArn = `arn:aws:iam::${gatewayAccount}:root`;

new FargateVpcEndpointService(app, 'Employee', {
  serviceName: serviceName,
  repositoryArn: repositoryArn,
  imageTag: imageTag,
  containerPort: CONTAINER_PORT,
  allowedPrincipalArn: allowedPrincipalArn
});

app.synth();
