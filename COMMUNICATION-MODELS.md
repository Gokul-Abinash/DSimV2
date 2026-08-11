# DistSim Communication Models

## Communication Patterns

### 1. **Broadcast** (Primary Model)
```javascript
// All-to-all communication with latency simulation
broadcastPBFTMessage('PRE-PREPARE', myNodeID, seq, prePrepareMsg);
```
**Implementation:**
- **File**: `broadcastWithLatency.js`
- **Method**: `sendPostRequestsToIPs()`
- **Pattern**: One-to-many (1:N)
- **Usage**: PBFT phases (Pre-Prepare, Prepare, Commit)

**Features:**
- Latency simulation with profiles (LAN, WAN, High, Unstable)
- Byzantine behavior simulation (message dropping)
- Jitter addition for realistic network conditions
- Parallel message delivery with Promise.all()

### 2. **Multicast** (Selective Broadcast)
```javascript
// Send to specific subset of nodes
sendBatchWithLatencyPattern(messages, 'parallel');
```
**Implementation:**
- **Pattern**: One-to-subset (1:M where M < N)
- **Usage**: View changes, leader election
- **Variants**:
  - `sequential`: Messages sent one after another
  - `parallel`: All messages sent simultaneously  
  - `staggered`: Messages with increasing delays

### 3. **Unicast** (Point-to-Point)
```javascript
// Direct node-to-node communication
axios.post(url, postData, { timeout: 10000 });
```
**Implementation:**
- **Pattern**: One-to-one (1:1)
- **Usage**: Direct responses, acknowledgments
- **Features**: HTTP POST with timeout handling

### 4. **Network Partition Simulation**
```javascript
// Simulate network splits
simulateNetworkPartition(nodeGroups, partitionDuration);
```
**Implementation:**
- Temporarily blocks communication between node groups
- Simulates real-world network failures
- Automatic recovery after partition duration

## Communication Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Communication Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  Broadcast Models                                               │
│  ├── All-to-All (Broadcast)                                    │
│  ├── One-to-Subset (Multicast)                                 │
│  ├── One-to-One (Unicast)                                      │
│  └── Network Partition Simulation                              │
├─────────────────────────────────────────────────────────────────┤
│  Latency Simulation                                             │
│  ├── Profile-based (none, lan, wan, high, unstable)           │
│  ├── Custom latency (min, max, distribution)                   │
│  ├── Jitter simulation (±15% variance)                         │
│  └── Byzantine message dropping                                │
├─────────────────────────────────────────────────────────────────┤
│  Transport Layer                                                │
│  ├── HTTP POST requests                                        │
│  ├── JSON message format                                       │
│  ├── Timeout handling (10s)                                    │
│  └── Error recovery                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Message Flow Patterns

### PBFT Communication Flow
```
Primary Node (Broadcast):
  PRE-PREPARE → All Backup Nodes

Backup Nodes (Multicast):
  PREPARE → All Other Nodes

All Nodes (Broadcast):
  COMMIT → All Nodes

Client (Unicast):
  REQUEST → Primary Node
  RESPONSE ← Any Node
```

### Raft Communication Flow
```
Leader (Multicast):
  APPEND_ENTRIES → All Followers
  HEARTBEAT → All Followers

Candidates (Broadcast):
  REQUEST_VOTE → All Nodes

Followers (Unicast):
  VOTE_RESPONSE → Candidate
  APPEND_RESPONSE → Leader
```

## Latency Profiles

| Profile | Latency Range | Distribution | Use Case |
|---------|---------------|--------------|----------|
| `none` | 0ms | Fixed | Baseline testing |
| `lan` | 1-5ms | Uniform | Local network |
| `wan` | 50-150ms | Normal | Internet |
| `high` | 200-800ms | Exponential | Satellite/poor connection |
| `unstable` | 10-500ms | Variable | Unreliable network |
| `custom` | User-defined | Configurable | Specific scenarios |

## Byzantine Behavior Impact

### Message Dropping
```javascript
// Byzantine nodes can drop messages
if (latency === -1) {
  console.log(`Message from ${fromNode} to ${toNode} DROPPED`);
  return;
}
```

### Delay Injection
```javascript
// Byzantine nodes can introduce delays
if (byzantineBehavior === 'delay') {
  finalLatency += Math.random() * 1000; // Add up to 1s delay
}
```

## Performance Optimizations

### Parallel Processing
```javascript
// All messages sent simultaneously
const promises = ipsArray.map(async (ip, index) => {
  // Send to each node in parallel
});
await Promise.all(promises);
```

### Batch Operations
```javascript
// Process multiple messages together
sendBatchWithLatencyPattern(messages, 'parallel');
```

### Timeout Management
```javascript
// Prevent hanging connections
axios.post(url, postData, { timeout: 10000 });
```

## Network Topology Support

| Topology | Communication Pattern | Efficiency |
|----------|----------------------|------------|
| **Full Mesh** | Direct all-to-all | High redundancy |
| **Ring** | Sequential forwarding | Low bandwidth |
| **Star** | Hub-based routing | Single point failure |
| **Line** | Linear propagation | High latency |

## Error Handling

### Connection Failures
- Automatic retry mechanisms
- Graceful degradation
- Error logging and reporting

### Network Partitions
- Partition detection
- Temporary isolation simulation
- Automatic recovery

### Byzantine Faults
- Message authentication
- Signature verification
- Malicious behavior simulation