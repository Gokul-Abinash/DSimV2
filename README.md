# DistSim - Distributed Consensus Simulation Framework

## **Quick Commands**

### **Topology Setup**
```bash
bash dsim-cli.sh topology <nodes> <type> [--byzantine behavior:count,...]
bash dsim-cli.sh topology <nodes> <type> [--crash crash:count]
bash dsim-cli.sh topology show                  # Show current topology
```

### **Algorithm Commands**
```bash
bash dsim-cli.sh <algorithm> start              # Start nodes
bash dsim-cli.sh <algorithm> stop               # Stop nodes  
bash dsim-cli.sh stop-all                       # Stop all protocols
bash dsim-cli.sh <algorithm> status             # Show status
bash dsim-cli.sh <algorithm> test [--values]    # Run tests
bash dsim-cli.sh <algorithm> verify             # Verify consensus
bash dsim-cli.sh <algorithm> stats              # Show statistics
bash dsim-cli.sh <algorithm> logs               # View node logs
```

### **Latency Simulation Commands**
```bash
bash dsim-cli.sh latency <profile>              # Set latency profile
bash dsim-cli.sh latency show                   # Show current latency
bash dsim-cli.sh latency custom <min> <max> <dist> # Custom latency
```

### **Benchmark Commands**
```bash
bash dsim-cli.sh benchmark latency <algorithm>  # Single algorithm latency test
bash dsim-cli.sh benchmark latency full         # Full latency benchmark
bash dsim-cli.sh benchmark scalability          # Full scalability benchmark
bash dsim-cli.sh benchmark scalability <algorithm> # Single algorithm scalability
```

**Algorithms:** `pbft`, `sbft`, `raft`, `paxos`, `hotstuff`, `prime`, `mis`, `mstghs`

**Latency Profiles:** `none`, `lan`, `wan`, `high`, `unstable`, `custom`

**📋 [Complete Feature Matrix](FEATURE-MATRIX.md)** - Detailed feature support across all algorithms

---

## **Command Reference**

### **1. Topology Configuration**
```bash
# Basic topologies
bash dsim-cli.sh topology 4 full
bash dsim-cli.sh topology 6 ring  
bash dsim-cli.sh topology 8 star

# With Byzantine nodes (for PBFT/SBFT/HotStuff)
bash dsim-cli.sh topology 7 full --byzantine=silent:1
bash dsim-cli.sh topology 8 full --byzantine=corrupt:1,delay:1

# With crash failures (for Raft/Paxos)
bash dsim-cli.sh topology 5 full --crash=crash:2
bash dsim-cli.sh topology 6 ring --crash=crash:1

# Show current topology
bash dsim-cli.sh topology show
```

**Node counts:** 4-10  
**Topology types:** `full`, `ring`, `star`, `line`  
**Byzantine behaviors** (for PBFT/SBFT/HotStuff):
- `silent` - Node stops responding after initial messages
- `corrupt` - Node modifies transaction values randomly  
- `delay` - Node introduces network delays
- `random` - Node exhibits unpredictable malicious behavior

**Crash failures** (for Raft/Paxos):
- `crash` - Node completely stops responding (simulates crash failure)

### **Latency Configuration**
```bash
# Set latency profiles
bash dsim-cli.sh latency none        # No latency (ideal network)
bash dsim-cli.sh latency lan         # LAN conditions (1-5ms)
bash dsim-cli.sh latency wan         # WAN conditions (50-150ms)
bash dsim-cli.sh latency high        # High latency (200-800ms)
bash dsim-cli.sh latency unstable    # Variable/unstable network

# Custom latency
bash dsim-cli.sh latency custom 100 300 normal  # 100-300ms normal distribution
bash dsim-cli.sh latency custom 50 50 fixed     # Fixed 50ms latency

# Show current latency configuration
bash dsim-cli.sh latency show
```

**Latency Distributions:**
- `fixed` - Constant latency
- `uniform` - Random between min-max
- `normal` - Normal distribution (bell curve)
- `exponential` - Exponential distribution (simulates network congestion)

**Latency Profile Details:**
- **`none`**: 0ms delay (baseline performance)
- **`lan`**: 1-5ms (local network conditions)
- **`wan`**: 50-150ms (internet/wide area network)
- **`high`**: 200-800ms (satellite/poor connection)
- **`unstable`**: 10-500ms (variable/unstable network)

### **2. Start Nodes**
```bash
bash dsim-cli.sh pbft start
bash dsim-cli.sh sbft start
bash dsim-cli.sh raft start
bash dsim-cli.sh paxos start
bash dsim-cli.sh hotstuff start
```

### **3. Stop Nodes**
```bash
bash dsim-cli.sh pbft stop
# Or stop all protocols at once
bash dsim-cli.sh stop-all
```

### **4. Check Status**
```bash
bash dsim-cli.sh pbft status
```
Shows node IDs, ports, and Byzantine behavior.

