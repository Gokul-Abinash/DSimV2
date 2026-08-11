# DistSim Framework - Complete Feature Matrix

## **Comprehensive Algorithm Feature Support**

| Feature | PBFT | SBFT | Raft | Paxos | HotStuff | Prime | MIS | MST-GHS |
|---------|------|------|------|-------|----------|-------|-----|---------|
| **Core Operations** |
| Start/Stop Nodes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Node Status Check | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transaction Testing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️* | ⚠️* |
| Consensus Verification | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Statistics Display | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Log Viewing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Network & Topology** |
| Topology Configuration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Full Mesh Topology | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ring Topology | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Star Topology | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Line Topology | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dynamic Node Count (4-10) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Fault Tolerance** |
| Byzantine Fault Support | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Silent Byzantine Nodes | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Corrupt Byzantine Nodes | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Delay Byzantine Nodes | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Random Byzantine Nodes | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Crash Fault Support | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Network Simulation** |
| Latency Simulation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| LAN Profile (1-5ms) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WAN Profile (50-150ms) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| High Latency (200-800ms) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Unstable Network | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Latency Config | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Latency Distributions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Performance Testing** |
| Single Algorithm Testing | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️** | ❌*** | ❌*** |
| Automated Benchmarking | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️** | ❌*** | ❌*** |
| CSV Report Generation | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️** | ❌*** | ❌*** |
| Performance Metrics | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️** | ❌*** | ❌*** |
| Success Rate Analysis | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️** | ❌*** | ❌*** |
| Duration Measurements | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️** | ❌*** | ❌*** |
| **Security & Cryptography** |
| Digital Signatures | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Message Authentication | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Key Management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Deployment Options** |
| Localhost Deployment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-Machine Config | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Docker Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cloud Deployment Config | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Automated Setup Scripts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Monitoring & Debugging** |
| Real-time Logging | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Commit Log Tracking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Protocol State Display | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Node Health Monitoring | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Error Handling | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **API & Integration** |
| REST API Endpoints | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| JSON Message Format | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HTTP Client Interface | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLI Integration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Algorithm-Specific Features** |
| View Changes | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Leader Election | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Log Replication | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Three-Phase Protocol | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Collector Nodes | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Threshold Signatures | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Graph Algorithms | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Independent Set | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Spanning Tree | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## **Legend**
- ✅ **Fully Implemented** - Feature is complete and tested
- ⚠️* **Graph Algorithm** - Uses different testing pattern (not transaction-based)
- ⚠️** **Implemented but Not in Benchmark** - Feature exists but not included in automated testing
- ❌*** **Not Applicable** - Graph algorithms don't use transaction-based performance testing
- ❌ **Not Supported** - Feature not available for this algorithm

## **Algorithm Categories**

### **Byzantine Fault Tolerant (BFT)**
- **PBFT, SBFT, HotStuff, Prime** - Support Byzantine failures (f < n/3)
- Full cryptographic security with digital signatures
- Handle malicious/arbitrary node behavior

### **Crash Fault Tolerant (CFT)**  
- **Raft, Paxos** - Support crash failures (f < n/2)
- Assume nodes fail by stopping (no malicious behavior)
- Focus on availability and partition tolerance

### **Graph Algorithms**
- **MIS, MST-GHS** - Distributed graph computation
- Different execution model (not transaction-based)
- Focus on graph properties and distributed coordination

## **Common Commands for All Algorithms**

### **Basic Operations**
```bash
bash dsim-cli.sh <algorithm> start    # ✅ All algorithms
bash dsim-cli.sh <algorithm> stop     # ✅ All algorithms  
bash dsim-cli.sh <algorithm> status   # ✅ All algorithms
bash dsim-cli.sh <algorithm> test     # ✅ All algorithms
bash dsim-cli.sh <algorithm> verify   # ✅ All algorithms
bash dsim-cli.sh <algorithm> stats    # ✅ All algorithms
bash dsim-cli.sh <algorithm> logs     # ✅ All algorithms
```

### **Network Simulation**
```bash
bash dsim-cli.sh latency <profile>    # ✅ All algorithms
bash dsim-cli.sh latency show         # ✅ All algorithms
```

### **Topology Configuration**
```bash
bash dsim-cli.sh topology <n> <type>  # ✅ All algorithms
bash dsim-cli.sh topology show        # ✅ All algorithms
```

### **Performance Testing**
```bash
node test-latency.js <algorithm> <profile>  # ✅ Consensus algorithms only
node test-latency.js full                   # ✅ Consensus algorithms only
```

## **Fault Tolerance Limits**

| Algorithm | Max Byzantine Faults | Max Crash Faults | Min Nodes |
|-----------|----------------------|-------------------|-----------|
| PBFT      | f < n/3              | N/A               | 4         |
| SBFT      | f < n/3              | N/A               | 4         |
| HotStuff  | f < n/3              | N/A               | 4         |
| Prime     | f < n/3              | N/A               | 4         |
| Raft      | N/A                  | f < n/2           | 3         |
| Paxos     | N/A                  | f < n/2           | 3         |
| MIS       | N/A                  | N/A               | 2         |
| MST-GHS   | N/A                  | N/A               | 2         |

This comprehensive matrix shows that the DistSim framework provides extensive feature coverage across all implemented algorithms, with network latency simulation and deployment options available universally.