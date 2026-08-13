#!/bin/bash

# Multi-Server Distributed MST-GHS CLI
# 4 Machines x 32 Nodes = 128 Nodes Cluster
# Ports per machine: 3001 to 3032

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=($(seq 3001 3032))
PID_DIR="$FRAMEWORK_DIR/pids"

start_nodes() {
    echo "=========================================="
    echo "Starting 32 MST-GHS nodes on this machine..."
    echo "=========================================="
    
    if [ ! -d "$FRAMEWORK_DIR" ]; then
        echo "Error: Framework directory not found: $FRAMEWORK_DIR"
        exit 1
    fi
    
    cd "$FRAMEWORK_DIR" || exit 1
    mkdir -p "$PID_DIR"
    
    stop_nodes >/dev/null 2>&1
    sleep 1
    
    for port in "${PORTS[@]}"; do
        nohup node index.js $port > "node$port.log" 2>&1 &
        local pid=$!
        echo $pid > "$PID_DIR/node$port.pid"
        echo "🟢 Started MST-GHS node on port $port (PID: $pid)"
    done
    
    echo ""
    echo "Waiting for nodes to initialize..."
    sleep 3
    
    local running=0
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            running=$((running + 1))
        else
            echo "❌ Node on port $port failed to start"
        fi
    done
    
    echo "=========================================="
    echo "Summary: $running / 16 nodes running on this server"
    echo "=========================================="
}

stop_nodes() {
    echo "Stopping MST-GHS nodes on this machine..."
    
    if [ -d "$PID_DIR" ]; then
        for pid_file in "$PID_DIR"/*.pid; do
            if [ -f "$pid_file" ]; then
                local pid=$(cat "$pid_file" 2>/dev/null)
                if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid" 2>/dev/null
                fi
                rm -f "$pid_file"
            fi
        done
    fi
    
    for port in "${PORTS[@]}"; do
        local pid=$(lsof -ti :$port 2>/dev/null)
        if [ -n "$pid" ]; then
            kill -9 $pid 2>/dev/null
        fi
    done
    
    sleep 1
    echo "All local MST-GHS nodes stopped."
}

check_status() {
    echo "=== Local MST-GHS Nodes Status ==="
    local count=0
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            local info=$(curl -s --max-time 2 http://localhost:$port/api/status 2>/dev/null)
            local node_id=$(echo "$info" | grep -o '"nodeID":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$node_id" ]; then
                echo "  🟢 Port $port: RUNNING (ID: $node_id)"
            else
                echo "  🟢 Port $port: RUNNING"
            fi
            count=$((count + 1))
        else
            echo "  🔴 Port $port: STOPPED"
        fi
    done
    echo ""
    echo "Running on this machine: $count / ${#PORTS[@]} nodes"
}

run_tests() {
    echo "Triggering MST-GHS algorithm execution across cluster nodes..."
    
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            curl -s --max-time 3 -X POST "http://localhost:$port/api/start-ghs" \
                -H "Content-Type: application/json" \
                -d "{}" > /dev/null 2>&1 &
        fi
    done
    
    echo "MST-GHS algorithm triggered on local nodes. Building Minimum Spanning Tree..."
    sleep 6
    echo "Done! Run 'bash dsim-cli.sh verify' to inspect MST results across all 64 nodes."
}

run_verify() {
    echo "Verifying MST-GHS across all 64 nodes in the cluster..."
    cd "$FRAMEWORK_DIR" || exit 1
    node verification.js
}

show_stats() {
    echo "=== Local MST-GHS Node Stats ==="
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            local results=$(curl -s --max-time 2 http://localhost:$port/api/ghs-results 2>/dev/null)
            local edges_count=$(echo "$results" | grep -o '"mstEdges":\s*\[[^]]*\]' | grep -o 'Node[0-9]*' | wc -l | tr -d ' ')
            echo "Port $port: $edges_count edge references"
        else
            echo "Port $port: OFFLINE"
        fi
    done
}

case "$1" in
    start) start_nodes ;;
    stop) stop_nodes ;;
    test) run_tests "$@" ;;
    verify) run_verify ;;
    status) check_status ;;
    stats) show_stats ;;
    *)
        echo "Usage: $0 {start|stop|test|verify|status|stats}"
        exit 1
        ;;
esac