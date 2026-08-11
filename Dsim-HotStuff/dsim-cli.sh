#!/bin/bash

# Auto-generated CLI for 8 nodes, full topology
# Algorithm: HOTSTUFF

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$SCRIPT_DIR/framework"
PORTS=(3001 3002 3003 3004 3005 3006 3007 3008)
PID_DIR="$FRAMEWORK_DIR/pids"

start_nodes() {
    echo "Starting HOTSTUFF nodes..."
    
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
    for i in {0..7}; do
        port=${PORTS[$i]}
        node_id=$((i+1))
        nohup node index.js $port $node_id > node$node_id.log 2>&1 &
        echo $! > "$PID_DIR/node$node_id.pid"
        echo "Started node $node_id on port $port (PID: $!)"
    done
    
    sleep 3
    echo "HOTSTUFF nodes started on ports: ${PORTS[@]}"
    
    # Validate nodes started successfully
    failed=0
    for port in "${PORTS[@]}"; do
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
    echo "Stopping HOTSTUFF nodes..."
    
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
    echo "All HOTSTUFF nodes stopped."
}

check_status() {
    echo "Checking node status..."
    for port in "${PORTS[@]}"; do
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
    echo "Running HOTSTUFF test transactions..."
    
    if ! lsof -i :${PORTS[0]} >/dev/null 2>&1; then
        echo "Error: Primary node (port ${PORTS[0]}) is not running"
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
        node ../tps-tester.js hotstuff metrics
        return
    fi
    
    if [ -n "$tps_count" ]; then
        if [ -n "$tps_duration" ]; then
            echo "Running TPS duration test: $tps_count transactions over $tps_duration seconds"
            node ../tps-tester.js hotstuff duration "$tps_count" "$tps_duration"
        else
            echo "Running TPS burst test with $tps_count transactions"
            node ../tps-tester.js hotstuff burst "$tps_count"
        fi
        return
    fi
    
    if [ -n "$custom_values" ]; then
        IFS=',' read -ra VALUES <<< "$custom_values"
        echo "Using custom values: $custom_values"
    else
        VALUES=()
        for i in $(seq 1 8); do
            VALUES+=($((i*100)))
        done
        echo "Using node-scaled values: ${VALUES[*]}"
    fi
    
    cat > "$FRAMEWORK_DIR/test-metadata.json" << EOF
{
  "submittedValues": [$(IFS=','; echo "${VALUES[*]}")],
  "timestamp": $(date +%s),
  "count": ${#VALUES[@]},
  "algorithm": "HOTSTUFF"
}
EOF
    
    for i in "${!VALUES[@]}"; do
        value=${VALUES[$i]}
        response=$(curl -s --max-time 10 -X POST http://localhost:${PORTS[0]}/api/client \
            -H "Content-Type: application/json" \
            -d "{\"operation\": \"TX\", \"id\": $((i+1)), \"value\": $value}" 2>/dev/null)
        echo "TX$((i+1)) (value: $value) Response: $response"
        sleep 3
    done
    
    echo "Tests completed!"
}

show_stats() {
    echo "=== HOTSTUFF Cluster Statistics ==="
    echo "Topology: full, Nodes: 8"
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    local total_logs=0
    local total_commits=0
    local running_nodes=0
    
    for port in "${PORTS[@]}"; do
        echo "--- Node $port ---"
        if lsof -i :$port >/dev/null 2>&1; then
            running_nodes=$((running_nodes + 1))
            echo "Status: ✅ RUNNING"
            
            # Get commit count
            local commit_count=$(curl -s --max-time 5 http://localhost:$port/api/hotstuff-commit-log 2>/dev/null | grep -o '"committedAt"' | wc -l || echo "0")
            total_commits=$((total_commits + commit_count))
            echo "Committed transactions: $commit_count"
        else
            echo "Status: ❌ STOPPED"
        fi
        echo ""
    done
    
    echo "=== Cluster Summary ==="
    echo "Running nodes: $running_nodes/8"
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
        echo "Topology: full, Nodes: 8"
        exit 1 ;;
esac