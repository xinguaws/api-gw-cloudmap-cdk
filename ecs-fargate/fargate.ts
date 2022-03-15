import ec2 = require('aws-cdk-lib/aws-ec2');
import ecs = require('aws-cdk-lib/aws-ecs');
import ecr = require('aws-cdk-lib/aws-ecr');
import ecs_patterns = require('aws-cdk-lib/aws-ecs-patterns');
import iam = require('aws-cdk-lib/aws-iam');
import cdk = require('aws-cdk-lib');
export interface FargateVpcEndpointServiceProps {
  serviceName: string,
  repositoryArn: string,
  imageTag: string,
  containerPort: number,
  allowedPrincipalArn: string
}

export class FargateVpcEndpointService extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: FargateVpcEndpointServiceProps) {
    super(scope, id);

    // Create VPC and Fargate Cluster
    const vpc = new ec2.Vpc(this, 'FargateServiceVpc', {
      maxAzs: 2,
      natGateways: 1
    });
    const cluster = new ecs.Cluster(this, 'FargateCluster', { vpc });

    const ecrRepo = ecr.Repository.fromRepositoryArn(this, 'EcrRepository', props.repositoryArn);

    const taskImageOptions = {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, props.imageTag),
      containerPort: props.containerPort,
      enableLogging: true,
      containerName: props.serviceName
    }

    // Create Fargate Service
    const fargateService = new ecs_patterns.NetworkLoadBalancedFargateService(this, 'FargateService', {
      cluster,
      taskImageOptions: taskImageOptions,
      publicLoadBalancer: false,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 2,
      listenerPort: props.containerPort
    });

    // Create VPC endpoint service 
    const portProps = {
      protocol: ec2.Protocol.TCP,
      fromPort: props.containerPort,
      toPort: props.containerPort,
      stringRepresentation: `Allow inbound to port ${props.containerPort}`
    }
    const port = new ec2.Port(portProps);

    fargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      port
    );

    const iamPrincipal = new iam.ArnPrincipal(props.allowedPrincipalArn);
    const vpcEndpointService = new ec2.VpcEndpointService(this, 'VpcEndpointService', {
      vpcEndpointServiceLoadBalancers: [fargateService.loadBalancer],
      acceptanceRequired: false,
      allowedPrincipals: [iamPrincipal]
    });

    new cdk.CfnOutput(this, 'VpcEndpointServiceName', {
      value: vpcEndpointService.vpcEndpointServiceName
    });
  }
}
