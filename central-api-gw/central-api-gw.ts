import ec2 = require('aws-cdk-lib/aws-ec2');
import apigwv2 = require('@aws-cdk/aws-apigatewayv2-alpha');
import customResources = require('aws-cdk-lib/custom-resources');
import lambda = require('aws-cdk-lib/aws-lambda');
import iam = require('aws-cdk-lib/aws-iam');
import servicediscovery = require('aws-cdk-lib/aws-servicediscovery');
import { HttpServiceDiscoveryIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import cdk = require('aws-cdk-lib');
import fs = require('fs');

export interface CentralApiGatewayProps {
  serviceName: string,
  env: cdk.Environment,
  serviceNameEndpoint: string
}

export class CentralApiGateway extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: CentralApiGatewayProps) {
    super(scope, id, {
      env: props.env
    });

    const serviceName = props.serviceName;

    // Create Http API Gateway
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'central-api-gw',
      description: 'centralized http api gateway to front private backend services'
    });

    if (httpApi.url) {
      new cdk.CfnOutput(this, 'ApiGwUrl', {
        value: httpApi.url
      });
    }

    // Create VPC and VPC link
    const vpc = new ec2.Vpc(this, 'GatewayVPC', {
      maxAzs: 4,
      natGateways: 1
    });

    const vpcLink = new apigwv2.VpcLink(this, 'VpcLink', { vpc });

    // Create VPC endpoint 
    const endpointService = new ec2.InterfaceVpcEndpointService(props.serviceNameEndpoint);

    const sg = new ec2.SecurityGroup(this, 'central-vpce-sg', {
      description: 'security group for vpc endpoints',
      vpc
    })

    sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(8080));

    const vpcEndpoint = vpc.addInterfaceEndpoint(`${serviceName}-vpc-endpoint`, {
      service: endpointService,
      lookupSupportedAzs: true,
      securityGroups: [sg]
    })

    // find private IP addresses from the vpc endpoint using custom resource   
    // Create customer resource and lambda 
    const customResourceLambda = new lambda.SingletonFunction(this, 'SingletonLambdaFunction', {
      uuid: 'b21e5fec-3393-462b-b1a6-f3269153ee59',
      code: new lambda.InlineCode(fs.readFileSync('custom-resource-handler.js', { encoding: 'utf-8' })),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_14_X,
    });

    const iamInlinePolicy = new iam.PolicyStatement({
      actions: ['ec2:DescribeNetworkInterfaces'],
      effect: iam.Effect.ALLOW,
      resources: ['*']
    })

    customResourceLambda.addToRolePolicy(iamInlinePolicy);

    const provider = new customResources.Provider(this, 'Provider', {
      onEventHandler: customResourceLambda,
    });

    const inputProps = {
      vpcEndpointEniIds: vpcEndpoint.vpcEndpointNetworkInterfaceIds,
      updateTrigger: Date.now()
    }

    const customResource = new cdk.CustomResource(this, 'CustomResource', {
      serviceToken: provider.serviceToken,
      properties: inputProps,
    });

    // Grab IP addresses returned by custom resource
    const vpcEndpointIps = customResource.getAttString('VPCEndpointIps');

    new cdk.CfnOutput(this, 'VpcEndpointIps', {
      value: vpcEndpointIps
    });

    // Create Cloud Map namespace and Service
    const namespace = new servicediscovery.HttpNamespace(this, 'MyNamespace', {
      name: 'cross-account-private.services',
    });

    const employeeService = namespace.createService('EmployeeService', {
      description: `${serviceName} registering instances using ip address, health check not allowed`
    });

    const firstIp = customResource.getAttString('IP0');
    const secondIp = customResource.getAttString('IP1');

    employeeService.registerIpInstance('IpInstance1', {
      ipv4: firstIp,
      port: 8080
    });

    employeeService.registerIpInstance('IpInstance2', {
      ipv4: secondIp,
      port: 8080
    });

    // Create Cloud Map Integration
    const cloudMapIntegration = new HttpServiceDiscoveryIntegration('EmployeeServiceIntegration', employeeService, {
      vpcLink,
    });

    new apigwv2.HttpRoute(this, 'employee-service-route', {
      httpApi: httpApi,
      routeKey: apigwv2.HttpRouteKey.with('/employees', apigwv2.HttpMethod.ANY),
      integration: cloudMapIntegration
    });

    new apigwv2.HttpRoute(this, 'employee-service-route-proxy', {
      httpApi: httpApi,
      routeKey: apigwv2.HttpRouteKey.with('/employees/{proxy+}', apigwv2.HttpMethod.ANY),
      integration: cloudMapIntegration
    });
  }
}
