#!/bin/bash

# Unified CLI for all consensus algorithms
# Usage: ./dsim-cli.sh <algorithm> <command>
# Example: ./dsim-cli.sh pbft start

ALGORITHM=$1
COMMAND=$2

if [ -z "$ALGORITHM" ]; then
    echo "Usage: ./dsim-cli.sh <algorithm> <command> [args...]"
    echo "Algorithms: pbft, sbft, paxos, raft, hotstuff, prime, mis, mstghs"
    echo "Commands: start, stop, test, stats, tps, debug, topology, latency, benchmark, cloud"
    echo ""
    echo "Topology: ./dsim-cli.sh topology <nodes> <type> [--deployment=type]"
    echo "  nodes: 4-8 (number of nodes)"
    echo "  type: full|ring|star|line"
    echo "  deployment: localhost|multi-machine|docker|cloud"
    echo "  Example: ./dsim-cli.sh topology 6 full --deployment=multi-machine"
    echo ""
    echo "Latency: ./dsim-cli.sh latency <profile|show|custom>"
    echo "  profiles: none, lan, wan, high, unstable"
    echo "  Example: ./dsim-cli.sh latency wan"
    echo "  Custom: ./dsim-cli.sh latency custom 50 200 normal"
    echo ""
    echo "Benchmark: ./dsim-cli.sh benchmark <type> [algorithm]"
    echo "  types: latency, scalability"
    echo "  Example: ./dsim-cli.sh benchmark scalability pbft"
    echo "  Example: ./dsim-cli.sh benchmark latency full"
    exit 1
fi

# Handle stop-all command
if [ "$ALGORITHM" = "stop-all" ]; then
    echo "Stopping all nodes across all protocols..."
    for algo in pbft sbft raft paxos hotstuff prime mis mstghs; do
        echo "Stopping $algo nodes..."
        bash dsim-cli.sh $algo stop 2>/dev/null
    done
    echo "All nodes stopped."
    exit 0
fi

# Handle cloud commands
if [ "$ALGORITHM" = "cloud" ]; then
    CLOUD_COMMAND=$2
    shift 2
    
    if [ -z "$CLOUD_COMMAND" ]; then
        echo "Usage: ./dsim-cli.sh cloud <command> [args...]"
        echo "Commands:"
        echo "  deploy [nodeCount]           - Deploy EC2 instances"
        echo "  start <algorithm>            - Start consensus protocol"
        echo "  test <algorithm> [values]    - Run consensus test"
        echo "  verify <algorithm>           - Verify consensus"
        echo "  status                       - Show deployment status"
        echo "  cleanup                      - Terminate all instances"
        echo ""
        echo "Examples:"
        echo "  ./dsim-cli.sh cloud deploy 4"
        echo "  ./dsim-cli.sh cloud start pbft"
        echo "  ./dsim-cli.sh cloud test pbft 100,200,300"
        echo "  ./dsim-cli.sh cloud verify pbft"
        echo "  ./dsim-cli.sh cloud cleanup"
        exit 1
    fi
    
    echo "🌩️ Executing cloud command: $CLOUD_COMMAND"
    node aws-cloud-deployer.js "$CLOUD_COMMAND" "$@"
    exit 0
fi

# Handle benchmark commands
if [ "$ALGORITHM" = "benchmark" ]; then
    BENCHMARK_TYPE=$2
    TARGET=$3
    
    if [ -z "$BENCHMARK_TYPE" ]; then
        echo "Usage: ./dsim-cli.sh benchmark <type> [target]"
        echo "Types:"
        echo "  latency [algorithm|full]     - Latency benchmark"
        echo "  scalability [algorithm]      - Scalability benchmark"
        echo ""
        echo "Examples:"
        echo "  ./dsim-cli.sh benchmark latency pbft"
        echo "  ./dsim-cli.sh benchmark latency full"
        echo "  ./dsim-cli.sh benchmark scalability pbft"
        echo "  ./dsim-cli.sh benchmark scalability"
        exit 1
    fi
    
    case $BENCHMARK_TYPE in
        latency)
            if [ -z "$TARGET" ]; then
                echo "Usage: ./dsim-cli.sh benchmark latency <algorithm|full>"
                echo "Algorithms: pbft, sbft, raft, paxos, hotstuff"
                exit 1
            fi
            echo "🚀 Starting latency benchmark for: $TARGET"
            node test-latency.js "$TARGET"
            ;;
        scalability)
            if [ -z "$TARGET" ]; then
                echo "🚀 Starting full scalability benchmark (all algorithms)"
                node scalability-benchmark.js
            else
                echo "🚀 Starting scalability benchmark for: $TARGET"
                node scalability-benchmark.js "$TARGET"
            fi
            ;;
        *)
            echo "Unknown benchmark type: $BENCHMARK_TYPE"
            echo "Available types: latency, scalability"
            exit 1
            ;;
    esac
    exit 0
fi

