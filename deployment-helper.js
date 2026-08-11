#!/usr/bin/env node

// Multi-Machine Deployment Helper for DistSim Framework
// Generates deployment configurations and setup scripts

const fs = require('fs');
const path = require('path');

const DEPLOYMENT_PATTERNS = {
  // Each machine runs 2 nodes (optimal for 4-8 node clusters)
  'balanced': {
    description: 'Balanced distribution - 2 nodes per machine',
    getDistribution: (nodeCount) => {
      const machineCount = Math.ceil(nodeCount / 2);
      const distribution = {};
      for (let i = 0; i < nodeCount; i++) {
        const machineId = Math.floor(i / 2);
        const machineIP = `192.168.1.${10 + machineId}`;
        if (!distribution[machineIP]) distribution[machineIP] = [];
        distribution[machineIP].push(String.fromCharCode(65 + i));
      }
      return distribution;
    }
  },
  
  // One node per machine (maximum distribution)
  'distributed': {
    description: 'Maximum distribution - 1 node per machine',
    getDistribution: (nodeCount) => {
      const distribution = {};
      for (let i = 0; i < nodeCount; i++) {
        const machineIP = `192.168.1.${10 + i}`;
        distribution[machineIP] = [String.fromCharCode(65 + i)];
      }
      return distribution;
    }
  },
  
  // Primary-backup pattern (1 primary + backups distributed)
  'primary-backup': {
    description: 'Primary-backup pattern - Primary on dedicated machine',
    getDistribution: (nodeCount) => {
      const distribution = {};
      // Primary node A on first machine
      distribution['192.168.1.10'] = ['A'];
      
      // Distribute remaining nodes
      for (let i = 1; i < nodeCount; i++) {
        const machineId = Math.floor((i - 1) / 2) + 1;
        const machineIP = `192.168.1.${10 + machineId}`;
        if (!distribution[machineIP]) distribution[machineIP] = [];
        distribution[machineIP].push(String.fromCharCode(65 + i));
      }
      return distribution;
    }
  },
  
  // Geographic simulation (nodes grouped by "regions")
  'geographic': {
    description: 'Geographic simulation - Nodes grouped by regions',
    getDistribution: (nodeCount) => {
      const distribution = {};
      const regions = [
        { name: 'us-east', baseIP: '192.168.1.10' },
        { name: 'us-west', baseIP: '192.168.1.20' },
        { name: 'europe', baseIP: '192.168.1.30' },
        { name: 'asia', baseIP: '192.168.1.40' }
      ];
      
      for (let i = 0; i < nodeCount; i++) {
        const regionIndex = i % regions.length;
        const nodeInRegion = Math.floor(i / regions.length);
        const machineIP = `${regions[regionIndex].baseIP.split('.').slice(0, 3).join('.')}.${10 + nodeInRegion}`;
        
        if (!distribution[machineIP]) distribution[machineIP] = [];
        distribution[machineIP].push(String.fromCharCode(65 + i));
      }
      return distribution;
    }
  }
};

function generateDeploymentConfig(nodeCount, pattern = 'balanced') {
  if (!DEPLOYMENT_PATTERNS[pattern]) {
    throw new Error(`Unknown deployment pattern: ${pattern}`);
  }
  
  const distribution = DEPLOYMENT_PATTERNS[pattern].getDistribution(nodeCount);
  const machines = Object.keys(distribution);
  
  console.log(`\n=== Deployment Configuration ===`);
  console.log(`Pattern: ${pattern} (${DEPLOYMENT_PATTERNS[pattern].description})`);
  console.log(`Nodes: ${nodeCount}, Machines: ${machines.length}`);
  console.log(`\nNode Distribution:`);
  
  Object.entries(distribution).forEach(([ip, nodes]) => {
    console.log(`  ${ip}: ${nodes.join(', ')} (${nodes.length} nodes)`);
  });
  
  return { distribution, machines, pattern };
}

