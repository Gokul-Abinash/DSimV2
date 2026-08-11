# SimBFT_SBFT

A simulation framework for the SBFT (Scalable Byzantine Fault Tolerance) protocol, featuring linear message complexity through collector nodes.

## Key Features
- **Linear O(n) message complexity** vs PBFT's O(n²)
- **Collector-based architecture** for scalability
- **Digital signatures** for Byzantine fault tolerance
- **Performance testing** and monitoring tools

## Architecture
- **Primary Node** - Coordinates consensus (port 3001)
- **Collector Nodes** - Aggregate messages (ports 3002, 3003)
- **Backup Nodes** - Regular participants (port 3004+)

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

### Step 3: Test SBFT
```bash
./dsim-cli.sh test
./dsim-cli.sh tps 100 5
./dsim-cli.sh stats
```

## SBFT vs PBFT
- **PBFT**: All-to-all communication (n² messages)
- **SBFT**: Collector aggregation (n messages)
- **Scalability**: SBFT handles 100+ nodes efficiently

## Commands
- `start` - Start all SBFT nodes
- `stop` - Stop cluster
- `test` - Basic functionality test
- `tps [n] [c]` - Performance test
- `stats` - Cluster statistics
- `debug` - Troubleshooting info