# DistSim Sample Reports

## **1. Latency Benchmark Report (CSV)**
**Setup:** `bash dsim-cli.sh benchmark latency full`
**Configuration:** 6 nodes, full mesh, 5 iterations per profile, 100 transactions each
```csv
Algorithm,Latency_Profile,Success_Rate_%,Avg_Duration_ms,Min_Duration_ms,Max_Duration_ms,Total_Tests,Failed_Tests
pbft,none,100.0,2450,2380,2520,5,0
pbft,lan,100.0,2780,2720,2840,5,0
pbft,wan,98.0,5180,5050,5310,5,1
pbft,high,94.0,8920,8650,9200,5,1
pbft,unstable,89.0,6750,4200,12300,5,2
sbft,none,100.0,2650,2580,2720,5,0
sbft,lan,100.0,2980,2920,3040,5,0
sbft,wan,97.0,5380,5250,5510,5,1
sbft,high,93.0,9120,8850,9400,5,1
sbft,unstable,87.0,6950,4400,12500,5,2
raft,none,100.0,1850,1800,1900,5,0
raft,lan,100.0,2100,2050,2150,5,0
raft,wan,100.0,3200,3150,3250,5,0
raft,high,96.0,6800,6500,7100,5,1
raft,unstable,92.0,5400,3800,8900,5,1
paxos,none,100.0,2200,2150,2250,5,0
paxos,lan,100.0,2450,2400,2500,5,0
paxos,wan,98.0,4100,4000,4200,5,1
paxos,high,90.0,7500,7200,7800,5,2
paxos,unstable,85.0,6200,4500,9800,5,3
hotstuff,none,100.0,2850,2780,2920,5,0
hotstuff,lan,100.0,3180,3120,3240,5,0
hotstuff,wan,96.0,5580,5450,5710,5,1
hotstuff,high,91.0,9320,9050,9600,5,2
hotstuff,unstable,84.0,7150,4600,12700,5,3
prime,none,100.0,3050,2980,3120,5,0
prime,lan,100.0,3380,3320,3440,5,0
prime,wan,95.0,5780,5650,5910,5,1
prime,high,88.0,9520,9250,9800,5,2
prime,unstable,81.0,7350,4800,12900,5,3
mis,none,100.0,1650,1600,1700,5,0
mis,lan,100.0,1900,1850,1950,5,0
mis,wan,100.0,2800,2750,2850,5,0
mis,high,98.0,5200,5000,5400,5,1
mis,unstable,94.0,4100,2900,6800,5,1
mstghs,none,100.0,1750,1700,1800,5,0
mstghs,lan,100.0,2000,1950,2050,5,0
mstghs,wan,100.0,2900,2850,2950,5,0
mstghs,high,97.0,5400,5200,5600,5,1
mstghs,unstable,93.0,4300,3100,7000,5,1
```

## **2. TPS Performance Report**
**Setup:** `bash dsim-cli.sh topology 4 full && bash dsim-cli.sh latency lan && bash dsim-cli.sh <algorithm> start && bash dsim-cli.sh <algorithm> test --count 100 --burst && bash dsim-cli.sh <algorithm> test --count 50 --duration 30`
**Configuration:** 4 nodes, full mesh, LAN latency (1-5ms)
```csv
Algorithm,Topology,Latency_Profile,Test_Type,Transactions,Duration_ms,TPS,Success_Rate_%,P50_ms,P95_ms,P99_ms
pbft,4_nodes_full,lan,burst,100,2340,42.7,100.0,45,78,95
pbft,4_nodes_full,lan,sustained,50,30000,1.67,100.0,52,89,112
sbft,4_nodes_full,lan,burst,100,2540,39.4,100.0,48,82,98
sbft,4_nodes_full,lan,sustained,50,30000,1.67,100.0,55,92,115
raft,4_nodes_full,lan,burst,100,1850,54.1,100.0,38,65,82
raft,4_nodes_full,lan,sustained,50,30000,1.67,100.0,41,71,88
paxos,4_nodes_full,lan,burst,100,2200,45.5,100.0,42,73,91
paxos,4_nodes_full,lan,sustained,50,30000,1.67,100.0,48,82,105
hotstuff,4_nodes_full,lan,burst,100,2740,36.5,100.0,51,85,102
hotstuff,4_nodes_full,lan,sustained,50,30000,1.67,100.0,58,95,118
prime,4_nodes_full,lan,burst,100,2940,34.0,100.0,54,88,105
prime,4_nodes_full,lan,sustained,50,30000,1.67,100.0,61,98,121
mis,4_nodes_full,lan,burst,100,1650,60.6,100.0,32,58,75
mis,4_nodes_full,lan,sustained,50,30000,1.67,100.0,35,62,78
mstghs,4_nodes_full,lan,burst,100,1750,57.1,100.0,35,61,78
mstghs,4_nodes_full,lan,sustained,50,30000,1.67,100.0,38,65,82
```

