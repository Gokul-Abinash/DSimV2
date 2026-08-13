#!/bin/bash

# Multi-Server Distributed PBFT CLI
# 4 Machines x 32 Nodes = 128 Nodes Cluster
# Ports per machine: 3001 to 3032

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=($(seq 3001 3032))
PID_DIR="$FRAMEWORK_DIR/pids"
PRIMARY_URL="http://10.0.1.11:3001/api/client"

start_nodes() {
    echo "=========================================="
    echo "Starting 32 PBFT nodes on this machine..."
    echo "=========================================="
    
    if [ ! -d "$FRAMEWORK_DIR" ]; then
        echo "Error: Framework directory not found: $FRAMEWORK_DIR"
        exit 1
    fi
    
    cd "$FRAMEWORK_DIR" || exit 1
    mkdir -p "$PID_DIR"
    
    # Stop existing nodes first
    stop_nodes
    sleep 1
    
    # Start 16 nodes in background
    for port in "${PORTS[@]}"; do
        nohup node index.js $port > "node_$port.log" 2>&1 &
        echo $! > "$PID_DIR/node_$port.pid"
        echo "Started node on port $port (PID: $!)"
    done
    
    sleep 3
    echo ""
    echo "Checking status of started nodes on this server..."
    check_status
}

stop_nodes() {
    echo "Stopping PBFT nodes on this machine..."
    
    if [ -d "$PID_DIR" ]; then
        for pid_file in "$PID_DIR"/*.pid; do
            if [ -f "$pid_file" ]; then
                pid=$(cat "$pid_file")
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid" 2>/dev/null
                fi
                rm -f "$pid_file"
            fi
        done
    fi
    
    pkill -f "node index.js" 2>/dev/null || true
    sleep 1
    echo "All PBFT nodes stopped on this machine."
}

check_status() {
    echo "=== Local Node Status (Ports 3001-3016) ==="
    local running=0
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            running=$((running + 1))
            node_info=$(curl -s --max-time 2 http://127.0.0.1:$port/api/status 2>/dev/null)
            if [ -n "$node_info" ]; then
                node_id=$(echo "$node_info" | grep -o '"nodeID":"[^"]*"' | cut -d'"' -f4)
                echo "✅ Port $port: RUNNING -> ID: $node_id"
            else
                echo "✅ Port $port: RUNNING"
            fi
        else
            echo "❌ Port $port: STOPPED"
        fi
    done
    echo "Running on this machine: $running / ${#PORTS[@]} nodes"
}

run_tests() {
    echo "Submitting PBFT test transactions to Primary ($PRIMARY_URL)..."
    
    local custom_values=""
    local tps_count=""
    local tps_concurrency="5"
    
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
            --concurrency)
                tps_concurrency="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [ -n "$tps_count" ]; then
        echo "Running TPS test with $tps_count transactions..."
        cd "$FRAMEWORK_DIR" || exit 1
        node test_pbft_TPS.js "$tps_count" "$tps_concurrency" "$PRIMARY_URL"
        return
    fi
    
    if [ -n "$custom_values" ]; then
        IFS=',' read -ra VALUES <<< "$custom_values"
    else
        VALUES=(100 200 300 400 500)
    fi
    
    cat > "$FRAMEWORK_DIR/test-metadata.json" << EOF
{
  "submittedValues": [$(IFS=','; echo "${VALUES[*]}")],
  "timestamp": $(date +%s),
  "count": ${#VALUES[@]},
  "algorithm": "PBFT"
}
EOF
    
    for i in "${!VALUES[@]}"; do
        value=${VALUES[$i]}
        response=$(curl -s --max-time 10 -X POST "$PRIMARY_URL" \
            -H "Content-Type: application/json" \
            -d "{\"operation\": \"TX\", \"id\": $((i+1)), \"value\": $value}" 2>/dev/null)
        echo "TX$((i+1)) (value: $value) -> Primary response: $response"
        sleep 2
    done
    
    echo "Transactions submitted!"
}

run_verify() {
    echo "Verifying consensus across all 128 nodes in the cluster..."
    cd "$FRAMEWORK_DIR" || exit 1
    node verification.js
}

show_stats() {
    echo "=== PBFT Local Statistics ==="
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            local commit_count=$(curl -s --max-time 3 http://127.0.0.1:$port/api/pbft-commit-log 2>/dev/null | grep -o '"committedAt"' | wc -l || echo "0")
            echo "Port $port commits: $commit_count"
        fi
    done
}

run_benchmark() {
    if [ -f "$SCRIPT_DIR/../benchmark-metrics.js" ]; then
        node "$SCRIPT_DIR/../benchmark-metrics.js" pbft "$@"
    else
        echo "Error: benchmark-metrics.js not found"
    fi
}

run_metrics() {
    if [ -f "$SCRIPT_DIR/../benchmark-metrics.js" ]; then
        node "$SCRIPT_DIR/../benchmark-metrics.js" pbft evaluate "$@"
    else
        echo "Error: benchmark-metrics.js not found"
    fi
}

case "$1" in
    start) start_nodes ;;
    stop) stop_nodes ;;
    test) shift; run_tests "$@" ;;
    benchmark) shift; run_benchmark "$@" ;;
    metrics) shift; run_metrics "$@" ;;
    verify) run_verify ;;
    stats) show_stats ;;
    status) check_status ;;
    *) 
        echo "Usage: $0 {start|stop|test|benchmark|metrics|verify|stats|status}"
        echo "Options for test: --values <100,200,300>"
        echo "Options for benchmark: [requests] [concurrency] (e.g. $0 benchmark 100 5)"
        exit 1 ;;
esac