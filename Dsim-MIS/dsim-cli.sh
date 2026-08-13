#!/bin/bash

# Multi-Server Distributed MIS CLI
# 4 Machines x 16 Nodes = 64 Nodes Cluster
# Ports per machine: 3001 to 3016

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=(3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012 3013 3014 3015 3016)
PID_DIR="$FRAMEWORK_DIR/pids"

start_nodes() {
    echo "=========================================="
    echo "Starting 16 MIS nodes on this machine..."
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
        echo "🟢 Started MIS node on port $port (PID: $pid)"
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
    echo "Stopping MIS nodes on this machine..."
    
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
    echo "All local MIS nodes stopped."
}

check_status() {
    echo "=== Local MIS Nodes Status ==="
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
    echo "Triggering MIS algorithm execution across cluster nodes..."
    
    # Trigger /api/start-mis on local nodes
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            curl -s --max-time 3 -X POST "http://localhost:$port/api/start-mis" \
                -H "Content-Type: application/json" > /dev/null 2>&1 &
        fi
    done
    
    echo "MIS algorithm triggered on local nodes. Waiting for Luby MIS convergence..."
    sleep 5
    echo "Done! Run 'bash dsim-cli.sh verify' to inspect MIS results across all 64 nodes."
}

run_verify() {
    echo "Verifying MIS across all 64 nodes in the cluster..."
    cd "$FRAMEWORK_DIR" || exit 1
    node verification.js
}

show_stats() {
    echo "=== Local MIS Node Stats ==="
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            local results=$(curl -s --max-time 2 http://localhost:$port/api/mis-results 2>/dev/null)
            local in_mis=$(echo "$results" | grep -o '"inMIS":true' || true)
            if [ -n "$in_mis" ]; then
                echo "Port $port: 🟢 IN MIS"
            else
                echo "Port $port: ⚪ NOT IN MIS (or evaluating)"
            fi
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