### **5. Run Tests**
```bash
# Default test (node-scaled values)
bash dsim-cli.sh pbft test

# Custom values
bash dsim-cli.sh pbft test --values 111,222,333
bash dsim-cli.sh sbft test --values 4,5,6
bash dsim-cli.sh raft test --values 10,20,30
bash dsim-cli.sh paxos test --values 99,88,77
bash dsim-cli.sh hotstuff test --values 1,2,3

# TPS Performance Testing
Test Options:
  test --values 100,200,300        # Custom transaction values
  test --count 100                 # TPS burst test (100 transactions)
  test --count 50 --duration 30    # TPS duration test (50 tx over 30s)
  test --tps                       # Show TPS metrics
bash dsim-cli.sh pbft test --count 100 --burst     # Send 100 transactions instantly
bash dsim-cli.sh pbft test --count 50 --duration 10 # Send 50 transactions over 10 seconds
bash dsim-cli.sh pbft test --tps                   # Show TPS metrics
```

### **6. Verify Consensus**
```bash
bash dsim-cli.sh pbft verify
bash dsim-cli.sh sbft verify
bash dsim-cli.sh raft verify
bash dsim-cli.sh paxos verify
bash dsim-cli.sh hotstuff verify
```

### **7. Show Statistics**
```bash
bash dsim-cli.sh pbft stats
```

### **8. View Logs**
```bash
bash dsim-cli.sh pbft logs
bash dsim-cli.sh sbft logs
bash dsim-cli.sh raft logs
bash dsim-cli.sh paxos logs
bash dsim-cli.sh hotstuff logs
```
Shows protocol logs and commit logs for debugging.

---

## **Common Workflows**

### **Basic Testing**
```bash
bash dsim-cli.sh topology 4 full
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test
bash dsim-cli.sh pbft verify
```

### **Byzantine Testing**
```bash
bash dsim-cli.sh topology 7 full --byzantine=corrupt:1
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
bash dsim-cli.sh pbft status
```

### **Crash Failure Testing**
```bash
bash dsim-cli.sh topology 5 full --crash=crash:2
bash dsim-cli.sh raft start
bash dsim-cli.sh raft test --values 10,20,30
bash dsim-cli.sh raft verify
bash dsim-cli.sh raft status
```

### **Multi-Algorithm Comparison**
```bash
bash dsim-cli.sh topology 6 full

bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test
bash dsim-cli.sh raft start && bash dsim-cli.sh raft test  
bash dsim-cli.sh paxos start && bash dsim-cli.sh paxos test
bash dsim-cli.sh hotstuff start && bash dsim-cli.sh hotstuff test
```

### **Network Latency Simulation**

#### **Basic Latency Control:**
```bash
# Set different latency profiles
bash dsim-cli.sh latency none        # No latency (0ms)
bash dsim-cli.sh latency lan         # LAN conditions (1-5ms)
bash dsim-cli.sh latency wan         # WAN conditions (50-150ms)
bash dsim-cli.sh latency high        # High latency (200-800ms)
bash dsim-cli.sh latency unstable    # Variable network (10-500ms)

# Check current latency setting
bash dsim-cli.sh latency show
```

#### **Custom Latency:**
```bash
# Fixed 100ms latency
bash dsim-cli.sh latency custom 100 100 fixed

# Random 50-200ms latency
bash dsim-cli.sh latency custom 50 200 uniform

# Normal distribution around 100ms
bash dsim-cli.sh latency custom 80 120 normal
```

#### **Test Algorithm with Latency:**
```bash
# Setup topology
bash dsim-cli.sh topology 4 full

# Set latency profile
bash dsim-cli.sh latency wan

# Test PBFT with WAN latency
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
bash dsim-cli.sh pbft stop
```

### **Performance Testing & CSV Reports**

#### **Single Algorithm Test:**
```bash
# Test PBFT under LAN conditions (5 iterations)
bash dsim-cli.sh benchmark latency pbft
```

#### **Full Benchmark:**
```bash
# Tests all 5 algorithms under all 5 latency profiles
# Generates timestamped CSV report automatically
bash dsim-cli.sh benchmark latency full
```

#### **Scalability Benchmark:**
```bash
# Test all algorithms across different replica counts (4-8 nodes)
# Measures both latency and TPS performance
# Tests: 5 algorithms × 5 replica counts × 3 latency profiles × 3 iterations = 225 tests
bash dsim-cli.sh benchmark scalability

# Test single algorithm across replica counts
# Tests: 1 algorithm × 5 replica counts × 3 latency profiles × 3 iterations = 45 tests
bash dsim-cli.sh benchmark scalability pbft
bash dsim-cli.sh benchmark scalability raft
bash dsim-cli.sh benchmark scalability hotstuff
```

#### **CSV Report Output:**
Generates file: `latency-benchmark-YYYY-MM-DDTHH-MM-SS.csv`