function generateSetupScript(config, algorithm = 'pbft') {
  const { distribution, machines } = config;
  
  const setupScript = `#!/bin/bash

# Multi-Machine Setup Script for ${algorithm.toUpperCase()}
# Generated deployment configuration

set -e

# Configuration
ALGORITHM="${algorithm}"
FRAMEWORK_DIR="Dsim-\${ALGORITHM^}"
SSH_USER="\${SSH_USER:-ubuntu}"  # Default SSH user
SSH_KEY="\${SSH_KEY:-~/.ssh/id_rsa}"  # Default SSH key

# Machine and node mapping
declare -A MACHINE_NODES
${Object.entries(distribution).map(([ip, nodes]) => 
  `MACHINE_NODES["${ip}"]="${nodes.join(' ')}"`
).join('\n')}

MACHINES=(${machines.map(ip => `"${ip}"`).join(' ')})

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

log() {
    echo -e "\${GREEN}[DEPLOY]\${NC} $1"
}

warn() {
    echo -e "\${YELLOW}[WARN]\${NC} $1"
}

error() {
    echo -e "\${RED}[ERROR]\${NC} $1"
}

# Check if all machines are reachable
check_connectivity() {
    log "Checking connectivity to all machines..."
    
    for machine in "\${MACHINES[@]}"; do
        if ssh -i "\$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes "\$SSH_USER@\$machine" "echo 'Connected'" >/dev/null 2>&1; then
            log "✅ \$machine: Connected"
        else
            error "❌ \$machine: Connection failed"
            exit 1
        fi
    done
}

# Deploy framework to all machines
deploy_framework() {
    log "Deploying framework to all machines..."
    
    for machine in "\${MACHINES[@]}"; do
        log "Deploying to \$machine..."
        
        # Create remote directory
        ssh -i "\$SSH_KEY" "\$SSH_USER@\$machine" "mkdir -p ~/distsim"
        
        # Copy framework
        scp -i "\$SSH_KEY" -r "\$FRAMEWORK_DIR" "\$SSH_USER@\$machine:~/distsim/"
        
        # Copy shared files
        scp -i "\$SSH_KEY" latency-config.js "\$SSH_USER@\$machine:~/distsim/"
        
        # Install dependencies
        ssh -i "\$SSH_KEY" "\$SSH_USER@\$machine" "cd ~/distsim/\$FRAMEWORK_DIR/framework && npm install"
        
        log "✅ \$machine: Framework deployed"
    done
}

# Start nodes on respective machines
start_nodes() {
    log "Starting nodes on all machines..."
    
    for machine in "\${MACHINES[@]}"; do
        nodes=\${MACHINE_NODES[\$machine]}
        log "Starting nodes on \$machine: \$nodes"
        
        # Start nodes in background
        ssh -i "\$SSH_KEY" "\$SSH_USER@\$machine" "cd ~/distsim/\$FRAMEWORK_DIR && nohup bash dsim-cli.sh start > deploy.log 2>&1 &"
        
        sleep 2
    done
    
    # Wait for nodes to start
    sleep 10
    
    # Check status
    check_cluster_status
}

# Stop all nodes
stop_nodes() {
    log "Stopping all nodes..."
    
    for machine in "\${MACHINES[@]}"; do
        log "Stopping nodes on \$machine..."
        ssh -i "\$SSH_KEY" "\$SSH_USER@\$machine" "cd ~/distsim/\$FRAMEWORK_DIR && bash dsim-cli.sh stop" || true
    done
}

# Check cluster status
check_cluster_status() {
    log "Checking cluster status..."
    
    for machine in "\${MACHINES[@]}"; do
        nodes=\${MACHINE_NODES[\$machine]}
        echo "--- \$machine (\$nodes) ---"
        
        ssh -i "\$SSH_KEY" "\$SSH_USER@\$machine" "cd ~/distsim/\$FRAMEWORK_DIR && bash dsim-cli.sh status" || warn "Failed to get status from \$machine"
        echo ""
    done
}

# Run distributed test
run_test() {
    log "Running distributed test..."
    
    # Find primary machine (first machine with node A)
    primary_machine=""
    for machine in "\${MACHINES[@]}"; do
        nodes=\${MACHINE_NODES[\$machine]}
        if [[ "\$nodes" == *"A"* ]]; then
            primary_machine=\$machine
            break
        fi
    done
    
    if [ -z "\$primary_machine" ]; then
        error "Could not find primary machine (with node A)"
        exit 1
    fi
    
    log "Running test from primary machine: \$primary_machine"
    ssh -i "\$SSH_KEY" "\$SSH_USER@\$primary_machine" "cd ~/distsim/\$FRAMEWORK_DIR && bash dsim-cli.sh test --values 100,200,300"
    
    sleep 5
    
    # Verify consensus
    log "Verifying consensus..."
    ssh -i "\$SSH_KEY" "\$SSH_USER@\$primary_machine" "cd ~/distsim/\$FRAMEWORK_DIR && bash dsim-cli.sh verify"
}

# Show usage
usage() {
    echo "Multi-Machine Deployment Script"
    echo ""
    echo "Usage: \$0 <command>"
    echo ""
    echo "Commands:"
    echo "  check       - Check connectivity to all machines"
    echo "  deploy      - Deploy framework to all machines"
    echo "  start       - Start nodes on all machines"
    echo "  stop        - Stop all nodes"
    echo "  status      - Check cluster status"
    echo "  test        - Run distributed test"
    echo "  full        - Full deployment (deploy + start + test)"
    echo ""
    echo "Environment Variables:"
    echo "  SSH_USER    - SSH username (default: ubuntu)"
    echo "  SSH_KEY     - SSH private key path (default: ~/.ssh/id_rsa)"
    echo ""
    echo "Machine Distribution:"
${Object.entries(distribution).map(([ip, nodes]) => 
  `    echo "    ${ip}: ${nodes.join(', ')}"`
).join('\n')}
}

# Main command handling
case "\$1" in
    check)
        check_connectivity
        ;;
    deploy)
        check_connectivity
        deploy_framework
        ;;
    start)
        start_nodes
        ;;
    stop)
        stop_nodes
        ;;
    status)
        check_cluster_status
        ;;
    test)
        run_test
        ;;
    full)
        check_connectivity
        deploy_framework
        start_nodes
        run_test
        ;;
    *)
        usage
        exit 1
        ;;
esac`;

  return setupScript;
}