## **3. Node Status Report**
**Setup:** `bash dsim-cli.sh topology 7 full --byzantine=corrupt:1,silent:1 && bash dsim-cli.sh latency wan && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft status`
**Configuration:** 7 nodes, full mesh, 2 Byzantine nodes, WAN latency
```csv
Node_ID,Role,Port,Status,Behavior,Connections,Last_Seen
node1,Primary,3001,ACTIVE,honest,6,2024-12-18T14:30:25Z
node2,Backup,3002,ACTIVE,corrupt,6,2024-12-18T14:30:24Z
node3,Backup,3003,ACTIVE,honest,6,2024-12-18T14:30:25Z
node4,Backup,3004,SILENT,silent,0,2024-12-18T14:28:15Z
node5,Backup,3005,ACTIVE,honest,6,2024-12-18T14:30:25Z
node6,Backup,3006,ACTIVE,honest,6,2024-12-18T14:30:24Z
node7,Backup,3007,ACTIVE,honest,6,2024-12-18T14:30:25Z

# System Summary
Topology,Total_Nodes,Byzantine_Nodes,f_tolerance,Active_Connections,Consensus_State
full_mesh,7,2,2,6/7,OPERATIONAL
```

## **4. Consensus Verification Report**
**Setup:** `bash dsim-cli.sh topology 7 full --byzantine=corrupt:1,silent:1 && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test --values 100,200,300 && bash dsim-cli.sh pbft verify`
**Configuration:** 7 nodes, full mesh, 2 Byzantine nodes (corrupt:1, silent:1)
```csv
Node_ID,Expected_Values,Actual_Values,Status,Consistency,Detection_Rate
node1,"[100,200,300]","[100,200,300]",CONSISTENT,100%,N/A
node2,"[100,200,300]","[150,250,350]",CORRUPTED,0%,100%
node3,"[100,200,300]","[100,200,300]",CONSISTENT,100%,N/A
node4,"[100,200,300]","[]",SILENT,0%,100%
node5,"[100,200,300]","[100,200,300]",CONSISTENT,100%,N/A
node6,"[100,200,300]","[100,200,300]",CONSISTENT,100%,N/A
node7,"[100,200,300]","[100,200,300]",CONSISTENT,100%,N/A

# Verification Summary
Algorithm,Test_Time,Consensus_Result,Honest_Agreement,Byzantine_Detection,Safety,Liveness
PBFT,2024-12-18T14:30:25Z,SUCCESS,5/5 (100%),2/2 (100%),SATISFIED,SATISFIED
```

## **5. Byzantine Behavior Analysis**
**Setup:** `bash dsim-cli.sh topology 8 full --byzantine=corrupt:1,delay:1 && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test --count 50 --duration 60 && bash dsim-cli.sh pbft stats`
**Configuration:** 8 nodes, full mesh, 2 Byzantine nodes (corrupt:1, delay:1), 60-second test
```csv
Node_ID,Behavior_Type,Original_Values,Modified_Values,Corruption_Rate_%,Detection_Rate_%,Avg_Delay_ms,Messages_Affected,Timeout_Events
node2,corrupt,"[100,200,300]","[150,250,350]",100,100,0,50,0
node4,delay,"[100,200,300]","[100,200,300]",0,100,850,45,5

# Test Configuration
Topology,Total_Nodes,Byzantine_Nodes,Test_Duration_s,Total_Transactions,Consensus_Achieved,Performance_Impact_%,Safety_Maintained,Liveness_Maintained
full_mesh,8,2,60,50,YES,15,YES,YES
```

