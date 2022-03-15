#!/bin/bash
set -e

SERVICE_NAME="employee-service"
TAG="001"
IMAGE_NAME=$SERVICE_NAME:$TAG

#create ECR repository
echo "Create ECR repo in account: $AWS_ACCOUNT, region: $AWS_REGION"
aws ecr create-repository --repository-name $SERVICE_NAME

#create docker image
cd springboot-crud
echo "build docker image: $IMAGE_NAME"
docker build --network host -t $IMAGE_NAME ./

#docker login using aws credentials
aws ecr get-login-password | docker login \
		--username AWS \
		--password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

#docker tag image
docker tag $IMAGE_NAME $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE_NAME

#docker push tagged image to ECR
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE_NAME
