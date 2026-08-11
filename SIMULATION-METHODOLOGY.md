# DistSim Framework: Simulation Methodology

## **1. Introduction**

The DistSim (Distributed Consensus Simulation) framework provides a comprehensive testbed for evaluating distributed consensus algorithms under various network conditions and fault scenarios. This methodology outlines the systematic approach for conducting reproducible experiments and performance evaluations using the framework.

### **1.1 Framework Overview**

DistSim implements eight consensus algorithms across different fault tolerance models:
- **Byzantine Fault Tolerant**: PBFT, SBFT, HotStuff, Prime
- **Crash Fault Tolerant**: Raft, Paxos  
- **Graph Algorithms**: MIS (Maximal Independent Set), MST-GHS (Minimum Spanning Tree)

The framework supports configurable network topologies, latency profiles, and fault injection mechanisms to simulate real-world distributed system conditions.

### **1.2 Simulation Objectives**

The primary objectives of DistSim simulations include:
- **Performance Comparison**: Evaluate throughput, latency, and scalability across algorithms
- **Fault Tolerance Analysis**: Assess resilience under Byzantine and crash failures
- **Network Impact Study**: Analyze performance degradation under various network conditions
- **Scalability Assessment**: Determine optimal node counts for different algorithms
- **Security Evaluation**: Validate cryptographic mechanisms and attack resistance

## **2. Experimental Design**

### **2.1 Simulation Environment Setup**

#### **2.1.1 System Requirements**
- **Operating System**: macOS/Linux/Windows
- **Runtime**: Node.js 14+ with npm package manager
- **Memory**: Minimum 4GB RAM for up to 10 nodes
- **Storage**: 2GB free space for logs and reports
- **Network**: Localhost simulation with configurable latency

#### **2.1.2 Framework Initialization**
```bash
# Key generation for cryptographic operations
node generate-keys.js

# Verify framework installation
bash dsim-cli.sh topology show
bash dsim-cli.sh latency show
```

### **2.2 Experimental Variables**

#### **2.2.1 Independent Variables**
- **Algorithm Type**: {PBFT, SBFT, Raft, Paxos, HotStuff, Prime, MIS, MST-GHS}
- **Node Count**: {4, 6, 8, 10, 12, 15, 20} nodes
- **Network Topology**: {full_mesh, ring, star, line}
- **Latency Profile**: {none, lan, wan, high, unstable, custom}
- **Fault Configuration**: Byzantine behaviors, crash failures
- **Transaction Load**: Burst vs. sustained transaction patterns

#### **2.2.2 Dependent Variables**
- **Performance Metrics**: TPS, average latency, success rate
- **Scalability Metrics**: Performance degradation with node count
- **Fault Tolerance**: Recovery time, consensus maintenance
- **Resource Utilization**: CPU, memory, network I/O
- **Security Metrics**: Attack detection rate, signature verification

### **2.3 Experimental Procedures**

#### **2.3.1 Baseline Performance Testing**
```bash
# Standard 4-node configuration with no latency
bash dsim-cli.sh topology 4 full
bash dsim-cli.sh latency none
bash dsim-cli.sh <algorithm> start
bash dsim-cli.sh <algorithm> test --count 100
bash dsim-cli.sh <algorithm> verify
bash dsim-cli.sh <algorithm> stats
```

#### **2.3.2 Scalability Analysis**
```bash
# Automated scalability testing across node counts
bash dsim-cli.sh benchmark scalability <algorithm>

# Manual scalability testing
for nodes in 4 6 8 10; do
  bash dsim-cli.sh topology $nodes full
  bash dsim-cli.sh <algorithm> start
  bash dsim-cli.sh <algorithm> test --count 100
  bash dsim-cli.sh <algorithm> verify
  bash dsim-cli.sh <algorithm> stop
done
```

#### **2.3.3 Network Latency Impact Study**
```bash
# Comprehensive latency analysis
bash dsim-cli.sh benchmark latency full

# Individual latency profile testing
for profile in none lan wan high unstable; do
  bash dsim-cli.sh latency $profile
  bash dsim-cli.sh <algorithm> start
  bash dsim-cli.sh <algorithm> test --count 100
  bash dsim-cli.sh <algorithm> verify
  bash dsim-cli.sh <algorithm> stop
done
```