## **6. Scalability Report**
**Setup:** `bash dsim-cli.sh benchmark scalability`
**Configuration:** Variable nodes (4,6,8,10), full mesh, no latency, 100 transactions per test
```csv
Algorithm,Node_Count,Latency_Profile,Avg_Duration_ms,TPS,Success_Rate_%,Message_Complexity
pbft,4,none,2450,40.8,100.0,O(n²)
pbft,6,none,3200,31.2,100.0,O(n²)
pbft,8,none,4100,24.4,98.0,O(n²)
pbft,10,none,5300,18.9,96.0,O(n²)
sbft,4,none,2650,37.7,100.0,O(n)
sbft,6,none,3400,29.4,100.0,O(n)
sbft,8,none,4300,23.3,98.0,O(n)
sbft,10,none,5500,18.2,96.0,O(n)
raft,4,none,1850,54.1,100.0,O(n)
raft,6,none,2100,47.6,100.0,O(n)
raft,8,none,2400,41.7,100.0,O(n)
raft,10,none,2800,35.7,100.0,O(n)
paxos,4,none,2200,45.5,100.0,O(n)
paxos,6,none,2600,38.5,100.0,O(n)
paxos,8,none,3100,32.3,98.0,O(n)
paxos,10,none,3800,26.3,96.0,O(n)
hotstuff,4,none,2850,35.1,100.0,O(n)
hotstuff,6,none,3600,27.8,100.0,O(n)
hotstuff,8,none,4500,22.2,97.0,O(n)
hotstuff,10,none,5700,17.5,95.0,O(n)
prime,4,none,3050,32.8,100.0,O(n²)
prime,6,none,3800,26.3,100.0,O(n²)
prime,8,none,4700,21.3,97.0,O(n²)
prime,10,none,5900,16.9,95.0,O(n²)
mis,4,none,1650,60.6,100.0,O(n)
mis,6,none,1900,52.6,100.0,O(n)
mis,8,none,2200,45.5,100.0,O(n)
mis,10,none,2600,38.5,100.0,O(n)
mstghs,4,none,1750,57.1,100.0,O(n log n)
mstghs,6,none,2000,50.0,100.0,O(n log n)
mstghs,8,none,2300,43.5,100.0,O(n log n)
mstghs,10,none,2700,37.0,100.0,O(n log n)
```

## **7. Network Topology Performance**
**Setup:** `for topo in full ring star line; do bash dsim-cli.sh topology 6 $topo && bash dsim-cli.sh latency lan && bash dsim-cli.sh <algorithm> start && bash dsim-cli.sh <algorithm> test --count 100; done`
**Configuration:** 6 nodes, all topologies, LAN latency (1-5ms)
```csv
Topology,Algorithm,Nodes,Latency_Profile,Avg_Duration_ms,TPS,Message_Overhead,Fault_Tolerance,Connectivity
full_mesh,PBFT,6,lan,2780,35.9,High,Excellent,100%
ring,PBFT,6,lan,4200,23.8,Low,Poor,33%
star,PBFT,6,lan,3100,32.3,Medium,Single_Point_Failure,83%
line,PBFT,6,lan,5800,17.2,Low,Poor,33%
full_mesh,SBFT,6,lan,2980,33.6,High,Excellent,100%
ring,SBFT,6,lan,4400,22.7,Low,Poor,33%
star,SBFT,6,lan,3300,30.3,Medium,Single_Point_Failure,83%
line,SBFT,6,lan,6000,16.7,Low,Poor,33%
full_mesh,Raft,6,lan,2100,47.6,High,Excellent,100%
ring,Raft,6,lan,3800,26.3,Low,Poor,33%
star,Raft,6,lan,2600,38.5,Medium,Single_Point_Failure,83%
line,Raft,6,lan,4900,20.4,Low,Poor,33%
full_mesh,Paxos,6,lan,2450,40.8,High,Excellent,100%
ring,Paxos,6,lan,4000,25.0,Low,Poor,33%
star,Paxos,6,lan,2800,35.7,Medium,Single_Point_Failure,83%
line,Paxos,6,lan,5100,19.6,Low,Poor,33%
full_mesh,HotStuff,6,lan,3180,31.4,High,Excellent,100%
ring,HotStuff,6,lan,4600,21.7,Low,Poor,33%
star,HotStuff,6,lan,3500,28.6,Medium,Single_Point_Failure,83%
line,HotStuff,6,lan,6200,16.1,Low,Poor,33%
full_mesh,Prime,6,lan,3380,29.6,High,Excellent,100%
ring,Prime,6,lan,4800,20.8,Low,Poor,33%
star,Prime,6,lan,3700,27.0,Medium,Single_Point_Failure,83%
line,Prime,6,lan,6400,15.6,Low,Poor,33%
full_mesh,MIS,6,lan,1900,52.6,Medium,Good,100%
line,MIS,6,lan,2800,35.7,Low,Excellent,33%
full_mesh,MSTGHS,6,lan,2000,50.0,Medium,Good,100%
line,MSTGHS,6,lan,2900,34.5,Low,Excellent,33%
```