**CSV Columns:**
- Algorithm name
- Latency profile  
- Success rate (%)
- Average duration (ms)
- Min/Max duration
- Total tests run
- Failed tests count

#### **Example CSV Output:**
```csv
Algorithm,Latency_Profile,Success_Rate_%,Avg_Duration_ms,Min_Duration_ms,Max_Duration_ms,Total_Tests,Failed_Tests
pbft,none,100.0,2500,2400,2600,3,0
pbft,lan,100.0,2800,2700,2900,3,0
pbft,wan,100.0,5200,5100,5300,3,0
```

### **Step-by-Step Performance Testing Example**

#### **Test PBFT Under Different Network Conditions:**
```bash
# 1. Setup 4-node topology
bash dsim-cli.sh topology 4 full

# 2. Test under ideal conditions
bash dsim-cli.sh latency none
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
bash dsim-cli.sh pbft stop

# 3. Test under LAN conditions
bash dsim-cli.sh latency lan
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
bash dsim-cli.sh pbft stop

# 4. Test under WAN conditions
bash dsim-cli.sh latency wan
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
bash dsim-cli.sh pbft stop

# 5. Reset latency
bash dsim-cli.sh latency none
```

#### **Automated Performance Comparison:**
```bash
# Compare PBFT vs RAFT latency performance
bash dsim-cli.sh benchmark latency pbft
bash dsim-cli.sh benchmark latency raft

# Full benchmark (takes ~15-20 minutes)
# Tests: 5 algorithms × 5 latency profiles × 3 iterations = 75 tests
bash dsim-cli.sh benchmark latency full

# Scalability analysis (takes ~45-60 minutes)
# Tests performance across different network sizes
bash dsim-cli.sh benchmark scalability
```

### **Latency + Byzantine Testing**
```bash
# Setup Byzantine nodes with high latency
bash dsim-cli.sh topology 7 full --byzantine=delay:1,corrupt:1
bash dsim-cli.sh latency wan
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
```

### **TPS (Transactions Per Second) Testing**

#### **Burst Testing:**
```bash
# Send 100 transactions instantly (burst mode is default)
bash dsim-cli.sh pbft test --count 100
# Result: "Peak TPS: 45 tx/sec"

# Send 50 transactions instantly
bash dsim-cli.sh raft test --count 50 --burst
```

#### **Duration Testing:**
```bash
# Send 100 transactions over 30 seconds
bash dsim-cli.sh pbft test --count 100 --duration 30
# Result: "Sustained TPS: 3.3 tx/sec"

# Send 200 transactions over 60 seconds
bash dsim-cli.sh hotstuff test --count 200 --duration 60
```

#### **TPS Metrics:**
```bash
# Show detailed TPS statistics
bash dsim-cli.sh pbft test --tps
# Shows: Peak TPS, Average TPS, Success Rate, Latency Distribution
```

### **Quick Commands Summary**
```bash
# Basic latency testing
bash dsim-cli.sh latency wan && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test

# Single algorithm performance test
bash dsim-cli.sh benchmark latency pbft

# Full performance benchmark with CSV
bash dsim-cli.sh benchmark latency full

# Scalability benchmark (latency + TPS across replica counts)
bash dsim-cli.sh benchmark scalability

# Single algorithm scalability test
bash dsim-cli.sh benchmark scalability pbft

# TPS burst testing
bash dsim-cli.sh pbft test --count 100 --burst

# Check current latency setting
bash dsim-cli.sh latency show
```*
```bash
# Setup Byzantine nodes with high latency
bash dsim-cli.sh topology 7 full --byzantine=delay:1,corrupt:1
bash dsim-cli.sh latency wan
bash dsim-cli.sh pbft start
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft verify
```

### **Quick Commands Summary**
```bash
# Basic latency testing
bash dsim-cli.sh latency wan && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test

# Single algorithm performance test
node test-latency.js pbft high

# Full performance benchmark with CSV
node test-latency.js full

# Check current latency setting
bash dsim-cli.sh latency show
```

### **Stop All Nodes**
```bash
bash dsim-cli.sh stop-all
# Or force kill all nodes
pkill -f "node index.js"
```

---

## **Port Assignments**
- **Node A**: 3001 (Primary/Leader)
- **Node B**: 3002 (Backup/Follower)
- **Node C**: 3003 (Backup/Follower)
- **Node D**: 3004 (Backup/Follower)
- **Node E**: 3005 (Backup/Follower)
- **Node F**: 3006 (Backup/Follower)
- **Node G**: 3007 (Backup/Follower)
- **Node H**: 3008 (Backup/Follower)

---

## **Algorithm Fault Tolerance**
- **PBFT/SBFT/HotStuff**: f < n/3 Byzantine nodes
- **Raft/Paxos**: f < n/2 crash faults (no Byzantine support)