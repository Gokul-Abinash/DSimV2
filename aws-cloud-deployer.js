#!/usr/bin/env node

const AWS = require('aws-sdk');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

// AWS Configuration
const ec2 = new AWS.EC2({ region: 'ap-southeast-1' });

const CONFIG = {
  instanceType: 't3.medium',
  ami: 'ami-0df7a207adb9748c7', // Ubuntu 22.04 LTS for ap-southeast-1
  keyName: 'distsim-key',
  securityGroupName: 'distsim-sg',
  region: 'ap-southeast-1'
};

class CloudDeployer {
  constructor() {
    this.instances = [];
    this.ssh = new NodeSSH();
  }

  async createSecurityGroup() {
    try {
      const params = {
        GroupName: CONFIG.securityGroupName,
        Description: 'DistSim Consensus Network Security Group'
      };
      
      const result = await ec2.createSecurityGroup(params).promise();
      const groupId = result.GroupId;
      
      // Add inbound rules
      const authParams = {
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: 'tcp',
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: '0.0.0.0/0' }]
          },
          {
            IpProtocol: 'tcp',
            FromPort: 3001,
            ToPort: 3008,
            IpRanges: [{ CidrIp: '0.0.0.0/0' }]
          }
        ]
      };
      
      await ec2.authorizeSecurityGroupIngress(authParams).promise();
      console.log(`✅ Security group created: ${groupId}`);
      return groupId;
      
    } catch (error) {
      if (error.code === 'InvalidGroup.Duplicate') {
        console.log('📋 Security group already exists');
        const groups = await ec2.describeSecurityGroups({
          GroupNames: [CONFIG.securityGroupName]
        }).promise();
        return groups.SecurityGroups[0].GroupId;
      }
      throw error;
    }
  }

  async launchInstances(nodeCount) {
    console.log(`🚀 Launching ${nodeCount} EC2 instances...`);
    
    const securityGroupId = await this.createSecurityGroup();
    
    const params = {
      ImageId: CONFIG.ami,
      InstanceType: CONFIG.instanceType,
      KeyName: CONFIG.keyName,
      SecurityGroupIds: [securityGroupId],
      MinCount: nodeCount,
      MaxCount: nodeCount,
      TagSpecifications: [{
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: 'DistSim-Node' },
          { Key: 'Project', Value: 'DistSim' }
        ]
      }]
    };

    const result = await ec2.runInstances(params).promise();
    const instanceIds = result.Instances.map(i => i.InstanceId);
    
    console.log(`⏳ Waiting for instances to be running...`);
    await ec2.waitFor('instanceRunning', { InstanceIds: instanceIds }).promise();
    
    // Get instance details
    const instanceData = await ec2.describeInstances({ InstanceIds: instanceIds }).promise();
    
    this.instances = [];
    instanceData.Reservations.forEach(reservation => {
      reservation.Instances.forEach((instance, index) => {
        this.instances.push({
          id: instance.InstanceId,
          publicIp: instance.PublicIpAddress,
          privateIp: instance.PrivateIpAddress,
          nodeId: String.fromCharCode(65 + index), // A, B, C, D...
          port: 3001 + index
        });
      });
    });

    console.log('✅ Instances launched:');
    this.instances.forEach(inst => {
      console.log(`   Node ${inst.nodeId}: ${inst.publicIp}:${inst.port}`);
    });

    return this.instances;
  }

  async setupNode(instance) {
    console.log(`🔧 Setting up Node ${instance.nodeId} (${instance.publicIp})...`);
    
    try {
      await this.ssh.connect({
        host: instance.publicIp,
        username: 'ubuntu',
        privateKey: fs.readFileSync(path.expanduser('~/.ssh/distsim-key.pem'))
      });

      // Install Node.js and dependencies
      await this.ssh.execCommand('curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -');
      await this.ssh.execCommand('sudo apt-get install -y nodejs git');
      
      // Upload DistSim code
      await this.ssh.putDirectory('./sim2', '/home/ubuntu/distsim', {
        recursive: true,
        concurrency: 10
      });
      
      // Install npm dependencies
      await this.ssh.execCommand('cd /home/ubuntu/distsim && npm install');
      
      // Make scripts executable
      await this.ssh.execCommand('cd /home/ubuntu/distsim && chmod +x dsim-cli.sh *.js');
      
      console.log(`✅ Node ${instance.nodeId} setup complete`);
      
    } catch (error) {
      console.error(`❌ Failed to setup Node ${instance.nodeId}:`, error.message);
      throw error;
    } finally {
      this.ssh.dispose();
    }
  }

  async generateCloudTopology(algorithm, byzantineConfig = '') {
    console.log('📋 Generating cloud topology...');
    
    // Generate graph.js with real IPs
    const nodeIPs = this.instances.map(inst => ({
      [inst.nodeId]: {
        ip: inst.publicIp,
        port: inst.port
      }
    }));

    const graphContent = `
// Auto-generated cloud topology
const nodeIPsArray = ${JSON.stringify(nodeIPs, null, 2)};

module.exports = {
  nodeIPsArray
};
`;

    // Generate Byzantine config if needed
    let byzantineContent = '';
    if (byzantineConfig && ['pbft', 'sbft', 'hotstuff', 'prime'].includes(algorithm)) {
      const config = {};
      this.instances.forEach(inst => {
        config[inst.nodeId] = 'honest';
      });
      
      // Apply Byzantine behavior (simple: make last node Byzantine)
      if (byzantineConfig.includes('silent')) {
        config[this.instances[this.instances.length - 1].nodeId] = 'silent';
      }
      
      byzantineContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
    }

    // Upload topology to all nodes
    for (const instance of this.instances) {
      await this.ssh.connect({
        host: instance.publicIp,
        username: 'ubuntu',
        privateKey: fs.readFileSync(path.expanduser('~/.ssh/distsim-key.pem'))
      });

      const algoDir = this.getAlgorithmDir(algorithm);
      
      // Upload graph.js
      await this.ssh.putFile(
        Buffer.from(graphContent),
        `/home/ubuntu/distsim/${algoDir}/framework/helper_modules/graph.js`
      );
      
      // Upload Byzantine config if needed
      if (byzantineContent) {
        await this.ssh.putFile(
          Buffer.from(byzantineContent),
          `/home/ubuntu/distsim/${algoDir}/framework/byzantine-config.js`
        );
      }
      
      this.ssh.dispose();
    }
    
    console.log('✅ Cloud topology deployed to all nodes');
  }

  getAlgorithmDir(algorithm) {
    const dirMap = {
      'pbft': 'Dsim-PBFT',
      'sbft': 'Dsim-SBFT',
      'raft': 'Dsim-Raft',
      'paxos': 'Dsim-Paxos',
      'hotstuff': 'Dsim-HotStuff',
      'prime': 'Dsim-Prime'
    };
    return dirMap[algorithm] || 'Dsim-PBFT';
  }

  async startConsensus(algorithm) {
    console.log(`🎯 Starting ${algorithm.toUpperCase()} consensus on all nodes...`);
    
    const promises = this.instances.map(async (instance) => {
      await this.ssh.connect({
        host: instance.publicIp,
        username: 'ubuntu',
        privateKey: fs.readFileSync(path.expanduser('~/.ssh/distsim-key.pem'))
      });
      
      const result = await this.ssh.execCommand(`cd /home/ubuntu/distsim && bash dsim-cli.sh ${algorithm} start`);
      console.log(`Node ${instance.nodeId}: ${result.stdout || result.stderr}`);
      
      this.ssh.dispose();
    });
    
    await Promise.all(promises);
    console.log('✅ All nodes started');
  }

  async runTest(algorithm, values = '100,200,300') {
    console.log(`🧪 Running test on ${algorithm.toUpperCase()}...`);
    
    // Run test from first node (controller)
    const controllerNode = this.instances[0];
    
    await this.ssh.connect({
      host: controllerNode.publicIp,
      username: 'ubuntu',
      privateKey: fs.readFileSync(path.expanduser('~/.ssh/distsim-key.pem'))
    });
    
    const result = await this.ssh.execCommand(`cd /home/ubuntu/distsim && bash dsim-cli.sh ${algorithm} test --values ${values}`);
    console.log('Test output:', result.stdout || result.stderr);
    
    this.ssh.dispose();
    return result;
  }

  async verifyConsensus(algorithm) {
    console.log(`✅ Verifying ${algorithm.toUpperCase()} consensus...`);
    
    const controllerNode = this.instances[0];
    
    await this.ssh.connect({
      host: controllerNode.publicIp,
      username: 'ubuntu',
      privateKey: fs.readFileSync(path.expanduser('~/.ssh/distsim-key.pem'))
    });
    
    const result = await this.ssh.execCommand(`cd /home/ubuntu/distsim && bash dsim-cli.sh ${algorithm} verify`);
    console.log('Verification result:', result.stdout || result.stderr);
    
    this.ssh.dispose();
    return result;
  }

  async cleanup() {
    console.log('🧹 Cleaning up AWS resources...');
    
    if (this.instances.length > 0) {
      const instanceIds = this.instances.map(i => i.id);
      await ec2.terminateInstances({ InstanceIds: instanceIds }).promise();
      console.log('✅ All instances terminated');
    }
  }

  async getStatus() {
    console.log('📊 Cloud deployment status:');
    this.instances.forEach(inst => {
      console.log(`   Node ${inst.nodeId}: ${inst.publicIp}:${inst.port}`);
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const deployer = new CloudDeployer();
  
  try {
    switch (args[0]) {
      case 'deploy':
        const nodeCount = parseInt(args[1]) || 4;
        await deployer.launchInstances(nodeCount);
        
        // Setup all nodes
        for (const instance of deployer.instances) {
          await deployer.setupNode(instance);
        }
        
        console.log('🎉 Cloud deployment complete!');
        break;
        
      case 'start':
        const algorithm = args[1] || 'pbft';
        const byzantineConfig = args[2] || '';
        
        // Load existing instances (you'd need to implement instance discovery)
        await deployer.generateCloudTopology(algorithm, byzantineConfig);
        await deployer.startConsensus(algorithm);
        break;
        
      case 'test':
        const testAlgo = args[1] || 'pbft';
        const values = args[2] || '100,200,300';
        await deployer.runTest(testAlgo, values);
        break;
        
      case 'verify':
        const verifyAlgo = args[1] || 'pbft';
        await deployer.verifyConsensus(verifyAlgo);
        break;
        
      case 'status':
        await deployer.getStatus();
        break;
        
      case 'cleanup':
        await deployer.cleanup();
        break;
        
      default:
        console.log('Usage:');
        console.log('  node aws-cloud-deployer.js deploy [nodeCount]');
        console.log('  node aws-cloud-deployer.js start <algorithm> [byzantineConfig]');
        console.log('  node aws-cloud-deployer.js test <algorithm> [values]');
        console.log('  node aws-cloud-deployer.js verify <algorithm>');
        console.log('  node aws-cloud-deployer.js status');
        console.log('  node aws-cloud-deployer.js cleanup');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CloudDeployer;