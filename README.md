## Centralized API gateway to access cross-account private services through PrivateLink using VPC link and CloudMap integration

This pattern provides integration between a central AWS account and private services deployed in different AWS accounts.  
The central AWS account serves as front door which deploys an Http type of API gateway to access private 
services deployed in other AWS accounts using AWS PrivateLink. 


## Reference Architecture
Use case: To reduce blast radius, very often AWS customers deploy their production workloads to 
multiple AWS accounts, and they don't want to expose those service endpoints publicly where the load 
balancers fronting those services are internal only. For example, AWS account 222222222222 on the right
deploys an ECS Fargate service in private Subnets with an internal NLB; AWS account 333333333333 on the right
deploys an EC2 service with an internal NLB, etc.. To achieve centralized access control, we are deploying 
an API gateway into a central AWS account 111111111111 and creating private resource integration using 
VPC link with CloudMap.

![Alt text](./Archecture-Diagram.png?raw=true "Reference Architecture")
   
Here is how it works:
1. AWS account 222222222222 on the right creates a VPC endpoint service pointing to the internal NLB,
and configures a trusted principal to allow root user from AWS account 111111111111: "arn:aws:iam::111111111111:root"
to initiate a connection request which will get automatically approved. 
2. AWS account 111111111111 on the left creates a VPC endpoint to connect to the VPC endpoint service
through AWS PrivateLink. Next, Create a CloudMap namespace and service with instances registered using the 
static IP addresses associated with the VPC endpoint. Last, create a VPC link and API gateway private integration
using CloudMap. Now requests sent to Central API gateway in account 111111111111 can reach private 
service in account 222222222222 through following route:
API gateway -> VPC link with CloudMap Service discovery (Find VPC endpoint IP address) -> VPC Endpoint service (Internal NLB)

Important notes:
1. Make sure resources from AWS account 111111111111 and 222222222222 are all deployed into the same region,
because When creating an interface endpoint in your account: You can only select an Availability Zone 
that corresponds to Availability Zones enabled on the Network Load Balancer of the provider VPC
2. API gateway private integration using CloudMap doesn't support CName (DNS query) which 
points to the VPC endpoint private DNS name, so in this pattern, we are using the static IP addresses instead
3. To trouble shoot connection issues for private services deployed on the right hand side, create a 
bastion host and test those private endpoint directly.
4. Currently AWS::EC2::VPCEndpoint resource created by CloudFormation or CDK doesn't return ENI IP addresses, 
refer the open [Issue](https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/109) here. 
A custom resource lambda (using CDK custom resource [Provider Framework](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources-readme.html))
was created part of centralized API gateway CDK stack to lookup the ENI IP addresses.
5. VPC endpoint ENI IP addresses are static and won't change unless it was deleted and recreated.
6. The reason we are using HTTP type API Gateway is that only HTTP type support CloudMap integration through VPC link, 
if you prefer to use REST type, then you can replace CloudMap integration with NLB with target group targets pointing 
to the VPC endpoint IP addresses. 

## Requirements
- Create two [AWS Account](https://portal.aws.amazon.com/billing/signup?redirect_url=https%3A%2F%2Faws.amazon.com%2Fregistration-confirmation#/start). if you do not already have one and log in. The IAM user that you use must have sufficient permissions to make necessary AWS service calls and manage AWS  resources.
- AWS [CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) installed and configured
- Code repo [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) Installed
- NPM, CDK and Docker installed
- AWS account/region has CDK bootstrapped 

## Build and deploy

To build this app, you need to be in this example's root folder and there are two steps (two CDK stacks). 
- Step 1: Deploy ECS fargate service in AWS Account 222222222222
Run the following by replacing the AWS accounts and region you want to deploy the fargate service
and replace the GATEWAY_AWS_ACCOUNT using the AWS account you plan to deploy the API gateway, 
make sure to config your AWS credentials for account 222222222222:

```bash
export GATEWAY_AWS_ACCOUNT=111111111111
export AWS_ACCOUNT=222222222222
export AWS_REGION=us-west-1
cd ecs-fargate
./scripts/deploy-docker.sh
npm install
npm run build
cdk deploy --require-approval=never
```
Wait until CDK deployment complete, you need output from the stack
Employee.VpcEndpointServiceName = com.amazonaws.vpce.us-west-1.vpce-svc-xxxxxxxxxxx

- Step 2: Deploy API Gateway stack in AWS Account 111111111111
Run the following by replacing the AWS account and region, use the output from step 1 to set the value for
EMPLOYEE_SERVICE_NAME and make sure to re-config your AWS credentials for AWS account 111111111111:

```bash
export EMPLOYEE_SERVICE_NAME=com.amazonaws.vpce.us-west-1.vpce-svc-xxxxxxxxxxx
export AWS_ACCOUNT=111111111111
export AWS_REGION=us-west-1
cd central-api-gw
npm install
npm run build
cdk deploy --require-approval=never
```
Wait until CDK deployment complete, you need output from the stack for testing
Central-Api-Gateway.ApiGwUrl = https://xxxxxxxx.execute-api.us-west-1.amazonaws.com/

## Test
Use the Api gateway URL from output in above for testing with the commands below:

```bash
curl https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/employees/1
curl -X POST https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/employees -H 'Content-Type: application/json' -d '{"firstName": "John", "lastName": "Doe", "emailId": "JoneDoe@gmail.com"}'
curl https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/employees
curl https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/employees
curl -X "DELETE" https://xxxxxxx.execute-api.us-west-1.amazonaws.com/employees/1
```