## **8. Security Analysis Report**
**Setup:** `bash dsim-cli.sh topology 7 full --byzantine=corrupt:1,delay:1,silent:1 && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test --count 250 --duration 300`
**Configuration:** 7 nodes, full mesh, 3 Byzantine nodes, 5-minute security test
```csv
Attack_Type,Test_Result,Detection_Rate_%,Mitigation_Success_%,Impact_Level
Corruption,Detected_and_Isolated,100,100,Low
Delay,Mitigated_with_Timeouts,100,95,Medium
Silent,Handled_Gracefully,100,100,Low
Sybil,Not_Tested,N/A,N/A,N/A
Message_Replay,Prevented,100,100,None

# Cryptographic Analysis
Algorithm,Test_Duration_s,Total_Messages,Valid_Signatures,Invalid_Signatures,Verification_Success_%,Key_Size,Hash_Algorithm,Avg_Verification_ms
PBFT,300,1250,1000,250,100,RSA-2048,SHA-256,0.8
```

## **9. Real-time Statistics**
**Setup:** `bash dsim-cli.sh topology 6 full && bash dsim-cli.sh pbft start && bash dsim-cli.sh pbft test --count 1000 --duration 1800` (with periodic stats collection)
**Configuration:** 6 nodes, full mesh, 30-minute continuous operation, stats collected every 60 seconds
```csv
Timestamp,Algorithm,Uptime,Current_TPS,Peak_TPS,Avg_Latency_ms,Success_Rate_%,CPU_Usage_%,Memory_MB,Network_IO_MBps,Disk_IO_MBps
2024-12-18T14:35:42Z,PBFT,00:15:32,28.5,42.7,89,98.2,15.3,245,1.2,0.8
2024-12-18T14:36:42Z,PBFT,00:16:32,31.2,42.7,85,98.4,16.1,248,1.3,0.9
2024-12-18T14:37:42Z,PBFT,00:17:32,29.8,42.7,92,98.1,14.8,251,1.1,0.7

# Message Queue Status
Timestamp,Pending_Requests,Processing_Queue,Completed_Transactions,Failed_Transactions,Queue_Depth
2024-12-18T14:35:42Z,3,1,847,15,4
2024-12-18T14:36:42Z,2,1,878,16,3
2024-12-18T14:37:42Z,4,2,907,17,6
```

## **10. Fault Tolerance Analysis**
**Setup:** `for nodes in 4 6 7 10; do for algo in pbft raft paxos; do bash dsim-cli.sh topology $nodes full --byzantine=corrupt:$((nodes/3)) && bash dsim-cli.sh $algo start && bash dsim-cli.sh $algo test --count 100; done; done`
**Configuration:** Variable nodes, maximum tolerable faults per algorithm, full mesh topology
```csv
Algorithm,Fault_Type,Node_Count,Max_Tolerable_Faults,Actual_Faults,Safety_Maintained,Liveness_Maintained,Recovery_Time_s
PBFT,Byzantine,4,1,1,YES,YES,2.3
PBFT,Byzantine,6,1,1,YES,YES,2.3
PBFT,Byzantine,7,2,2,YES,YES,2.3
PBFT,Byzantine,10,3,3,YES,YES,2.3
SBFT,Byzantine,4,1,1,YES,YES,2.1
SBFT,Byzantine,6,1,1,YES,YES,2.1
SBFT,Byzantine,7,2,2,YES,YES,2.1
SBFT,Byzantine,10,3,3,YES,YES,2.1
Raft,Crash,4,1,1,YES,YES,1.8
Raft,Crash,6,2,2,YES,YES,1.8
Raft,Crash,8,3,3,YES,YES,1.8
Raft,Crash,10,4,4,YES,YES,1.8
Paxos,Crash,4,1,1,YES,YES,2.1
Paxos,Crash,6,2,2,YES,YES,2.1
Paxos,Crash,8,3,3,YES,YES,2.1
Paxos,Crash,10,4,4,YES,YES,2.1
HotStuff,Byzantine,4,1,1,YES,YES,1.9
HotStuff,Byzantine,6,1,1,YES,YES,1.9
HotStuff,Byzantine,7,2,2,YES,YES,1.9
HotStuff,Byzantine,10,3,3,YES,YES,1.9
Prime,Byzantine,4,1,1,YES,YES,2.5
Prime,Byzantine,6,1,1,YES,YES,2.5
Prime,Byzantine,7,2,2,YES,YES,2.5
Prime,Byzantine,10,3,3,YES,YES,2.5
MIS,None,4,0,0,YES,YES,0.5
MIS,None,6,0,0,YES,YES,0.5
MIS,None,8,0,0,YES,YES,0.5
MIS,None,10,0,0,YES,YES,0.5
MSTGHS,None,4,0,0,YES,YES,0.6
MSTGHS,None,6,0,0,YES,YES,0.6
MSTGHS,None,8,0,0,YES,YES,0.6
MSTGHS,None,10,0,0,YES,YES,0.6

# Partition Tolerance
Test_Type,Split_Duration_s,Recovery_Time_s,Data_Consistency,Availability_Impact_%
Network_Partition,30,5.2,Maintained,15
```