# Handle latency configuration
if [ "$ALGORITHM" = "latency" ]; then
    PROFILE=$2
    
    if [ "$PROFILE" = "show" ]; then
        echo "=== Current Latency Configuration ==="
        node -e "const latency = require('./latency-config.js'); const stats = latency.getLatencyStats(); console.log('Profile:', stats.profile); console.log('Config:', JSON.stringify(stats.config, null, 2));"
        exit 0
    fi
    
    if [ -z "$PROFILE" ]; then
        echo "Usage: ./dsim-cli.sh latency <profile|show|custom>"
        echo "Profiles: none, lan, wan, high, unstable"
        echo "Custom: ./dsim-cli.sh latency custom <min> <max> <distribution>"
        echo "Example: ./dsim-cli.sh latency custom 50 200 normal"
        exit 1
    fi
    
    if [ "$PROFILE" = "custom" ]; then
        MIN=$3
        MAX=$4
        DIST=$5
        if [ -z "$MIN" ] || [ -z "$MAX" ] || [ -z "$DIST" ]; then
            echo "Custom latency requires: min max distribution"
            echo "Distributions: fixed, uniform, normal, exponential"
            exit 1
        fi
        node -e "const latency = require('./latency-config.js'); latency.setLatencyProfile('custom', {min: $MIN, max: $MAX, distribution: '$DIST'}); console.log('Custom latency profile set: $MIN-${MAX}ms ($DIST)');"
    else
        node -e "const latency = require('./latency-config.js'); latency.setLatencyProfile('$PROFILE'); console.log('Latency profile set to: $PROFILE');"
    fi
    exit 0
fi

# Handle topology configuration
if [ "$ALGORITHM" = "topology" ]; then
    NODES=$2
    TOPOLOGY_TYPE=$3
    BYZANTINE_CONFIG=$4
    
    # Handle show command
    if [ "$NODES" = "show" ]; then
        echo "=== Current Topology Configuration ==="
        
        # Check if Byzantine config exists
        if [ -f "Dsim-PBFT/framework/byzantine-config.js" ]; then
            echo "Byzantine Configuration:"
            node -e "const config = require('./Dsim-PBFT/framework/byzantine-config.js'); 
                     const nodes = Object.keys(config); 
                     const byzantine = nodes.filter(n => config[n] !== 'honest'); 
                     const honest = nodes.filter(n => config[n] === 'honest'); 
                     console.log('  Nodes:', nodes.length); 
                     console.log('  Honest:', honest.join(', ')); 
                     if (byzantine.length > 0) { 
                       byzantine.forEach(n => console.log('  Byzantine:', n, '(' + config[n] + ')')); 
                     }"
        else
            echo "No Byzantine configuration found."
        fi
        
        # Check graph configuration
        if [ -f "Dsim-PBFT/framework/helper_modules/graph.js" ]; then
            echo ""
            echo "Network Topology:"
            node -e "const graph = require('./Dsim-PBFT/framework/helper_modules/graph.js'); 
                     console.log('  Nodes:', graph.nodeIPsArray.length); 
                     console.log('  Node IDs:', graph.nodeIPsArray.map(n => Object.keys(n)[0]).join(', '));"
        fi
        exit 0
    fi
    
    if [ -z "$NODES" ] || [ -z "$TOPOLOGY_TYPE" ]; then
        echo "Usage: ./dsim-cli.sh topology <nodes> <type> [--deployment=type] [--byzantine behavior:count,...]"
        echo "       ./dsim-cli.sh topology show"
        echo "Nodes: 4-8, Type: full|ring|star|line"
        echo "Deployment: localhost|multi-machine|docker|cloud"
        echo "Byzantine: --byzantine silent:N,corrupt:N,delay:N,random:N"
        echo ""
        echo "Examples:"
        echo "  ./dsim-cli.sh topology 8 full --deployment=multi-machine --byzantine silent:1"
        echo "  ./dsim-cli.sh topology 6 ring --deployment=docker"
        echo "  ./dsim-cli.sh topology show"
        exit 1
    fi
    
    if [ -n "$BYZANTINE_CONFIG" ]; then
        node topology-config.js "$NODES" "$TOPOLOGY_TYPE" "$BYZANTINE_CONFIG"
    else
        node topology-config.js "$NODES" "$TOPOLOGY_TYPE"
    fi
    exit $?
fi

if [ -z "$COMMAND" ]; then
    echo "Usage: ./dsim-cli.sh <algorithm> <command>"
    echo "Commands: start, stop, test, stats, tps, debug"
    exit 1
fi

# Convert to uppercase for directory names
ALGO_DIR=""
case $ALGORITHM in
    pbft|PBFT)
        ALGO_DIR="Dsim-PBFT"
        ;;
    sbft|SBFT)
        ALGO_DIR="Dsim-SBFT"
        ;;
    paxos|PAXOS)
        ALGO_DIR="Dsim-Paxos"
        ;;
    raft|RAFT)
        ALGO_DIR="Dsim-Raft"
        ;;
    hotstuff|HOTSTUFF)
        ALGO_DIR="Dsim-HotStuff"
        ;;
    prime|PRIME)
        ALGO_DIR="Dsim-Prime"
        ;;
    mis|MIS)
        ALGO_DIR="Dsim-MIS"
        ;;
    mstghs|MSTGHS)
        ALGO_DIR="Dsim-Mstghs"
        ;;
    *)
        echo "Unknown algorithm: $ALGORITHM"
        echo "Available: pbft, sbft, paxos, raft, hotstuff, prime, mis, mstghs"
        exit 1
        ;;
esac

# Check if algorithm directory exists
if [ ! -d "$ALGO_DIR" ]; then
    echo "Algorithm directory not found: $ALGO_DIR"
    exit 1
fi

# Execute command in algorithm directory
cd "$ALGO_DIR"

# Pass all remaining arguments to the algorithm CLI
shift 2  # Remove algorithm and command
bash dsim-cli.sh "$COMMAND" "$@"