function generateDockerCompose(config, algorithm = 'pbft') {
  const { distribution } = config;
  
  const services = {};
  let serviceIndex = 1;
  
  Object.entries(distribution).forEach(([ip, nodes]) => {
    nodes.forEach(node => {
      const port = 3001 + (node.charCodeAt(0) - 65);
      services[`node-${node.toLowerCase()}`] = {
        build: '.',
        container_name: `distsim-${algorithm}-${node.toLowerCase()}`,
        ports: [`${port}:${port}`],
        networks: {
          distsim: {
            ipv4_address: ip.replace('192.168.1', '172.20.0')
          }
        },
        environment: [
          `NODE_ID=${node}`,
          `PORT=${port}`,
          `ALGORITHM=${algorithm.toUpperCase()}`
        ],
        volumes: [
          `./Dsim-${algorithm.charAt(0).toUpperCase() + algorithm.slice(1)}:/app`
        ],
        working_dir: '/app/framework',
        command: `node index.js ${port}`
      };
    });
  });
  
  const dockerCompose = {
    version: '3.8',
    services,
    networks: {
      distsim: {
        driver: 'bridge',
        ipam: {
          config: [{
            subnet: '172.20.0.0/16'
          }]
        }
      }
    }
  };
  
  return `# Docker Compose for ${algorithm.toUpperCase()} Multi-Container Deployment\n# Generated configuration\n\n${JSON.stringify(dockerCompose, null, 2)}`;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Multi-Machine Deployment Helper');
    console.log('');
    console.log('Usage:');
    console.log('  node deployment-helper.js <nodes> <pattern> [algorithm]');
    console.log('');
    console.log('Patterns:');
    Object.entries(DEPLOYMENT_PATTERNS).forEach(([pattern, config]) => {
      console.log(`  ${pattern}: ${config.description}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  node deployment-helper.js 6 balanced pbft');
    console.log('  node deployment-helper.js 8 distributed raft');
    console.log('  node deployment-helper.js 4 geographic hotstuff');
    process.exit(1);
  }
  
  const nodeCount = parseInt(args[0]);
  const pattern = args[1] || 'balanced';
  const algorithm = args[2] || 'pbft';
  
  if (nodeCount < 4 || nodeCount > 10) {
    console.error('Node count must be between 4 and 10');
    process.exit(1);
  }
  
  try {
    const config = generateDeploymentConfig(nodeCount, pattern);
    
    // Generate setup script
    const setupScript = generateSetupScript(config, algorithm);
    const setupFilename = `deploy-${algorithm}-${pattern}-${nodeCount}nodes.sh`;
    fs.writeFileSync(setupFilename, setupScript);
    fs.chmodSync(setupFilename, '755');
    
    // Generate Docker Compose
    const dockerCompose = generateDockerCompose(config, algorithm);
    const dockerFilename = `docker-compose-${algorithm}-${pattern}.yml`;
    fs.writeFileSync(dockerFilename, dockerCompose);
    
    console.log(`\n=== Generated Files ===`);
    console.log(`✅ Setup script: ${setupFilename}`);
    console.log(`✅ Docker Compose: ${dockerFilename}`);
    
    console.log(`\n=== Next Steps ===`);
    console.log(`1. Update topology: bash dsim-cli.sh topology ${nodeCount} full --deployment=multi-machine`);
    console.log(`2. Deploy: bash ${setupFilename} full`);
    console.log(`3. Or use Docker: docker-compose -f ${dockerFilename} up`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = {
  DEPLOYMENT_PATTERNS,
  generateDeploymentConfig,
  generateSetupScript,
  generateDockerCompose
};