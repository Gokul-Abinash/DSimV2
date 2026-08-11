#!/usr/bin/env node

// Dynamic Network Topology Configuration
// Usage: node topology-config.js <nodes> <topology> [output_dir]

const fs = require('fs');
const path = require('path');

const nodeCount = parseInt(process.argv[2]) || 4;
if (nodeCount > 100) {
  throw new Error('Maximum 100 nodes supported');
}
const topology = process.argv[3] || 'full';
const byzantineArg = process.argv.find(arg => arg.startsWith('--byzantine')); // --byzantine silent:1,corrupt:1,delay:1
const crashArg = process.argv.find(arg => arg.startsWith('--crash')); // --crash crash:2
const deploymentArg = process.argv.find(arg => arg.startsWith('--deployment')); // --deployment multi-machine
const outputDir = process.argv[5] || '.';

// Parse Byzantine configuration
function parseByzantineConfig(byzantineArg) {
  const config = { silent: 0, corrupt: 0, delay: 0, random: 0 };
  
  if (!byzantineArg || !byzantineArg.startsWith('--byzantine')) return config;
  
  const configStr = byzantineArg.replace('--byzantine', '').replace('=', '').trim();
  if (!configStr) return config;
  
  // Handle both formats: silent:1,corrupt:1 or silent=1,corrupt=1
  const pairs = configStr.split(',');
  for (const pair of pairs) {
    const parts = pair.includes(':') ? pair.split(':') : pair.split('=');
    const [behavior, count] = parts;
    if (behavior && count) {
      config[behavior.trim()] = parseInt(count.trim()) || 0;
    }
  }
  
  return config;
}

// Parse Crash configuration
function parseCrashConfig(crashArg) {
  const config = { crash: 0 };
  
  if (!crashArg || !crashArg.startsWith('--crash')) return config;
  
  const configStr = crashArg.replace('--crash', '').replace('=', '').trim();
  if (!configStr) return config;
  
  // Handle both formats: crash:2 or crash=2
  const pairs = configStr.split(',');
  for (const pair of pairs) {
    const parts = pair.includes(':') ? pair.split(':') : pair.split('=');
    const [behavior, count] = parts;
    if (behavior && count && behavior.trim() === 'crash') {
      config.crash = parseInt(count.trim()) || 0;
    }
  }
  
  return config;
}

// Validate Byzantine configuration
function validateByzantineConfig(nodeCount, config, algorithm = 'pbft') {
  const totalByzantine = config.silent + config.corrupt + config.delay + config.random;
  
  const maxByzantine = {
    'pbft': Math.floor((nodeCount - 1) / 3),
    'sbft': Math.floor((nodeCount - 1) / 3),
    'hotstuff': Math.floor((nodeCount - 1) / 3),
    'raft': 0,  // No Byzantine tolerance
    'paxos': 0  // No Byzantine tolerance
  };
  
  if (totalByzantine > maxByzantine[algorithm]) {
    throw new Error(`Too many Byzantine nodes: ${totalByzantine} > ${maxByzantine[algorithm]} (max for ${algorithm})`);
  }
  
  if (totalByzantine >= nodeCount) {
    throw new Error(`Byzantine nodes (${totalByzantine}) must be less than total nodes (${nodeCount})`);
  }
  
  return true;
}

// Validate Crash configuration
function validateCrashConfig(nodeCount, config, algorithm = 'raft') {
  const totalCrash = config.crash;
  
  const maxCrash = {
    'pbft': 0,     // Use Byzantine failures instead
    'sbft': 0,     // Use Byzantine failures instead
    'hotstuff': 0, // Use Byzantine failures instead
    'raft': Math.floor((nodeCount - 1) / 2),  // f < n/2
    'paxos': Math.floor((nodeCount - 1) / 2)  // f < n/2
  };
  
  if (totalCrash > maxCrash[algorithm]) {
    throw new Error(`Too many crash nodes: ${totalCrash} > ${maxCrash[algorithm]} (max for ${algorithm})`);
  }
  
  if (totalCrash >= nodeCount) {
    throw new Error(`Crash nodes (${totalCrash}) must be less than total nodes (${nodeCount})`);
  }
  
  return true;
}

