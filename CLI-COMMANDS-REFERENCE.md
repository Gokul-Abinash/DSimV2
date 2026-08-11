# DistSim CLI Commands Reference

## **Command Structure**
```bash
bash dsim-cli.sh <command> [options]
```

## **Basic Commands**

### **topology** - Network configuration
```bash
bash dsim-cli.sh topology <nodes> <type> [--byzantine=behavior:count] [--crash=crash:count]
bash dsim-cli.sh topology show
```
**Options:**
- `<nodes>`: 4-22
- `<type>`: full, ring, star, line
- `--byzantine`: silent:N, corrupt:N, delay:N, random:N
- `--crash`: crash:N

### **latency** - Network conditions
```bash
bash dsim-cli.sh latency <profile>
bash dsim-cli.sh latency custom <min> <max> <distribution>
bash dsim-cli.sh latency show
```
**Options:**
- `<profile>`: none, lan, wan, high, unstable
- `<distribution>`: fixed, uniform, normal, exponential

### **<algorithm>** - Protocol control
```bash
bash dsim-cli.sh <algorithm> <action> [options]
```
**Algorithms:** pbft, sbft, raft, paxos, hotstuff, prime, mis, mstghs
**Actions:** start, stop, status, test, verify, stats, logs
**Test Options:** --values X,Y,Z | --count N | --duration S | --tps

### **benchmark** - Performance testing
```bash
bash dsim-cli.sh benchmark latency <algorithm|full>
bash dsim-cli.sh benchmark scalability [algorithm]
```

### **stop-all** - Emergency stop
```bash
bash dsim-cli.sh stop-all
```

## **Workflow Examples**

### **Level 1: Basic Test**
```bash
bash dsim-cli.sh topology 4 full && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test && bash dsim-cli.sh pbft verify
```

### **Level 2: Fault Testing**
```bash
bash dsim-cli.sh topology 7 full --byzantine=corrupt:1 && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test --values 100,200,300 && bash dsim-cli.sh pbft verify
```

### **Level 3: Multi-Algorithm**
```bash
bash dsim-cli.sh topology 6 full && for algo in pbft raft paxos; do bash dsim-cli.sh $algo start && bash dsim-cli.sh $algo test && bash dsim-cli.sh $algo verify && bash dsim-cli.sh $algo stop; done
```

### **Level 4: Research Benchmark**
```bash
bash dsim-cli.sh benchmark latency full && bash dsim-cli.sh benchmark scalability
```

### **Level 5: Production Test**
```bash
bash dsim-cli.sh topology 12 full --byzantine=silent:2,corrupt:1 && bash dsim-cli.sh latency wan && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test --count 500 --duration 120 && bash dsim-cli.sh pbft verify
```cation and analysis
bash dsim-cli.sh pbft verify && \
bash dsim-cli.sh pbft stats && \
bash dsim-cli.sh pbft logs && \

# Performance metrics
bash dsim-cli.sh pbft test --tps && \
bash dsim-cli.sh benchmark latency pbft
```
*Production-scale testing with high load, multiple faults, and comprehensive analysis*

## **Utility Commands**

### **System Management**
```bash
pkill -f "node index.js"                           # Force kill all nodes
bash dsim-cli.sh stop-all                          # Graceful stop all protocols
```

### **Quick Status Check**
```bash
bash dsim-cli.sh topology show && bash dsim-cli.sh latency show
```
*Show current topology and latency configuration*

### **Clean Reset**
```bash
bash dsim-cli.sh stop-all && bash dsim-cli.sh latency none && bash dsim-cli.sh topology 4 full
```
*Reset to clean state with basic 4-node topology*