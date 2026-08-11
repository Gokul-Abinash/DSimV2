# DistSim Architecture Design

## System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                    DistSim Framework                            │
├─────────────────────────────────────────────────────────────────┤
│  CLI Interface (dsim-cli.sh)                                   │
│  ├── Topology Management                                       │
│  ├── Algorithm Control                                         │
│  ├── Latency Simulation                                        │
│  └── Benchmarking                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Algorithm Implementations                       │
├─────────────────────────────────────────────────────────────────┤
│  PBFT    │  SBFT    │  Raft    │  Paxos   │  HotStuff │  Prime │
│  MSTGHS  │  MIS     │          │          │           │        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Core Framework                               │
├─────────────────────────────────────────────────────────────────┤
│  Network Layer    │  Crypto Layer    │  State Management       │
│  Message Routing  │  Signature Verify│  Consensus Tracking     │
│  Latency Sim      │  Key Management  │  Transaction Queue      │
└─────────────────────────────────────────────────────────────────┘
```

## PBFT Node Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                      PBFT Node                                  │
├─────────────────────────────────────────────────────────────────┤
│  Client Interface                                               │
│  ├── Request Queue (pendingRequests[])                         │
│  ├── TPS Optimization (Batch Processing)                       │
│  └── Sequential Processing (10ms intervals)                    │
├─────────────────────────────────────────────────────────────────┤
│  PBFT Protocol Engine                                           │
│  ├── Pre-Prepare Phase                                         │
│  ├── Prepare Phase                                             │
│  ├── Commit Phase                                              │
│  └── Execution Phase (20ms intervals)                          │
├─────────────────────────────────────────────────────────────────┤
│  State Management                                               │
│  ├── PBFTState (sequence, view, log)                          │
│  ├── Message Log (pbftLog[])                                   │
│  └── Commit Log (pbftCommitLog[])                              │
├─────────────────────────────────────────────────────────────────┤
│  Security Layer                                                 │
│  ├── Digital Signatures                                        │
│  ├── Message Verification                                      │
│  └── Byzantine Behavior Simulation                             │
├─────────────────────────────────────────────────────────────────┤
│  Network Layer                                                  │
│  ├── Broadcast with Latency                                    │
│  ├── Message Routing                                           │
│  └── Topology Management                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture
```
Client Request → Request Queue → Primary Node → Pre-Prepare
                                      ↓
Backup Nodes ← Broadcast ←────────────┘
     ↓
Prepare Phase → Collect 2f Prepares → Prepared State
     ↓
Commit Phase → Collect 2f+1 Commits → Committed State
     ↓
Sequential Execution → Commit Log → Response
```

## Network Topology Support
```
Full Mesh (4-22 nodes)    Ring Topology         Star Topology
   A ←→ B ←→ C               A → B → C              A (center)
   ↕   ✕   ↕               ↑       ↓             ↙ ↓ ↘
   D ←→ E ←→ F               F ← E ← D           B   C   D
```

## Fault Tolerance Models
```
Byzantine Faults (PBFT/SBFT/HotStuff):
├── Silent: Node stops responding
├── Corrupt: Modifies transaction values  
├── Delay: Introduces network delays
└── Random: Unpredictable behavior

Crash Faults (Raft/Paxos):
└── Crash: Node completely stops
```

## Performance Optimization
```
TPS Enhancements:
├── Batch Processing (3 requests/cycle)
├── Reduced Intervals (10ms/20ms)
├── Non-blocking Operations (setImmediate)
└── Sequential Execution Pipeline
```

## Benchmarking System
```
Latency Profiles:
├── None (0ms)
├── LAN (1-5ms)  
├── WAN (50-150ms)
├── High (200-800ms)
└── Unstable (10-500ms)

Metrics Collection:
├── Success Rate (%)
├── Average Duration (ms)
├── TPS Performance
└── CSV Report Generation
```