// Assign Byzantine behaviors to nodes randomly
function assignByzantineBehaviors(nodeIDs, config) {
  const assignments = {};
  const availableNodes = [...nodeIDs]; // Copy array
  
  // Shuffle available nodes to randomize assignment
  for (let i = availableNodes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableNodes[i], availableNodes[j]] = [availableNodes[j], availableNodes[i]];
  }
  
  let nodeIndex = 0;
  
  // Assign behaviors randomly
  for (const [behavior, count] of Object.entries(config)) {
    if (behavior === 'honest') continue;
    
    for (let i = 0; i < count; i++) {
      if (nodeIndex < availableNodes.length) {
        assignments[availableNodes[nodeIndex++]] = behavior;
      }
    }
  }
  
  // Remaining nodes are honest
  while (nodeIndex < availableNodes.length) {
    assignments[availableNodes[nodeIndex++]] = 'honest';
  }
  
  // Ensure all original nodes have assignments
  nodeIDs.forEach(nodeId => {
    if (!assignments[nodeId]) {
      assignments[nodeId] = 'honest';
    }
  });
  
  return assignments;
}

// Assign crash behaviors to nodes randomly
function assignCrashBehaviors(nodeIDs, config) {
  const assignments = {};
  const availableNodes = [...nodeIDs]; // Copy array
  
  // Shuffle available nodes to randomize assignment
  for (let i = availableNodes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableNodes[i], availableNodes[j]] = [availableNodes[j], availableNodes[i]];
  }
  
  let nodeIndex = 0;
  
  // Assign crash behavior
  for (let i = 0; i < config.crash; i++) {
    if (nodeIndex < availableNodes.length) {
      assignments[availableNodes[nodeIndex++]] = 'crash';
    }
  }
  
  // Remaining nodes are honest
  while (nodeIndex < availableNodes.length) {
    assignments[availableNodes[nodeIndex++]] = 'honest';
  }
  
  // Ensure all original nodes have assignments
  nodeIDs.forEach(nodeId => {
    if (!assignments[nodeId]) {
      assignments[nodeId] = 'honest';
    }
  });
  
  return assignments;
}

// Generate node IDs (Node1, Node2, Node3, ...)
function generateNodeIDs(count) {
  const nodes = [];
  for (let i = 1; i <= count; i++) {
    nodes.push(`Node${i}`);
  }
  return nodes;
}

// Generate topology edges based on type
function generateTopology(nodes, type) {
  const edges = [];
  
  switch (type) {
    case 'full':
      // Fully connected mesh
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          edges.push([nodes[i], nodes[j]]);
        }
      }
      break;
      
    case 'ring':
      // Ring topology
      for (let i = 0; i < nodes.length; i++) {
        const next = (i + 1) % nodes.length;
        edges.push([nodes[i], nodes[next]]);
      }
      break;
      
    case 'star':
      // Star topology (A is center)
      for (let i = 1; i < nodes.length; i++) {
        edges.push([nodes[0], nodes[i]]);
      }
      break;
      
    case 'line':
      // Linear chain
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push([nodes[i], nodes[i + 1]]);
      }
      break;
      
    default:
      throw new Error(`Unknown topology: ${type}`);
  }
  
  return edges;
}

// Multi-machine deployment configurations
const DEPLOYMENT_CONFIGS = {
  'localhost': {
    baseIP: '127.0.0.1',
    description: 'All nodes on localhost (development/testing)'
  },
  'multi-machine': {
    baseIP: '192.168.1.{10+i}', // Template for IP generation
    description: 'Distributed across multiple machines (production)'
  },
  'docker': {
    baseIP: '172.20.0.{10+i}', // Docker network range
    description: 'Docker container deployment'
  },
  'cloud': {
    baseIP: '10.0.{i/4}.{10+(i%4)}', // Cloud subnet distribution
    description: 'Cloud deployment with subnet distribution'
  }
};

