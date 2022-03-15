import cdk = require('aws-cdk-lib');
import { CentralApiGateway } from './central-api-gw';

const app = new cdk.App();

if (!process.env.AWS_ACCOUNT) {
  throw Error('AWS_ACCOUNT environment var not found');
}
if (!process.env.AWS_REGION) {
  throw Error('AWS_REGION environment var not found');
}

const env = {
  account: process.env.AWS_ACCOUNT,
  region: process.env.AWS_REGION
};

if (!process.env.EMPLOYEE_SERVICE_NAME) {
  throw Error('EMPLOYEE_SERVICE_NAME environment var not found');
}

const centralApiGatewayProps = {
  env,
  serviceName: 'employee-service',
  serviceNameEndpoint: process.env.EMPLOYEE_SERVICE_NAME
}

new CentralApiGateway(app, 'Central-Api-Gateway', centralApiGatewayProps);
app.synth();
