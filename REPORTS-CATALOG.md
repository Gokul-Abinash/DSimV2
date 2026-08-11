# DistSim Framework - Reports Catalog

## **Performance Reports**

### 1. **Latency Benchmark Report**
```bash
bash dsim-cli.sh benchmark latency full
```
**Output**: `latency-benchmark-YYYY-MM-DDTHH-MM-SS.csv`

**Columns**:
- Algorithm name (PBFT, SBFT, Raft, Paxos, HotStuff)
- Latency profile (none, lan, wan, high, unstable)
- Success rate (%)
- Average duration (ms)
- Min/Max duration (ms)
- Total tests run
- Failed tests count

**Use Cases**:
- Algorithm performance comparison
- Network condition impact analysis
- Consensus latency benchmarking

### 2. **Scalability Report**
```bash
bash dsim-cli.sh benchmark scalability
```
**Metrics**:
- Performance across replica counts (4-8 nodes)
- TPS scaling analysis
- Latency vs. node count correlation
- Algorithm efficiency comparison

### 3. **TPS Performance Report**
```bash
bash dsim-cli.sh <algorithm> test --tps
```
**Metrics**:
- Peak TPS (transactions per second)
- Sustained TPS over duration
- Success rate percentage
- Latency distribution
- Throughput under different loads

## **Consensus Analysis Reports**

### 4. **Consensus Verification Report**
```bash
bash dsim-cli.sh <algorithm> verify
```
**Output**:
- Node-by-node consensus state
- Transaction consistency check
- Byzantine fault detection
- Commit log validation

### 5. **Byzantine Behavior Analysis**
```bash
bash dsim-cli.sh <algorithm> stats
```
**Metrics**:
- Byzantine node impact on consensus
- Message corruption detection
- Silent node behavior tracking
- Delay injection analysis

### 6. **Fault Tolerance Report**
**For Byzantine Algorithms (PBFT/SBFT/HotStuff)**:
- f < n/3 Byzantine fault tolerance
- Corruption resistance analysis
- Silent node handling
- Delay attack mitigation

**For Crash Fault Algorithms (Raft/Paxos)**:
- f < n/2 crash fault tolerance
- Leader election efficiency
- Recovery time analysis

## **Network Simulation Reports**

### 7. **Network Latency Impact Report**
**Profiles Tested**:
- None (0ms baseline)
- LAN (1-5ms)
- WAN (50-150ms)
- High (200-800ms)
- Unstable (10-500ms)

**Metrics**:
- Consensus time vs. latency
- Message timeout analysis
- Network partition recovery
- Jitter impact assessment

### 8. **Topology Performance Report**
**Topologies**:
- Full mesh (optimal connectivity)
- Ring (sequential propagation)
- Star (hub-based routing)
- Line (linear propagation)

**Analysis**:
- Message propagation efficiency
- Single point of failure impact
- Bandwidth utilization
- Fault isolation capabilities

## **Algorithm Comparison Reports**

### 9. **Multi-Algorithm Benchmark**
```bash
# Compare all algorithms under same conditions
bash dsim-cli.sh topology 6 full
for algo in pbft sbft raft paxos hotstuff; do
  bash dsim-cli.sh $algo start && bash dsim-cli.sh $algo test
done
```

**Comparison Metrics**:
- Consensus latency
- TPS performance
- Fault tolerance
- Resource utilization
- Message complexity

### 10. **Byzantine vs. Crash Fault Comparison**
**Byzantine Algorithms**: PBFT, SBFT, HotStuff, Prime
**Crash Fault Algorithms**: Raft, Paxos

**Analysis**:
- Performance overhead of Byzantine tolerance
- Security vs. efficiency trade-offs
- Fault model suitability

## **Operational Reports**

### 11. **Node Status Report**
```bash
bash dsim-cli.sh <algorithm> status
```
**Information**:
- Node IDs and ports
- Current roles (Primary/Leader/Backup/Follower)
- Byzantine behavior assignments
- Connection status

### 12. **System Logs Report**
```bash
bash dsim-cli.sh <algorithm> logs
```
**Content**:
- Protocol phase transitions
- Message exchange logs
- Error and timeout events
- Consensus decision points
- Byzantine behavior logs

### 13. **Real-time Statistics Report**
```bash
bash dsim-cli.sh <algorithm> stats
```
**Live Metrics**:
- Current TPS
- Active connections
- Message queue status
- Memory usage
- CPU utilization

## **Research & Analysis Reports**

### 14. **Consensus Safety Report**
**Safety Properties**:
- Agreement: All honest nodes decide same value
- Validity: Decided value was proposed
- Termination: All honest nodes eventually decide

**Verification**:
- Mathematical proof validation
- Empirical testing results
- Edge case analysis

### 15. **Liveness Analysis Report**
**Liveness Properties**:
- Progress guarantee under network conditions
- Recovery from failures
- Timeout and retry mechanisms
- Deadlock prevention

### 16. **Security Analysis Report**
**For Byzantine Algorithms**:
- Cryptographic signature verification
- Message authentication success rate
- Attack resistance (corruption, delay, silent)
- Key management security

## **Custom Reports**

### 17. **Workload-Specific Reports**
```bash
# Custom transaction patterns
bash dsim-cli.sh pbft test --values 100,200,300
bash dsim-cli.sh pbft test --count 100 --duration 30
```

**Customizable Metrics**:
- Transaction value distribution
- Burst vs. sustained load
- Custom latency profiles
- Specific fault injection

### 18. **Comparative Analysis Report**
**Cross-Algorithm Studies**:
- Performance under identical conditions
- Scalability curves
- Fault tolerance boundaries
- Resource consumption patterns

## **Report Generation Commands**

### Automated Report Generation
```bash
# Generate comprehensive performance report
bash dsim-cli.sh benchmark latency full > performance-report.txt

# Generate scalability analysis
bash dsim-cli.sh benchmark scalability > scalability-report.txt

# Generate algorithm comparison
for algo in pbft raft paxos; do
  echo "=== $algo ===" >> comparison-report.txt
  bash dsim-cli.sh $algo stats >> comparison-report.txt
done
```

### Export Formats
- **CSV**: Structured data for analysis
- **JSON**: API-compatible format
- **TXT**: Human-readable logs
- **Timestamped**: Automatic file naming

## **Report Use Cases**

### Academic Research
- Algorithm performance studies
- Consensus mechanism comparison
- Network condition impact analysis
- Fault tolerance evaluation

### System Design
- Architecture decision support
- Performance requirement validation
- Scalability planning
- Fault tolerance design

### Operational Monitoring
- System health assessment
- Performance degradation detection
- Capacity planning
- Incident analysis