// Generate IP address based on deployment type
function generateNodeIP(nodeIndex, deploymentType = 'localhost') {
  const config = DEPLOYMENT_CONFIGS[deploymentType];
  if (!config) return '127.0.0.1';
  
  if (deploymentType === 'localhost') {
    return '127.0.0.1';
  } else if (deploymentType === 'multi-machine') {
    return `192.168.1.${10 + nodeIndex}`;
  } else if (deploymentType === 'docker') {
    return `172.20.0.${10 + nodeIndex}`;
  } else if (deploymentType === 'cloud') {
    const subnet = Math.floor(nodeIndex / 4);
    const host = 10 + (nodeIndex % 4);
    return `10.0.${subnet}.${host}`;
  }
  
  return '127.0.0.1';
}

// Generate graph.js content
function generateGraphJS(nodes, edges, deploymentType = 'localhost') {
  const nodeSetup = nodes.map(node => `graph.setNode('${node}');`).join('\n');
  const edgeSetup = edges.map(([a, b]) => `graph.setEdge('${a}', '${b}');`).join('\n');
  
  const nodeIPsArray = nodes.map((node, i) => {
    const port = 3001 + i;
    const isSource = i === 0;
    const ip = generateNodeIP(i, deploymentType);
    return `  { '${node}': { ip: "${ip}", port: ${port}, source: ${isSource} } }`;
  }).join(',\n');

  return `const graphlib = require('graphlib');
const os = require('os');

// Graph constructor
const { Graph } = graphlib;
// Undirected graph
const graph = new Graph({ directed: false });

// Auto-generated topology: ${nodeCount} nodes, ${topology} topology
// Deployment: ${deploymentType} (${DEPLOYMENT_CONFIGS[deploymentType]?.description || 'localhost'})

// Nodes
${nodeSetup}

// Edges
${edgeSetup}

// Node metadata with IP and Port
const nodeIPsArray = [
${nodeIPsArray}
];

// Assign metadata
nodeIPsArray.forEach(nodeObj => {
  const nodeName = Object.keys(nodeObj)[0];
  const { ip, port, source } = nodeObj[nodeName];
  graph.setNode(nodeName, { ip, port, source });
});

// Get neighbor IPs and ports
function getNeighborIPPort(nodeName) {
  if (!nodeName || nodeName === -1) {
    console.warn('Please check the node name passed to getNeighborIPPort');
    return 'Please check the node name passed';
  }

  const neighbors = graph.neighbors(nodeName);

  if (!neighbors || neighbors.length === 0) {
    return \`Node \${nodeName} has no neighbors.\`;
  }

  let IPArray = [];
  let PortArray = [];

  neighbors.forEach(neighbor => {
    const neighborData = graph.node(neighbor);
    if (neighborData) {
      IPArray.push(neighborData.ip);
      PortArray.push(neighborData.port);
    } else {
      console.warn(\`No metadata found for neighbor node \${neighbor}\`);
    }
  });

  return { IPArray, PortArray };
}

// Check if IP belongs to a node
function isIPBelongToNode(ipAddress) {
  const nodes = graph.nodes();
  for (const node of nodes) {
    const nodeIP = graph.node(node).ip;
    if (nodeIP === ipAddress) {
      return node;
    }
  }
  return -1;
}

// Get local IPv4 address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

// Find node by local IP
function findCurrentNode() {
  const myIP = getLocalIP();
  for (const node of graph.nodes()) {
    if (graph.node(node).ip === myIP) {
      return node;
    }
  }
  return "check your ip current address matching ip in graph node";
}

// Find node by port (coerces port to number)
function findCurrentNodeByPORT(PORT) {
  if (typeof PORT === 'string') PORT = Number(PORT);

  for (const node of graph.nodes()) {
    const nodePort = graph.node(node).port;
    if (Number(nodePort) === PORT) {
      return node;
    }
  }
  return "check your ip current address matching ip in graph node";
}

module.exports = {
  nodeIPsArray,
  graph,
  getNeighborIPPort,
  isIPBelongToNode,
  getLocalIP,
  findCurrentNode,
  findCurrentNodeByPORT
};`;
}

