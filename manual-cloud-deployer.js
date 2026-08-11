#!/usr/bin/env node

const AWS = require('aws-sdk');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');

const ec2 = new AWS.EC2({ region: 'us-east-1' });

class ManualCloudDeployer {
  constructor() {
    this.instances = [];
    this.ssh = new NodeSSH();
  }

  async discoverInstances() {
    console.log('🔍 Discovering running EC2 instances...');
    
    const params = {
      Filters: [
        {
          Name: 'instance-state-name',
          Values: ['running']
        },
        {
          Name: 'tag:Project',
          Values: ['DistSim']
        }
      ]
    };

    const result = await ec2.describeInstances(params).promise();
    
    this.instances = [];
    result.Reservations.forEach(reservation => {
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

    if (this.instances.length === 0) {
      console.log('❌ No running instances found with tag Project=DistSim');
      console.log('\nTo manually launch instances:');
      console.log('1. Go to AWS Console → EC2 → Launch Instance');
      console.log('2. Choose Ubuntu 22.04 LTS');
      console.log('3. Instance type: t3.medium');
      console.log('4. Key pair: distsim-key');
      console.log('5. Security group: Allow ports 22, 3001-3008');
      console.log('6. Add tag: Project = DistSim');
      console.log('7. Launch 4 instances');
      return false;
    }

    console.log(`✅ Found ${this.instances.length} running instances:`);
    this.instances.forEach(inst => {
      console.log(`   Node ${inst.nodeId}: ${inst.publicIp}:${inst.port} (${inst.id})`);
    });

    return true;
  }

  async setupNode(instance) {
    console.log(`🔧 Setting up Node ${instance.nodeId} (${instance.publicIp})...`);
    
    try {
      await this.ssh.connect({
        host: instance.publicIp,
        username: 'ubuntu',
        privateKey: fs.readFileSync('./distsim-key.pem')
      });

      // Check if Node.js is already installed
      const nodeCheck = await this.ssh.execCommand('node --version');
      if (!nodeCheck.stdout.includes('v18')) {
        console.log(`   Installing Node.js on Node ${instance.nodeId}...`);
        await this.ssh.execCommand('curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -');
        await this.ssh.execCommand('sudo apt-get install -y nodejs');
      }
      
      // Check if DistSim is already uploaded
      const distSimCheck = await this.ssh.execCommand('ls /home/ubuntu/distsim');
      if (distSimCheck.stderr) {
        console.log(`   Uploading DistSim code to Node ${instance.nodeId}...`);
        await this.ssh.putDirectory('./', '/home/ubuntu/distsim', {
          recursive: true,
          concurrency: 10,
          exclude: ['node_modules', '.git', '*.pem']
        });
        
        await this.ssh.execCommand('cd /home/ubuntu/distsim && npm install');
        await this.ssh.execCommand('cd /home/ubuntu/distsim && chmod +x dsim-cli.sh *.js');
      }
      
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
      
      if (byzantineConfig.includes('silent') && this.instances.length > 1) {
        config[this.instances[this.instances.length - 1].nodeId] = 'silent';
      }
      
      byzantineContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
    }

    // Upload topology to all nodes
    for (const instance of this.instances) {
      await this.ssh.connect({
        host: instance.publicIp,
        username: 'ubuntu',
        privateKey: fs.readFileSync('./distsim-key.pem')
      });

      const algoDir = this.getAlgorithmDir(algorithm);
      
      await this.ssh.execCommand(`mkdir -p /home/ubuntu/distsim/${algoDir}/framework/helper_modules`);
      
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
        privateKey: fs.readFileSync('./distsim-key.pem')
      });
      
      const result = await this.ssh.execCommand(`cd /home/ubuntu/distsim && bash dsim-cli.sh ${algorithm} start`);
      console.log(`Node ${instance.nodeId}: Started`);
      
      this.ssh.dispose();
    });
    
    await Promise.all(promises);
    console.log('✅ All nodes started');
  }

  async runTest(algorithm, values = '100,200,300') {
    console.log(`🧪 Running test on ${algorithm.toUpperCase()}...`);
    
    const controllerNode = this.instances[0];
    
    await this.ssh.connect({
      host: controllerNode.publicIp,
      username: 'ubuntu',
      privateKey: fs.readFileSync('./distsim-key.pem')
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
      privateKey: fs.readFileSync('./distsim-key.pem')
    });
    
    const result = await this.ssh.execCommand(`cd /home/ubuntu/distsim && bash dsim-cli.sh ${algorithm} verify`);
    console.log('Verification result:', result.stdout || result.stderr);
    
    this.ssh.dispose();
    return result;
  }

  async getStatus() {
    console.log('📊 Manual cloud deployment status:');
    this.instances.forEach(inst => {
      console.log(`   Node ${inst.nodeId}: ${inst.publicIp}:${inst.port} (${inst.id})`);
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const deployer = new ManualCloudDeployer();
  
  try {
    switch (args[0]) {
      case 'setup':
        const found = await deployer.discoverInstances();
        if (!found) return;
        
        for (const instance of deployer.instances) {
          await deployer.setupNode(instance);
        }
        
        console.log('🎉 Manual cloud setup complete!');
        break;
        
      case 'start':
        await deployer.discoverInstances();
        const algorithm = args[1] || 'pbft';
        const byzantineConfig = args[2] || '';
        
        await deployer.generateCloudTopology(algorithm, byzantineConfig);
        await deployer.startConsensus(algorithm);
        break;
        
      case 'test':
        await deployer.discoverInstances();
        const testAlgo = args[1] || 'pbft';
        const values = args[2] || '100,200,300';
        await deployer.runTest(testAlgo, values);
        break;
        
      case 'verify':
        await deployer.discoverInstances();
        const verifyAlgo = args[1] || 'pbft';
        await deployer.verifyConsensus(verifyAlgo);
        break;
        
      case 'status':
        await deployer.discoverInstances();
        await deployer.getStatus();
        break;
        
      default:
        console.log('Manual Cloud Deployment Usage:');
        console.log('  node manual-cloud-deployer.js setup');
        console.log('  node manual-cloud-deployer.js start <algorithm>');
        console.log('  node manual-cloud-deployer.js test <algorithm> [values]');
        console.log('  node manual-cloud-deployer.js verify <algorithm>');
        console.log('  node manual-cloud-deployer.js status');
        console.log('');
        console.log('Prerequisites:');
        console.log('1. Manually launch EC2 instances in AWS Console');
        console.log('2. Add tag: Project = DistSim');
        console.log('3. Use key pair: distsim-key');
        console.log('4. Allow ports: 22, 3001-3008');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ManualCloudDeployer;