#### **2.3.4 Fault Tolerance Evaluation**
```bash
# Byzantine fault testing (for PBFT, SBFT, HotStuff, Prime)
bash dsim-cli.sh topology 7 full --byzantine=corrupt:1,silent:1
bash dsim-cli.sh <algorithm> start
bash dsim-cli.sh <algorithm> test --values 100,200,300
bash dsim-cli.sh <algorithm> verify

# Crash fault testing (for Raft, Paxos)
bash dsim-cli.sh topology 5 full --crash=crash:2
bash dsim-cli.sh <algorithm> start
bash dsim-cli.sh <algorithm> test --values 100,200,300
bash dsim-cli.sh <algorithm> verify
```

## **3. Data Collection and Analysis**

### **3.1 Metrics Collection**

#### **3.1.1 Performance Metrics**
- **Throughput (TPS)**: Transactions processed per second
- **Latency**: Average time from transaction submission to consensus
- **Success Rate**: Percentage of successfully processed transactions
- **Response Time Distribution**: P50, P95, P99 latency percentiles

#### **3.1.2 System Metrics**
- **Resource Utilization**: CPU usage, memory consumption, network I/O
- **Message Complexity**: Total messages exchanged per consensus round
- **Consensus Rounds**: Number of rounds required for agreement
- **View Changes**: Frequency of leader/primary changes

#### **3.1.3 Fault Tolerance Metrics**
- **Recovery Time**: Time to restore consensus after fault injection
- **Detection Rate**: Percentage of Byzantine faults correctly identified
- **Safety Violations**: Instances of inconsistent state across nodes
- **Liveness Violations**: Periods where consensus cannot be achieved

### **3.2 Data Export and Storage**

#### **3.2.1 Automated Report Generation**
```bash
# Generate comprehensive CSV reports
bash dsim-cli.sh benchmark latency full > latency-report.csv
bash dsim-cli.sh benchmark scalability > scalability-report.csv

# Export real-time statistics
bash dsim-cli.sh <algorithm> stats > performance-stats.json
bash dsim-cli.sh <algorithm> logs > protocol-logs.txt
```

#### **3.2.2 Data Format Standards**
- **CSV Format**: Structured data for statistical analysis
- **JSON Format**: Hierarchical data for programmatic processing  
- **Timestamped Files**: Automatic file naming with execution timestamps
- **Log Aggregation**: Centralized logging for debugging and analysis

### **3.3 Statistical Analysis Methods**

#### **3.3.1 Comparative Analysis**
- **ANOVA Testing**: Compare performance across multiple algorithms
- **Paired t-tests**: Statistical significance of performance differences
- **Regression Analysis**: Relationship between node count and performance
- **Correlation Analysis**: Network latency impact on consensus time

#### **3.3.2 Reliability Analysis**
- **Confidence Intervals**: 95% confidence bounds for performance metrics
- **Outlier Detection**: Identify and handle anomalous measurements
- **Repeatability Testing**: Multiple runs to ensure result consistency
- **Sensitivity Analysis**: Impact of parameter variations on outcomes

## **4. Experimental Scenarios**

### **4.1 Algorithm Comparison Study**

#### **4.1.1 Objective**
Compare the performance characteristics of all implemented consensus algorithms under identical conditions.

#### **4.1.2 Methodology**
```bash
# Standardized comparison protocol
bash dsim-cli.sh topology 6 full
bash dsim-cli.sh latency lan

algorithms=("pbft" "sbft" "raft" "paxos" "hotstuff" "prime")
for algo in "${algorithms[@]}"; do
  echo "Testing $algo..."
  bash dsim-cli.sh $algo start
  bash dsim-cli.sh $algo test --count 100
  bash dsim-cli.sh $algo verify
  bash dsim-cli.sh $algo stats >> comparison-results.txt
  bash dsim-cli.sh $algo stop
  sleep 5
done
```

#### **4.1.3 Expected Outcomes**
- Performance ranking across algorithms
- Trade-offs between security and efficiency
- Optimal algorithm selection criteria

### **4.2 Byzantine Resilience Study**

#### **4.2.1 Objective**
Evaluate the resilience of Byzantine fault-tolerant algorithms under various attack scenarios.

