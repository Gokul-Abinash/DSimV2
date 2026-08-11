# SimBFT_Paxos

A simulation framework for the Paxos consensus algorithm, implementing the classic distributed consensus protocol.

## Key Features
- **Classic Paxos algorithm** with Prepare/Promise/Accept/Accepted phases
- **Proposer/Acceptor/Learner roles** for distributed consensus
- **Majority-based decisions** (n/2 + 1 quorum)
- **Performance testing** and monitoring tools

## Architecture
- **Proposers** - Initiate consensus proposals (nodes A, B)
- **Acceptors** - Vote on proposals (all nodes)
- **Learners** - Learn decided values (all nodes)

## Paxos Protocol Flow
1. **Phase 1a (Prepare)**: Proposer → Acceptors
2. **Phase 1b (Promise)**: Acceptors → Proposer
3. **Phase 2a (Accept)**: Proposer → Acceptors  
4. **Phase 2b (Accepted)**: Acceptors → Learners

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

### Step 3: Test Paxos
```bash
./dsim-cli.sh test
./dsim-cli.sh tps 100 5
./dsim-cli.sh stats
```

## Paxos vs PBFT
- **PBFT**: Byzantine fault tolerant (f < n/3)
- **Paxos**: Crash fault tolerant (f < n/2)
- **Paxos**: Simpler protocol, better performance

## Commands
- `start` - Start all Paxos nodes
- `stop` - Stop cluster
- `test` - Basic functionality test
- `tps [n] [c]` - Performance test
- `stats` - Cluster statistics
- `debug` - Troubleshooting info