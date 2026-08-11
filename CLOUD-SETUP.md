# AWS Cloud Deployment Setup

## Prerequisites

### 1. AWS Account Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

### 2. SSH Key Setup
```bash
# Create SSH key pair in AWS Console or CLI
aws ec2 create-key-pair --key-name distsim-key --query 'KeyMaterial' --output text > ~/.ssh/distsim-key.pem
chmod 400 ~/.ssh/distsim-key.pem
```

### 3. Install Dependencies
```bash
cd sim2
npm install
```

## Quick Start

### 1. Deploy Infrastructure
```bash
# Deploy 4 EC2 instances
bash dsim-cli.sh cloud deploy 4
```

### 2. Run PBFT Consensus
```bash
# Start PBFT protocol
bash dsim-cli.sh cloud start pbft

# Run test
bash dsim-cli.sh cloud test pbft 100,200,300

# Verify consensus
bash dsim-cli.sh cloud verify pbft
```

### 3. Cleanup
```bash
# Terminate all instances
bash dsim-cli.sh cloud cleanup
```

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `deploy [count]` | Launch EC2 instances | `bash dsim-cli.sh cloud deploy 4` |
| `start <algorithm>` | Start consensus protocol | `bash dsim-cli.sh cloud start pbft` |
| `test <algorithm> [values]` | Run consensus test | `bash dsim-cli.sh cloud test pbft 100,200,300` |
| `verify <algorithm>` | Verify consensus | `bash dsim-cli.sh cloud verify pbft` |
| `status` | Show deployment status | `bash dsim-cli.sh cloud status` |
| `cleanup` | Terminate all instances | `bash dsim-cli.sh cloud cleanup` |

## Supported Algorithms
- `pbft` - Practical Byzantine Fault Tolerance
- `sbft` - Scalable Byzantine Fault Tolerance  
- `raft` - Raft Consensus Algorithm
- `paxos` - Paxos Consensus Algorithm
- `hotstuff` - HotStuff Byzantine Consensus

## Cost Estimation
- **Instance Type**: t3.medium (2 vCPU, 4GB RAM)
- **Cost per instance**: ~$0.0416/hour
- **4-node deployment**: ~$0.17/hour (~$4/day)
- **8-node deployment**: ~$0.33/hour (~$8/day)

## Troubleshooting

### Common Issues:
1. **SSH Connection Failed**: Check key permissions (`chmod 400 ~/.ssh/distsim-key.pem`)
2. **Security Group Issues**: Ensure ports 3001-3008 and 22 are open
3. **Instance Launch Failed**: Check AWS limits and billing
4. **Node Setup Failed**: Check internet connectivity on instances

### Debug Commands:
```bash
# Check AWS credentials
aws sts get-caller-identity

# List running instances
aws ec2 describe-instances --filters "Name=tag:Project,Values=DistSim" --query 'Reservations[].Instances[].{ID:InstanceId,State:State.Name,IP:PublicIpAddress}'

# SSH into specific instance
ssh -i ~/.ssh/distsim-key.pem ubuntu@<instance-ip>
```

## Security Notes
- Instances are open to internet (0.0.0.0/0) for testing
- Use VPC and private subnets for production
- Rotate SSH keys regularly
- Monitor AWS costs and set billing alerts