// Generate MIS-specific CLI script content
function generateMISCLI(nodes, algorithm) {
  const ports = nodes.map((_, i) => 3001 + i);
  const portsArray = `(${ports.join(' ')})`;
  
  return `#!/bin/bash

# Auto-generated CLI for ${nodeCount} nodes, ${topology} topology
# Algorithm: ${algorithm.toUpperCase()}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=${portsArray}
PID_DIR="$FRAMEWORK_DIR/pids"

start_nodes() {
    echo "Starting ${algorithm.toUpperCase()} nodes..."
    
    if [ ! -d "$FRAMEWORK_DIR" ]; then
        echo "Error: Framework directory not found: $FRAMEWORK_DIR"
        exit 1
    fi
    
    cd "$FRAMEWORK_DIR" || exit 1
    mkdir -p "$PID_DIR"
    
    # Stop existing nodes first
    stop_nodes
    sleep 2
    
    # Start nodes in background with PID tracking
    for i in {0..${nodes.length - 1}}; do
        port=\${PORTS[$i]}
        node_id=$((i+1))
        nohup node index.js $port $node_id > node$node_id.log 2>&1 &
        echo $! > "$PID_DIR/node$node_id.pid"
        echo "Started node $node_id on port $port (PID: $!)"
    done
    
    sleep 3
    echo "${algorithm.toUpperCase()} nodes started on ports: \${PORTS[@]}"
    
    # Validate nodes started successfully
    failed=0
    for port in "\${PORTS[@]}"; do
        if ! lsof -i :$port >/dev/null 2>&1; then
            echo "❌ Failed to start node on port $port"
            failed=1
        fi
    done
    
    if [ $failed -eq 0 ]; then
        echo "✅ All nodes started successfully"
    else
        echo "⚠️  Some nodes failed to start"
    fi
    
    check_status
}

stop_nodes() {
    echo "Stopping ${algorithm.toUpperCase()} nodes..."
    
    if [ -d "$PID_DIR" ]; then
        for pid_file in "$PID_DIR"/*.pid; do
            if [ -f "$pid_file" ]; then
                pid=$(cat "$pid_file")
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    echo "Stopped process $pid"
                fi
                rm -f "$pid_file"
            fi
        done
    else
        pkill -f "node index.js" 2>/dev/null
    fi
    
    sleep 2
    echo "All ${algorithm.toUpperCase()} nodes stopped."
}

check_status() {
    echo "Checking node status..."
    for port in "\${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            node_info=$(curl -s --max-time 3 http://localhost:$port/api/status 2>/dev/null)
            if [ $? -eq 0 ] && [ -n "$node_info" ]; then
                node_id=$(echo "$node_info" | grep -o '"nodeID":"[^"]*"' | cut -d'"' -f4)
                behavior=$(echo "$node_info" | grep -o '"behavior":"[^"]*"' | cut -d'"' -f4)
                is_byzantine=$(echo "$node_info" | grep -o '"isByzantine":[^,}]*' | cut -d':' -f2)
                
                if [ "$is_byzantine" = "true" ]; then
                    if [ "$behavior" = "crash" ]; then
                        echo "✅ Node $node_id on port $port: RUNNING (Crash failure)"
                    else
                        echo "✅ Node $node_id on port $port: RUNNING (Byzantine: $behavior)"
                    fi
                else
                    echo "✅ Node $node_id on port $port: RUNNING (Honest)"
                fi
            else
                echo "✅ Node on port $port: RUNNING"
            fi
        else
            echo "❌ Node on port $port: STOPPED"
        fi
    done
}

run_tests() {
    echo "Running MIS algorithm..."
    
    if ! lsof -i :\${PORTS[0]} >/dev/null 2>&1; then
        echo "Error: Primary node (port \${PORTS[0]}) is not running"
        return 1
    fi
    
    cat > "$FRAMEWORK_DIR/test-metadata.json" << EOF
{
  "algorithm": "MIS",
  "timestamp": $(date +%s),
  "nodes": ${nodeCount}
}
EOF
    
    local custom_weights=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --weights)
                custom_weights="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [ "${algorithm}" = "mis" ]; then
        echo "Starting MIS algorithm on all nodes..."
        endpoint="api/start-mis"
        algo_name="MIS"
        payload="{}"
    elif [ "${algorithm}" = "mstghs" ]; then
        echo "Starting GHS MST algorithm on all nodes..."
        endpoint="api/start-ghs"
        algo_name="GHS"
        payload="{}"
    else
        echo "Starting ${algorithm} algorithm on all nodes..."
        endpoint="api/start-${algorithm}"
        algo_name="${algorithm}"
        payload="{}"
    fi
    
    for port in "\${PORTS[@]}"; do
        response=$(curl -s --max-time 10 -X POST http://localhost:$port/$endpoint \\
            -H "Content-Type: application/json" \\
            -d '{}' 2>/dev/null)
        echo "Node on port $port: $response"
    done
    
    echo "Waiting for \$algo_name algorithm to complete..."
    sleep 8
    
    echo "\$algo_name algorithm execution completed!"
}

show_stats() {
    echo "=== ${algorithm.toUpperCase()} Cluster Statistics ==="
    echo "Topology: ${topology}, Nodes: ${nodeCount}"
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    local total_logs=0
    local total_commits=0
    local running_nodes=0
    
    for port in "\${PORTS[@]}"; do
        echo "--- Node $port ---"
        if lsof -i :$port >/dev/null 2>&1; then
            running_nodes=$((running_nodes + 1))
            echo "Status: ✅ RUNNING"
            
            # Get commit count
            local commit_count=$(curl -s --max-time 5 http://localhost:$port/api/${algorithm}-commit-log 2>/dev/null | grep -o '"committedAt"' | wc -l || echo "0")
            total_commits=$((total_commits + commit_count))
            echo "Committed transactions: $commit_count"
        else
            echo "Status: ❌ STOPPED"
        fi
        echo ""
    done
    
    echo "=== Cluster Summary ==="
    echo "Running nodes: $running_nodes/${nodeCount}"
    echo "Total committed transactions: $total_commits"
    echo "Average commits per node: $((total_commits / (running_nodes > 0 ? running_nodes : 1)))"
}

run_verify() {
    echo "Verifying consensus properties..."
    if [ ! -f "$FRAMEWORK_DIR/test-metadata.json" ]; then
        echo "❌ No test data found. Run 'test' command first."
        return 1
    fi
    cd "$FRAMEWORK_DIR" || exit 1
    node verification.js
}

case "$1" in
    start) start_nodes ;;
    stop) stop_nodes ;;
    test) run_tests "$@" ;;
    verify) run_verify ;;
    stats) show_stats ;;
    status) check_status ;;
    *) 
        echo "Usage: $0 {start|stop|test|verify|stats|status}"
        echo "Topology: ${topology}, Nodes: ${nodeCount}"
        exit 1 ;;
esac`;
}