#### **4.2.2 Methodology**
```bash
# Progressive Byzantine fault injection
for faults in 1 2; do
  bash dsim-cli.sh topology $((3*faults + 1)) full --byzantine=corrupt:$faults
  
  for algo in pbft sbft hotstuff prime; do
    bash dsim-cli.sh $algo start
    bash dsim-cli.sh $algo test --count 50 --duration 60
    bash dsim-cli.sh $algo verify
    bash dsim-cli.sh $algo logs >> byzantine-analysis-$algo-$faults.log
    bash dsim-cli.sh $algo stop
  done
done
```

#### **4.2.3 Attack Scenarios**
- **Corruption Attacks**: Nodes modify transaction values
- **Delay Attacks**: Nodes introduce artificial message delays
- **Silent Attacks**: Nodes stop responding after initial participation
- **Mixed Attacks**: Combination of multiple Byzantine behaviors

### **4.3 Network Partition Tolerance**

#### **4.3.1 Objective**
Assess algorithm behavior during network partitions and recovery scenarios.

#### **4.3.2 Methodology**
```bash
# Simulate network partition scenarios
bash dsim-cli.sh topology 8 full
bash dsim-cli.sh latency wan

# Test partition tolerance
bash dsim-cli.sh <algorithm> start
bash dsim-cli.sh <algorithm> test --count 20
# Manually simulate partition by stopping subset of nodes
bash dsim-cli.sh <algorithm> verify
```

### **4.4 Scalability Limits Study**

#### **4.4.1 Objective**
Determine the practical scalability limits for each consensus algorithm.

#### **4.4.2 Methodology**
```bash
# Progressive node count testing
bash dsim-cli.sh benchmark scalability

# Extended scalability testing
for nodes in 12 15 20 25; do
  bash dsim-cli.sh topology $nodes full
  bash dsim-cli.sh latency none
  
  for algo in pbft raft paxos; do
    timeout 300 bash dsim-cli.sh $algo start
    timeout 300 bash dsim-cli.sh $algo test --count 50
    bash dsim-cli.sh $algo verify
    bash dsim-cli.sh stop-all
  done
done
```

## **5. Validation and Verification**

### **5.1 Correctness Validation**

#### **5.1.1 Safety Properties**
- **Agreement**: All honest nodes decide on the same value
- **Validity**: The decided value was proposed by some node
- **Integrity**: Each node decides at most once

#### **5.1.2 Liveness Properties**
- **Termination**: All honest nodes eventually decide
- **Progress**: The system continues to process new transactions
- **Responsiveness**: Decisions are made within reasonable time bounds

### **5.2 Performance Validation**

#### **5.2.1 Baseline Verification**
```bash
# Verify expected performance characteristics
bash dsim-cli.sh topology 4 full
bash dsim-cli.sh latency none
bash dsim-cli.sh raft start
bash dsim-cli.sh raft test --count 100
# Expected: >50 TPS, <100ms latency
```

#### **5.2.2 Regression Testing**
- **Performance Benchmarks**: Maintain historical performance baselines
- **Automated Testing**: Continuous integration with performance thresholds
- **Anomaly Detection**: Identify unexpected performance degradations

### **5.3 Reproducibility Requirements**

#### **5.3.1 Environment Standardization**
- **Fixed Random Seeds**: Ensure deterministic behavior where applicable
- **Configuration Documentation**: Record all experimental parameters
- **Version Control**: Track framework and algorithm implementations
- **Hardware Specifications**: Document system capabilities and limitations

#### **5.3.2 Result Verification**
- **Multiple Runs**: Minimum 3 iterations per experimental condition
- **Statistical Significance**: Confidence intervals and hypothesis testing
- **Cross-Validation**: Independent verification of critical results
- **Peer Review**: External validation of methodology and findings

## **6. Conclusion**

The DistSim simulation methodology provides a systematic approach for evaluating distributed consensus algorithms across multiple dimensions including performance, fault tolerance, and scalability. The framework's comprehensive tooling enables reproducible experiments that can inform algorithm selection and system design decisions in distributed computing environments.

The methodology emphasizes statistical rigor, comprehensive data collection, and standardized experimental procedures to ensure reliable and meaningful results. By following these guidelines, researchers can conduct thorough evaluations of consensus algorithms and contribute to the broader understanding of distributed system performance characteristics.