# PAXOS
bash dsim-cli.sh topology 12 full && bash dsim-cli.sh paxos start && sleep 3 && bash dsim-cli.sh paxos test --count 100 && bash dsim-cli.sh paxos verify

bash dsim-cli.sh topology 8 full --crash=crash:3 && bash dsim-cli.sh paxos start && sleep 3 && bash dsim-cli.sh paxos test --values 100,200,300 && bash dsim-cli.sh paxos verify

# RAFT
bash dsim-cli.sh topology 12 full && bash dsim-cli.sh raft start && sleep 3 && bash dsim-cli.sh raft test --count 100 && bash dsim-cli.sh raft verify

bash dsim-cli.sh topology 6 full --crash=crash:2 && bash dsim-cli.sh raft start && sleep 3 && bash dsim-cli.sh raft test --values 100,200,300 && bash dsim-cli.sh raft verify

# PBFT
bash dsim-cli.sh topology 4 full && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --count 10 && bash dsim-cli.sh pbft verify

bash dsim-cli.sh topology 8 full && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --count 100 && bash dsim-cli.sh pbft verify

bash dsim-cli.sh topology 22 full && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --count 100 && bash dsim-cli.sh pbft verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 100,200,300 && bash dsim-cli.sh pbft verify

bash dsim-cli.sh topology 8 full --byzantine=corrupt:2 && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 100,200,300 && bash dsim-cli.sh pbft verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --count 8 && sleep 15 && bash dsim-cli.sh pbft verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --count 100 && sleep 15 && bash dsim-cli.sh pbft verify

# SBFT
bash dsim-cli.sh topology 12 full && bash dsim-cli.sh sbft start && sleep 3 && bash dsim-cli.sh sbft test --count 100 && bash dsim-cli.sh sbft verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh sbft start && sleep 3 && bash dsim-cli.sh sbft test --values 100,200,300 && bash dsim-cli.sh sbft verify

bash dsim-cli.sh topology 8 full --byzantine=corrupt:2 && bash dsim-cli.sh sbft start && sleep 3 && bash dsim-cli.sh sbft test --values 100,200,300 && bash dsim-cli.sh sbft verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh sbft start && sleep 3 && bash dsim-cli.sh sbft test --count 8 && sleep 15 && bash dsim-cli.sh sbft verify

 

# Hotstuff
bash dsim-cli.sh topology 12 full  && bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --count 100 && bash dsim-cli.sh hotstuff verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --values 100,200,300 && bash dsim-cli.sh hotstuff verify

bash dsim-cli.sh topology 8 full --byzantine=corrupt:2 && bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --values 100,200,300 && bash dsim-cli.sh hotstuff verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --count 8 && sleep 15 && bash dsim-cli.sh hotstuff verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --count 100 && sleep 15 && bash dsim-cli.sh hotstuff verify

# Prime
bash dsim-cli.sh topology 12 full && bash dsim-cli.sh prime start && sleep 3 && bash dsim-cli.sh prime test --count 100 && bash dsim-cli.sh prime verify

bash dsim-cli.sh topology 8 full && bash dsim-cli.sh prime start && sleep 3 && bash dsim-cli.sh prime test --count 100 && bash dsim-cli.sh prime verify

bash dsim-cli.sh topology 8 full --byzantine=silent:2 && bash dsim-cli.sh prime start && sleep 3 && bash dsim-cli.sh prime test --values 100,200,300 && bash dsim-cli.sh prime verify

bash dsim-cli.sh topology 8 full --byzantine=corrupt:2 && bash dsim-cli.sh prime start && sleep 3 && bash dsim-cli.sh prime test --values 100,200,300 && bash dsim-cli.sh prime verify

bash dsim-cli.sh topology 8 full --byzantine=corrupt:2 && bash dsim-cli.sh prime start && sleep 3 && bash dsim-cli.sh prime test --count 8 && sleep 15 && bash dsim-cli.sh prime verify

# MIS
bash dsim-cli.sh topology 8 line && bash dsim-cli.sh mis start && sleep 3 && bash dsim-cli.sh mis test && sleep 8 && bash dsim-cli.sh mis verify

# MST GHS
bash dsim-cli.sh topology 8 full && bash dsim-cli.sh mstghs start && sleep 3 && bash dsim-cli.sh mstghs test && sleep 8 && bash dsim-cli.sh mstghs verify