// Generate CLI script content
function generateCLI(nodes, algorithm) {
  const ports = nodes.map((_, i) => 3001 + i);
  const portsArray = `(${ports.join(' ')})`;
  
  return `#!/bin/bash

# Auto-generated CLI for ${nodeCount} nodes, ${topology} topology
# Algorithm: ${algorithm.toUpperCase()}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=${portsArray}
PID_DIR="$FRAMEWORK_DIR/pids"

start_nodes() {
    echo "Starting ${algorithm.toUpperCase()} nodes..."
    
    if [ ! -d "$FRAMEWORK_DIR" ]; then
        echo "Error: Framework directory not found: $FRAMEWORK_DIR"
        exit 1
    fi
    
    cd "$FRAMEWORK_DIR" || exit 1
    mkdir -p "$PID_DIR"
    
    # Stop existing nodes first
    stop_nodes
    sleep 2
    
    # Start nodes in background with PID tracking
    for i in {0..${nodes.length - 1}}; do
        port=\${PORTS[$i]}
        node_id=$((i+1))
        nohup node index.js $port $node_id > node$node_id.log 2>&1 &
        echo $! > "$PID_DIR/node$node_id.pid"
        echo "Started node $node_id on port $port (PID: $!)"
    done
    
    sleep 3
    echo "${algorithm.toUpperCase()} nodes started on ports: \${PORTS[@]}"
    
    # Validate nodes started successfully
    failed=0
    for port in "\${PORTS[@]}"; do
        if ! lsof -i :$port >/dev/null 2>&1; then
            echo "❌ Failed to start node on port $port"
            failed=1
        fi
    done
    
    if [ $failed -eq 0 ]; then
        echo "✅ All nodes started successfully"
    else
        echo "⚠️  Some nodes failed to start"
    fi
    
    check_status
}

stop_nodes() {
    echo "Stopping ${algorithm.toUpperCase()} nodes..."
    
    if [ -d "$PID_DIR" ]; then
        for pid_file in "$PID_DIR"/*.pid; do
            if [ -f "$pid_file" ]; then
                pid=$(cat "$pid_file")
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    echo "Stopped process $pid"
                fi
                rm -f "$pid_file"
            fi
        done
    else
        pkill -f "node index.js" 2>/dev/null
    fi
    
    sleep 2
    echo "All ${algorithm.toUpperCase()} nodes stopped."
}

check_status() {
    echo "Checking node status..."
    for port in "\${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            node_info=$(curl -s --max-time 3 http://localhost:$port/api/status 2>/dev/null)
            if [ $? -eq 0 ] && [ -n "$node_info" ]; then
                node_id=$(echo "$node_info" | grep -o '"nodeID":"[^"]*"' | cut -d'"' -f4)
                behavior=$(echo "$node_info" | grep -o '"behavior":"[^"]*"' | cut -d'"' -f4)
                is_byzantine=$(echo "$node_info" | grep -o '"isByzantine":[^,}]*' | cut -d':' -f2)
                
                if [ "$is_byzantine" = "true" ]; then
                    if [ "$behavior" = "crash" ]; then
                        echo "✅ Node $node_id on port $port: RUNNING (Crash failure)"
                    else
                        echo "✅ Node $node_id on port $port: RUNNING (Byzantine: $behavior)"
                    fi
                else
                    echo "✅ Node $node_id on port $port: RUNNING (Honest)"
                fi
            else
                echo "✅ Node on port $port: RUNNING"
            fi
        else
            echo "❌ Node on port $port: STOPPED"
        fi
    done
}

run_tests() {
    echo "Running ${algorithm.toUpperCase()} test transactions..."
    
    if ! lsof -i :\${PORTS[0]} >/dev/null 2>&1; then
        echo "Error: Primary node (port \${PORTS[0]}) is not running"
        return 1
    fi
    
    local custom_values=""
    local tps_count=""
    local tps_duration=""
    local show_tps=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --values)
                custom_values="$2"
                shift 2
                ;;
            --count)
                tps_count="$2"
                shift 2
                ;;
            --duration)
                tps_duration="$2"
                shift 2
                ;;
            --tps)
                show_tps=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Handle TPS testing
    if [ "$show_tps" = true ]; then
        node ../tps-tester.js ${algorithm} metrics
        return
    fi
    
    if [ -n "$tps_count" ]; then
        if [ -n "$tps_duration" ]; then
            echo "Running TPS duration test: $tps_count transactions over $tps_duration seconds"
            node ../tps-tester.js ${algorithm} duration "$tps_count" "$tps_duration"
        else
            echo "Running TPS burst test with $tps_count transactions"
            node ../tps-tester.js ${algorithm} burst "$tps_count"
        fi
        return
    fi
    
    if [ -n "$custom_values" ]; then
        IFS=',' read -ra VALUES <<< "$custom_values"
        echo "Using custom values: $custom_values"
    else
        VALUES=()
        for i in $(seq 1 ${nodes.length}); do
            VALUES+=($((i*100)))
        done
        echo "Using node-scaled values: \${VALUES[*]}"
    fi
    
    cat > "$FRAMEWORK_DIR/test-metadata.json" << EOF
{
  "submittedValues": [$(IFS=','; echo "\${VALUES[*]}")],
  "timestamp": $(date +%s),
  "count": \${#VALUES[@]},
  "algorithm": "${algorithm.toUpperCase()}"
}
EOF
    
    for i in "\${!VALUES[@]}"; do
        value=\${VALUES[$i]}
        response=$(curl -s --max-time 10 -X POST http://localhost:\${PORTS[0]}/api/client \\
            -H "Content-Type: application/json" \\
            -d "{\\"operation\\": \\"TX\\", \\"id\\": $((i+1)), \\"value\\": $value}" 2>/dev/null)
        echo "TX$((i+1)) (value: $value) Response: $response"
        sleep 3
    done
    
    echo "Tests completed!"
}

show_stats() {
    echo "=== ${algorithm.toUpperCase()} Cluster Statistics ==="
    echo "Topology: ${topology}, Nodes: ${nodeCount}"
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    local total_logs=0
    local total_commits=0
    local running_nodes=0
    
    for port in "\${PORTS[@]}"; do
        echo "--- Node $port ---"
        if lsof -i :$port >/dev/null 2>&1; then
            running_nodes=$((running_nodes + 1))
            echo "Status: ✅ RUNNING"
            
            # Get commit count
            local commit_count=$(curl -s --max-time 5 http://localhost:$port/api/${algorithm}-commit-log 2>/dev/null | grep -o '"committedAt"' | wc -l || echo "0")
            total_commits=$((total_commits + commit_count))
            echo "Committed transactions: $commit_count"
        else
            echo "Status: ❌ STOPPED"
        fi
        echo ""
    done
    
    echo "=== Cluster Summary ==="
    echo "Running nodes: $running_nodes/${nodeCount}"
    echo "Total committed transactions: $total_commits"
    echo "Average commits per node: $((total_commits / (running_nodes > 0 ? running_nodes : 1)))"
}

run_verify() {
    echo "Verifying consensus properties..."
    if [ ! -f "$FRAMEWORK_DIR/test-metadata.json" ]; then
        echo "❌ No test data found. Run 'test' command first."
        return 1
    fi
    cd "$FRAMEWORK_DIR" || exit 1
    node verification.js
}

case "$1" in
    start) start_nodes ;;
    stop) stop_nodes ;;
    test) run_tests "$@" ;;
    verify) run_verify ;;
    stats) show_stats ;;
    status) check_status ;;
    *) 
        echo "Usage: $0 {start|stop|test|verify|stats|status}"
        echo "Topology: ${topology}, Nodes: ${nodeCount}"
        exit 1 ;;
esac`;
}

