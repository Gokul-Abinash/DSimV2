#!/bin/bash

# Multi-Server Distributed SBFT CLI
# 4 Machines x 32 Nodes = 128 Nodes Cluster
# Ports per machine: 3001 to 3032

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=($(seq 3001 3032))
PID_DIR="$FRAMEWORK_DIR/pids"
PRIMARY_URL="http://10.0.1.11:3001/api/client"

start_nodes() {
    echo "=========================================="
    echo "Starting 32 SBFT nodes on this machine..."
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
        echo "🟢 Started SBFT node on port $port (PID: $pid)"
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
    echo "Stopping SBFT nodes on this machine..."
    
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
    echo "All local SBFT nodes stopped."
}

check_status() {
    echo "=== Local SBFT Nodes Status ==="
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
    local custom_values=""
    local count=""
    local concurrency="5"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --values)
                custom_values="$2"
                shift 2
                ;;
            --count)
                count="$2"
                shift 2
                ;;
            --concurrency)
                concurrency="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [ -n "$count" ]; then
        echo "Running load test with $count transactions on SBFT..."
        cd "$SCRIPT_DIR/.." || exit 1
        node benchmark-metrics.js sbft --requests "$count" --concurrency "$concurrency"
        return
    fi
    
    if [ -n "$custom_values" ]; then
        IFS=',' read -ra VALUES <<< "$custom_values"
    else
        VALUES=(100 200 300 400 500)
    fi
    
    echo "Submitting SBFT test transactions to Primary ($PRIMARY_URL)..."
    
    mkdir -p "$FRAMEWORK_DIR"
    cat > "$FRAMEWORK_DIR/test-metadata.json" << EOF
{
  "submittedValues": [$(IFS=','; echo "${VALUES[*]}")],
  "timestamp": $(date +%s),
  "count": ${#VALUES[@]},
  "algorithm": "SBFT"
}
EOF
    
    local tx_id=1
    for val in "${VALUES[@]}"; do
        local payload="{\"operation\": \"TX\", \"id\": $tx_id, \"value\": $val}"
        local resp=$(curl -s --max-time 10 -X POST "$PRIMARY_URL" \
            -H "Content-Type: application/json" \
            -d "$payload" 2>/dev/null)
        echo "TX$tx_id (value: $val) -> Primary response: $resp"
        tx_id=$((tx_id + 1))
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
    echo "=== Local SBFT Node Stats ==="
    for port in "${PORTS[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            local commits=$(curl -s --max-time 2 http://localhost:$port/api/sbft-commit-log 2>/dev/null)
            local count=$(echo "$commits" | grep -o '"value"' | wc -l | tr -d ' ')
            echo "Port $port: $count commits"
        else
            echo "Port $port: OFFLINE"
        fi
    done
}

run_benchmark() {
    if [ -f "$SCRIPT_DIR/../benchmark-metrics.js" ]; then
        node "$SCRIPT_DIR/../benchmark-metrics.js" sbft "$@"
    else
        echo "Error: benchmark-metrics.js not found"
    fi
}

run_metrics() {
    if [ -f "$SCRIPT_DIR/../benchmark-metrics.js" ]; then
        node "$SCRIPT_DIR/../benchmark-metrics.js" sbft evaluate "$@"
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
    status) check_status ;;
    stats) show_stats ;;
    *)
        echo "Usage: $0 {start|stop|test|benchmark|metrics|verify|status|stats}"
        echo "Options for test: --values 100,200,..."
        echo "Options for benchmark: [requests] [concurrency] (e.g. $0 benchmark 100 5)"
        exit 1
        ;;
esac