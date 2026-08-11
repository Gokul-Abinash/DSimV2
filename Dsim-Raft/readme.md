# SimBFT_Raft

A simulation framework for the Raft consensus algorithm, implementing leader election and log replication.

## Key Features
- **Leader election** with randomized timeouts
- **Log replication** with strong consistency
- **Crash fault tolerance** (f < n/2)
- **Simple and understandable** consensus protocol

## Architecture
- **Leader** - Coordinates log replication (elected dynamically)
- **Followers** - Replicate leader's log entries
- **Candidates** - Compete for leadership during elections

## Raft Protocol Flow
1. **Leader Election** - Elect a single leader
2. **Log Replication** - Leader replicates entries to followers
3. **Safety** - Ensure consistency across all nodes

## Quick Start

### Step 1: Generate Keys
```bash
cd framework/helper_modules
node generateAllKeys.js
```

### Step 2: Start Cluster
```bash
./dsim-cli.sh start
```

### Step 3: Test Raft
```bash
./dsim-cli.sh test
./dsim-cli.sh tps 100 5
./dsim-cli.sh stats
```

## Raft vs Other Algorithms
- **PBFT**: Byzantine fault tolerant, complex
- **Paxos**: Academic, hard to understand
- **Raft**: Designed for understandability, crash fault tolerant

## Commands
- `start` - Start all Raft nodes
- `stop` - Stop cluster
- `test` - Basic functionality test
- `tps [n] [c]` - Performance test
- `stats` - Cluster statistics
- `debug` - Troubleshooting info

## Raft States
- **Follower** - Default state, receives entries
- **Candidate** - Requests votes during election
- **Leader** - Manages log replication