## **11. Algorithm Comparison Summary**
**Setup:** `bash dsim-cli.sh topology 6 full && bash dsim-cli.sh latency lan && for algo in pbft sbft raft paxos hotstuff; do bash dsim-cli.sh $algo start && bash dsim-cli.sh $algo test --count 100 && bash dsim-cli.sh $algo stop; done`
**Configuration:** 6 nodes, full mesh, LAN latency, 100 transactions per algorithm
```csv
Algorithm,Duration_ms,TPS,Performance_Rank,Security_Level,Security_Rank,Message_Complexity,Scalability_Rank,Fault_Type
MIS,1900,52.6,1,None,8,O(n),2,None
MSTGHS,2000,50.0,2,None,7,O(n log n),3,None
Raft,2100,47.6,3,Crash_Tolerance,6,O(n),4,Crash
Paxos,2600,38.5,4,Crash_Tolerance,5,O(n),5,Crash
PBFT,2780,35.9,5,Full_Byzantine,1,O(n²),8,Byzantine
SBFT,2980,33.6,6,Scalable_Byzantine,2,O(n),1,Byzantine
HotStuff,3180,31.4,7,Linear_Byzantine,3,O(n),6,Byzantine
Prime,3380,29.6,8,Full_Byzantine,4,O(n²),7,Byzantine

# Test Configuration
Nodes,Latency_Profile,Transactions,Test_Duration,Network_Type
6,lan,100,Variable,Full_Mesh
```ntine,2,O(n),2,Byzantine
HotStuff,3400,29.4,5,Linear_Byzantine,3,O(n),1,Byzantine

# Test Configuration
Nodes,Latency_Profile,Transactions,Test_Duration,Network_Type
6,lan,100,Variable,Full_Mesh
```

## **12. Custom Workload Report**
**Setup:** `bash dsim-cli.sh topology 4 full && bash dsim-cli.sh latency wan && bash dsim-cli.sh <algorithm> start` (with custom burst script: 20 transactions every 5 seconds for 300 seconds)
**Configuration:** 4 nodes, full mesh, WAN latency, high-frequency trading simulation
```csv
Workload_Type,Algorithm,Nodes,Latency_Profile,Burst_Size,Burst_Frequency_s,Test_Duration_s,Total_Bursts,Total_Transactions
High_Frequency_Trading,PBFT,4,wan,20,5,300,60,1200
High_Frequency_Trading,SBFT,4,wan,20,5,300,60,1200
High_Frequency_Trading,Raft,4,wan,20,5,300,60,1200
High_Frequency_Trading,Paxos,4,wan,20,5,300,60,1200
High_Frequency_Trading,HotStuff,4,wan,20,5,300,60,1200
High_Frequency_Trading,Prime,4,wan,20,5,300,60,1200
High_Frequency_Trading,MIS,4,wan,20,5,300,60,1200
High_Frequency_Trading,MSTGHS,4,wan,20,5,300,60,1200

# Performance Metrics
Algorithm,Peak_Burst_TPS,Avg_Burst_Time_s,Inter_Burst_Latency_s,Success_Rate_%,Failed_Bursts,P50_ms,P90_ms,P95_ms,P99_ms,Max_ms
PBFT,15.2,1.31,3.69,97.5,2,125,280,420,650,1200
SBFT,14.8,1.35,3.65,97.2,2,128,285,425,655,1220
Raft,18.7,1.07,3.93,98.8,1,98,215,340,520,980
Paxos,16.4,1.22,3.78,97.1,3,115,265,395,610,1150
HotStuff,13.9,1.44,3.56,96.8,3,135,295,435,665,1250
Prime,12.8,1.56,3.44,96.2,4,145,310,450,680,1280
MIS,22.1,0.90,4.10,99.2,0,85,185,295,450,850
MSTGHS,20.8,0.96,4.04,99.0,1,90,195,310,470,900
```