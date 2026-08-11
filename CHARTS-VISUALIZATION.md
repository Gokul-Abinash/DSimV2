# DistSim Charts & Visualizations

## **1. Algorithm Performance Comparison (Bar Chart)**
```
TPS Performance by Algorithm (6 nodes, LAN)

    60 ┤
    50 ┤ ████
    40 ┤ ████ ████      ████
    30 ┤ ████ ████ ████ ████ ████
    20 ┤ ████ ████ ████ ████ ████
    10 ┤ ████ ████ ████ ████ ████
     0 └─────────────────────────
       Raft Paxos PBFT SBFT HotStuff
       47.6  38.5  35.9  32.3  29.4
```

## **2. Latency Impact on Performance (Line Chart)**
```
Average Duration vs Network Latency

Duration (ms)
    9000 ┤                    ●
    8000 ┤               ●    │
    7000 ┤          ●    │    │
    6000 ┤     ●    │    │    │
    5000 ┤●    │    │    │    │
    4000 ┤│    │    │    │    │
    3000 ┤│    │    │    │    │
    2000 ┤│    │    │    │    │
    1000 ┤│    │    │    │    │
       0 └─────────────────────────
        none lan  wan  high unstable
         ●─── PBFT  ○─── Raft  △─── Paxos
```

## **3. Scalability Analysis (Multi-Line Chart)**
```
TPS vs Node Count

TPS
    60 ┤●
    50 ┤│●
    40 ┤│ ●○
    30 ┤│  ●○●
    20 ┤│   ○ ●○
    10 ┤│    ○  ●
     0 └─────────────
       4  6  8  10 Nodes
       ●─── Raft  ○─── PBFT  △─── Paxos
```

## **4. Success Rate Heatmap**
```
Success Rate % by Algorithm & Latency Profile

           none  lan  wan  high unstable
    PBFT   100   100   98    94     89
    Raft   100   100  100    96     92  
    Paxos  100   100   98    90     85

    Legend: ████ 100%  ███ 95-99%  ██ 90-94%  █ <90%
```

## **5. Byzantine Fault Impact (Pie Chart)**
```
Node Status Distribution (7 nodes with 2 Byzantine)

    Honest Nodes (71.4%)
         ████████████████
       ████              ████
     ████                  ████
    ████                    ████
    ████     Honest          ████
    ████      71.4%          ████
     ████                  ████
       ████              ████
         ████████████████
           ████    ████
         Corrupt  Silent
          14.3%   14.3%
```

## **6. Resource Utilization Over Time (Area Chart)**
```
System Resource Usage (PBFT, 15 minutes)

Usage %
    20 ┤     ████████████████████
    15 ┤   ████                ████
    10 ┤ ████                    ████
     5 ┤████                      ████
     0 └─────────────────────────────────
       0    5    10   15   20   25   30
                  Time (minutes)
       ████ CPU  ░░░░ Memory  ▓▓▓▓ Network
```

## **7. Topology Performance Comparison (Radar Chart)**
```
Performance Metrics by Topology (PBFT, 6 nodes)

         TPS (40)
            ●
           /|\
          / | \
    Fault/  |  \Latency
    Tol.    |   (10ms)
    (10) ●──┼──● 
        /   |   \
       /    |    \
      ●─────┼─────●
   Overhead |   Connectivity
    (Low)   ●     (100%)
         Messages

    ●─── Full Mesh  ○─── Ring  △─── Star  ◇─── Line
```

## **8. Latency Distribution Histogram**
```
Transaction Latency Distribution (PBFT, WAN)

Frequency
    40 ┤
    30 ┤ ████
    20 ┤ ████ ████
    10 ┤ ████ ████ ████
     0 └─────────────────────
       0-50 50-100 100-150 150-200 200+ ms
        P50: 125ms  P95: 420ms  P99: 650ms
```

## **9. Fault Recovery Timeline**
```
System Recovery After Byzantine Attack

Status
  100% ┤●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●
   80% ┤                    ●●●●●●●●●●●●
   60% ┤                ●●●●
   40% ┤            ●●●●
   20% ┤        ●●●●
    0% └─────────────────────────────────
       0   5  10  15  20  25  30  35  40s
       │   │   │   │   │
       │   │   │   │   └─ Full Recovery
       │   │   │   └─ Consensus Restored
       │   │   └─ Byzantine Detected
       │   └─ Attack Begins
       └─ Normal Operation
```

## **10. Algorithm Security vs Performance Trade-off**
```
Security Level vs TPS Performance

Security
   High ┤     ●PBFT
        ┤   ●SBFT
        ┤ ●HotStuff
        ┤
    Low ┤         ●Paxos
        ┤           ●Raft
        └─────────────────────
         20   30   40   50  TPS

    Byzantine Tolerance: ●  Crash Tolerance: ○
```

## **Chart Generation Commands**

### **Using Python/Matplotlib**
```python
# Generate performance comparison chart
python3 generate_charts.py --type=performance --data=latency-benchmark.csv

# Generate scalability analysis
python3 generate_charts.py --type=scalability --data=scalability-report.csv

# Generate real-time dashboard
python3 generate_charts.py --type=realtime --data=live-stats.csv
```

### **Using Gnuplot**
```bash
# Generate latency impact chart
gnuplot -e "set terminal png; set output 'latency-impact.png'; plot 'data.csv' using 1:2 with lines"

# Generate TPS comparison
gnuplot -e "set terminal png; set output 'tps-comparison.png'; plot 'data.csv' using 1:2 with boxes"
```

### **Using Excel/Google Sheets**
```
1. Import CSV data
2. Select data range
3. Insert → Chart → Choose type
4. Customize axes and labels
5. Export as image
```

## **Interactive Dashboard Components**

### **Real-time Metrics**
- Live TPS counter
- Current latency gauge
- Success rate indicator
- Node status grid

### **Historical Analysis**
- Performance trends over time
- Comparative algorithm analysis
- Fault tolerance metrics
- Resource utilization graphs

### **Configuration Impact**
- Latency profile effects
- Node count scaling
- Topology performance
- Byzantine fault impact

## **Chart Export Formats**
- PNG/JPG for reports
- SVG for presentations
- PDF for publications
- Interactive HTML for dashboards