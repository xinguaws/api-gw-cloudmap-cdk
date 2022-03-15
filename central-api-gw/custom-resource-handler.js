const AWS = require('aws-sdk');
const ec2Client = new AWS.EC2();

exports.handler = async (event, context) => {

    try {
        console.log('Received event:\n' + JSON.stringify(event, null, 2));
        console.log('Received context:\n' + JSON.stringify(context, null, 2));

        const vpcEndpointEniIds = event.ResourceProperties.vpcEndpointEniIds;
        const physicalResourceId = 'VPCEndpointIps';
        let responseData = {};

        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            console.log('Create/Update execution');
            const params = {
                NetworkInterfaceIds: vpcEndpointEniIds
            };

            const networkInterfaces = await ec2Client.describeNetworkInterfaces(params).promise();
            const ipAddresses = [];

            let i = 0;
            for (const eni of networkInterfaces.NetworkInterfaces) {
                const key = `IP${i}`;
                responseData[key] = eni.PrivateIpAddress;
                ipAddresses.push(eni.PrivateIpAddress);
                i++;
            }
            responseData[physicalResourceId] = JSON.stringify(ipAddresses);
            console.log('response data: ', responseData);
            return {
                PhysicalResourceId: physicalResourceId,
                Data: responseData
            }
        }
        else if (event.RequestType === 'Delete') {
            console.log('Delete execution');
            return {
                PhysicalResourceId: physicalResourceId,
                Data: responseData
            }
        }
        else {
            const err = `Unsupported RequestType ${event.RequestType}`;
            console.log(err);
            throw err;
        }
    } catch (err) {
        console.log('Error encountered: ', JSON.stringify(err));
        return {};
    }
};