// Main execution
try {
  const nodes = generateNodeIDs(nodeCount);
  const edges = generateTopology(nodes, topology);
  const byzantineConfig = parseByzantineConfig(byzantineArg);
  const crashConfig = parseCrashConfig(crashArg);
  
  console.log(`Generating topology: ${nodeCount} nodes, ${topology} topology`);
  console.log(`Nodes: ${nodes.join(', ')}`);
  console.log(`Edges: ${edges.length} connections`);
  
  // Handle Byzantine failures (for PBFT/SBFT/HotStuff)
  const totalByzantine = byzantineConfig.silent + byzantineConfig.corrupt + byzantineConfig.delay + byzantineConfig.random;
  const totalCrash = crashConfig.crash;
  
  if (totalByzantine > 0 && totalCrash > 0) {
    throw new Error('Cannot specify both Byzantine and crash failures. Use --byzantine for PBFT/SBFT/HotStuff or --crash for Raft/Paxos.');
  }
  
  let assignments = {};
  
  if (totalByzantine > 0) {
    // Byzantine failure configuration
    validateByzantineConfig(nodeCount, byzantineConfig, 'pbft');
    assignments = assignByzantineBehaviors(nodes, byzantineConfig);
    
    console.log(`\nByzantine configuration:`);
    for (const [behavior, count] of Object.entries(byzantineConfig)) {
      if (count > 0) {
        const behaviorNodes = Object.keys(assignments).filter(node => assignments[node] === behavior);
        console.log(`  - ${behavior.charAt(0).toUpperCase() + behavior.slice(1)} nodes: ${behaviorNodes.join(', ')} (${count} nodes)`);
      }
    }
    
    const honestNodes = Object.keys(assignments).filter(node => assignments[node] === 'honest');
    console.log(`  - Honest nodes: ${honestNodes.join(', ')} (${honestNodes.length} nodes)`);
  } else if (totalCrash > 0) {
    // Crash failure configuration
    validateCrashConfig(nodeCount, crashConfig, 'raft');
    assignments = assignCrashBehaviors(nodes, crashConfig);
    
    console.log(`\nCrash failure configuration:`);
    const crashNodes = Object.keys(assignments).filter(node => assignments[node] === 'crash');
    console.log(`  - Crash nodes: ${crashNodes.join(', ')} (${totalCrash} nodes)`);
    
    const honestNodes = Object.keys(assignments).filter(node => assignments[node] === 'honest');
    console.log(`  - Honest nodes: ${honestNodes.join(', ')} (${honestNodes.length} nodes)`);
  } else {
    // All honest nodes
    assignments = {};
    nodes.forEach(node => assignments[node] = 'honest');
  }
  
  // Write failure configuration file
  if (Object.keys(assignments).length > 0) {
    const configContent = `module.exports = ${JSON.stringify(assignments, null, 2)};`;
    
    const algorithms = ['pbft', 'sbft', 'paxos', 'raft', 'hotstuff', 'prime', 'mis', 'mstghs'];
    algorithms.forEach(algo => {
      const algoDir = `Dsim-${algo.charAt(0).toUpperCase() + algo.slice(1)}`;
      const configPath = path.join(outputDir, algoDir, 'framework', 'byzantine-config.js');
      
      if (fs.existsSync(path.dirname(configPath))) {
        fs.writeFileSync(configPath, configContent);
        console.log(`✅ Updated: ${configPath}`);
      }
    });
  }
  
  // Parse deployment configuration
  let deploymentType = 'localhost';
  if (deploymentArg) {
    const deploymentValue = deploymentArg.replace('--deployment', '').replace('=', '').trim();
    if (DEPLOYMENT_CONFIGS[deploymentValue]) {
      deploymentType = deploymentValue;
    } else {
      console.warn(`Unknown deployment type: ${deploymentValue}. Using localhost.`);
    }
  }
  
  console.log(`Deployment: ${deploymentType} (${DEPLOYMENT_CONFIGS[deploymentType].description})`);
  
  // Generate graph.js for each algorithm
  const algorithms = ['pbft', 'sbft', 'paxos', 'raft', 'hotstuff', 'prime', 'mis', 'mstghs'];
  const graphContent = generateGraphJS(nodes, edges, deploymentType);
  
  algorithms.forEach(algo => {
    const algoDir = `Dsim-${algo.charAt(0).toUpperCase() + algo.slice(1)}`;
    const graphPath = path.join(outputDir, algoDir, 'framework', 'helper_modules', 'graph.js');
    const cliPath = path.join(outputDir, algoDir, 'dsim-cli.sh');
    
    // Write graph.js
    if (fs.existsSync(path.dirname(graphPath))) {
      fs.writeFileSync(graphPath, graphContent);
      console.log(`✅ Updated: ${graphPath}`);
    }
    
    // Write CLI script
    if (fs.existsSync(path.dirname(cliPath))) {
      const cliContent = (algo === 'mis' || algo === 'mstghs') ? generateMISCLI(nodes, algo) : generateCLI(nodes, algo);
      fs.writeFileSync(cliPath, cliContent);
      fs.chmodSync(cliPath, '755');
      console.log(`✅ Updated: ${cliPath}`);
    }
  });
  
  console.log(`\n🎉 Topology configured successfully!`);
  console.log(`Usage: bash dsim-cli.sh <algorithm> start`);
  
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  console.log(`\nUsage: node topology-config.js <nodes> <topology> [--deployment=type] [--byzantine behavior:count,...] [--crash crash:count]`);
  console.log(`Nodes: 4-10 (number of nodes)`);
  console.log(`Topology: full|ring|star|line`);
  console.log(`Deployment: localhost|multi-machine|docker|cloud`);
  console.log(`Byzantine: silent:N,corrupt:N,delay:N,random:N (for PBFT/SBFT/HotStuff)`);
  console.log(`Crash: crash:N (for Raft/Paxos)`);
  console.log(`\nExamples:`);
  console.log(`  node topology-config.js 6 full --deployment=multi-machine`);
  console.log(`  node topology-config.js 7 full --deployment=docker --byzantine silent:1,corrupt:1`);
  console.log(`  node topology-config.js 5 full --deployment=cloud --crash crash:2`);
  process.exit(1);
}