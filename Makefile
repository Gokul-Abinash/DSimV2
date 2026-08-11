# ==============================================================================
# DistSim - Distributed Consensus & Graph Simulation Framework Makefile
# Automatically runs all possible tests across all algorithms & configurations
# ==============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ------------------------------------------------------------------------------
# Configuration Variables (can be overridden from CLI, e.g. make test-pbft NODES=8)
# ------------------------------------------------------------------------------
NODES          ?= 4
TOPOLOGY       ?= full
LATENCY        ?= none
VALUES         ?= 100,200,300
COUNT          ?= 100
DURATION       ?= 10
BYZANTINE      ?= silent:1
CRASH          ?= crash:1
MIN_LATENCY    ?= 50
MAX_LATENCY    ?= 200
LATENCY_DIST   ?= normal

# Graph Algorithm Specific Defaults (verification requires 8 nodes)
MIS_NODES        ?= 8
MIS_TOPOLOGY     ?= line
MSTGHS_NODES     ?= 8
MSTGHS_TOPOLOGY  ?= full

# Algorithms supported
CONSENSUS_ALGOS := pbft sbft raft paxos hotstuff prime
GRAPH_ALGOS     := mis mstghs
ALL_ALGOS       := $(CONSENSUS_ALGOS) $(GRAPH_ALGOS)

# ------------------------------------------------------------------------------
# Terminal Colors & Styling
# ------------------------------------------------------------------------------
BOLD   := \033[1m
DIM    := \033[2m
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
BLUE   := \033[34m
MAGENTA:= \033[35m
RESET  := \033[0m

# ==============================================================================
# Master Test Suites
# ==============================================================================

.PHONY: all test test-all
all: test-all
test: test-quick
test-all: test-quick test-faults test-topologies test-latency test-tps test-graph
	@echo -e "\n$(GREEN)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(GREEN)$(BOLD)🎉 ALL DISTRIBUTED SIMULATION TESTS COMPLETED SUCCESSFULLY!$(RESET)"
	@echo -e "$(GREEN)$(BOLD)======================================================================$(RESET)\n"

.PHONY: test-quick test-smoke
test-quick test-smoke: reset
	@echo -e "\n$(CYAN)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(CYAN)$(BOLD)🚀 RUNNING SMOKE / QUICK TESTS ACROSS ALL $(words $(ALL_ALGOS)) ALGORITHMS$(RESET)"
	@echo -e "$(CYAN)$(BOLD)======================================================================$(RESET)\n"
	@$(MAKE) test-consensus-quick
	@$(MAKE) test-graph-quick
	@echo -e "\n$(GREEN)$(BOLD)✅ Quick Smoke Tests Completed Successfully!$(RESET)\n"

.PHONY: test-consensus test-consensus-quick
test-consensus: reset
	@echo -e "\n$(CYAN)$(BOLD)=== Testing All Consensus Protocols ($(CONSENSUS_ALGOS)) ===$(RESET)\n"
	@for algo in $(CONSENSUS_ALGOS); do \
		echo -e "\n$(YELLOW)$(BOLD)--- Testing $$algo ---$(RESET)"; \
		$(MAKE) test-$$algo || exit 1; \
	done

test-consensus-quick: reset
	@echo -e "\n$(CYAN)$(BOLD)=== Smoke Testing All Consensus Protocols ($(CONSENSUS_ALGOS)) ===$(RESET)\n"
	@for algo in $(CONSENSUS_ALGOS); do \
		echo -e "\n$(YELLOW)$(BOLD)--- Smoke Testing $$algo ---$(RESET)"; \
		bash dsim-cli.sh topology 4 full && \
		bash dsim-cli.sh $$algo start && \
		sleep 3 && \
		bash dsim-cli.sh $$algo test --values 100,200,300 && \
		sleep 3 && \
		bash dsim-cli.sh $$algo verify && \
		bash dsim-cli.sh $$algo stop || exit 1; \
	done

.PHONY: test-graph test-graph-quick
test-graph: test-mis test-mstghs
	@echo -e "\n$(GREEN)$(BOLD)✅ Graph Algorithms Test Suite Passed!$(RESET)\n"

test-graph-quick: reset
	@echo -e "\n$(CYAN)$(BOLD)=== Smoke Testing Graph Protocols ($(GRAPH_ALGOS)) ===$(RESET)\n"
	@$(MAKE) test-mis
	@$(MAKE) test-mstghs

# ==============================================================================
# Individual Algorithm Basic Tests
# ==============================================================================

.PHONY: test-pbft
test-pbft:
	@echo -e "\n$(CYAN)$(BOLD)▶ [PBFT] Testing $(NODES)-node $(TOPOLOGY) topology with values $(VALUES)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(NODES) $(TOPOLOGY)
	@bash dsim-cli.sh pbft start
	@sleep 3
	@bash dsim-cli.sh pbft test --values $(VALUES)
	@sleep 3
	@bash dsim-cli.sh pbft verify
	@bash dsim-cli.sh pbft stats
	@bash dsim-cli.sh pbft stop
	@echo -e "$(GREEN)✔ PBFT test finished successfully$(RESET)"

.PHONY: test-sbft
test-sbft:
	@echo -e "\n$(CYAN)$(BOLD)▶ [SBFT] Testing $(NODES)-node $(TOPOLOGY) topology with values $(VALUES)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(NODES) $(TOPOLOGY)
	@bash dsim-cli.sh sbft start
	@sleep 3
	@bash dsim-cli.sh sbft test --values $(VALUES)
	@sleep 3
	@bash dsim-cli.sh sbft verify
	@bash dsim-cli.sh sbft stats
	@bash dsim-cli.sh sbft stop
	@echo -e "$(GREEN)✔ SBFT test finished successfully$(RESET)"

.PHONY: test-raft
test-raft:
	@echo -e "\n$(CYAN)$(BOLD)▶ [RAFT] Testing $(NODES)-node $(TOPOLOGY) topology with values $(VALUES)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(NODES) $(TOPOLOGY)
	@bash dsim-cli.sh raft start
	@sleep 3
	@bash dsim-cli.sh raft test --values $(VALUES)
	@sleep 3
	@bash dsim-cli.sh raft verify
	@bash dsim-cli.sh raft stats
	@bash dsim-cli.sh raft stop
	@echo -e "$(GREEN)✔ Raft test finished successfully$(RESET)"

.PHONY: test-paxos
test-paxos:
	@echo -e "\n$(CYAN)$(BOLD)▶ [PAXOS] Testing $(NODES)-node $(TOPOLOGY) topology with values $(VALUES)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(NODES) $(TOPOLOGY)
	@bash dsim-cli.sh paxos start
	@sleep 3
	@bash dsim-cli.sh paxos test --values $(VALUES)
	@sleep 3
	@bash dsim-cli.sh paxos verify
	@bash dsim-cli.sh paxos stats
	@bash dsim-cli.sh paxos stop
	@echo -e "$(GREEN)✔ Paxos test finished successfully$(RESET)"

.PHONY: test-hotstuff
test-hotstuff:
	@echo -e "\n$(CYAN)$(BOLD)▶ [HOTSTUFF] Testing $(NODES)-node $(TOPOLOGY) topology with values $(VALUES)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(NODES) $(TOPOLOGY)
	@bash dsim-cli.sh hotstuff start
	@sleep 3
	@bash dsim-cli.sh hotstuff test --values $(VALUES)
	@sleep 3
	@bash dsim-cli.sh hotstuff verify
	@bash dsim-cli.sh hotstuff stats
	@bash dsim-cli.sh hotstuff stop
	@echo -e "$(GREEN)✔ HotStuff test finished successfully$(RESET)"

.PHONY: test-prime
test-prime:
	@echo -e "\n$(CYAN)$(BOLD)▶ [PRIME] Testing $(NODES)-node $(TOPOLOGY) topology with values $(VALUES)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(NODES) $(TOPOLOGY)
	@bash dsim-cli.sh prime start
	@sleep 3
	@bash dsim-cli.sh prime test --values $(VALUES)
	@sleep 3
	@bash dsim-cli.sh prime verify
	@bash dsim-cli.sh prime stats
	@bash dsim-cli.sh prime stop
	@echo -e "$(GREEN)✔ Prime test finished successfully$(RESET)"

.PHONY: test-mis
test-mis:
	@echo -e "\n$(CYAN)$(BOLD)▶ [MIS] Testing $(MIS_NODES)-node $(MIS_TOPOLOGY) topology for Maximal Independent Set...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(MIS_NODES) $(MIS_TOPOLOGY)
	@bash dsim-cli.sh mis start
	@sleep 3
	@bash dsim-cli.sh mis test
	@sleep 8
	@bash dsim-cli.sh mis verify
	@bash dsim-cli.sh mis stats
	@bash dsim-cli.sh mis stop
	@echo -e "$(GREEN)✔ MIS graph test finished successfully$(RESET)"

.PHONY: test-mstghs
test-mstghs:
	@echo -e "\n$(CYAN)$(BOLD)▶ [MST-GHS] Testing $(MSTGHS_NODES)-node $(MSTGHS_TOPOLOGY) topology for Minimum Spanning Tree (Gallager-Humblet-Spira)...$(RESET)"
	@bash dsim-cli.sh latency $(LATENCY)
	@bash dsim-cli.sh topology $(MSTGHS_NODES) $(MSTGHS_TOPOLOGY)
	@bash dsim-cli.sh mstghs start
	@sleep 3
	@bash dsim-cli.sh mstghs test
	@sleep 8
	@bash dsim-cli.sh mstghs verify
	@bash dsim-cli.sh mstghs stats
	@bash dsim-cli.sh mstghs stop
	@echo -e "$(GREEN)✔ MST-GHS graph test finished successfully$(RESET)"

# ==============================================================================
# Fault Tolerance Tests (Byzantine & Crash Faults)
# ==============================================================================

.PHONY: test-faults
test-faults: test-byzantine test-crash
	@echo -e "\n$(GREEN)$(BOLD)✅ All Fault Tolerance Tests Passed!$(RESET)\n"

# --- Byzantine Fault Testing (PBFT, SBFT, HotStuff, Prime) ---
.PHONY: test-byzantine
test-byzantine: reset
	@echo -e "\n$(MAGENTA)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)🛡️  RUNNING COMPREHENSIVE BYZANTINE FAULT TOLERANCE TESTS$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)======================================================================$(RESET)\n"
	@$(MAKE) test-byzantine-silent
	@$(MAKE) test-byzantine-corrupt
	@$(MAKE) test-byzantine-delay
	@$(MAKE) test-byzantine-mixed

.PHONY: test-byzantine-silent
test-byzantine-silent:
	@echo -e "\n$(MAGENTA)$(BOLD)=== Byzantine Test: Silent Nodes (PBFT, SBFT, HotStuff, Prime) ===$(RESET)"
	@for algo in pbft sbft hotstuff prime; do \
		echo -e "\n$(YELLOW)--- [$$algo] Testing 8 nodes with 2 silent Byzantine nodes ---$(RESET)"; \
		bash dsim-cli.sh topology 8 full --byzantine=silent:2 && \
		bash dsim-cli.sh $$algo start && \
		sleep 3 && \
		bash dsim-cli.sh $$algo test --values 100,200,300 && \
		sleep 5 && \
		bash dsim-cli.sh $$algo verify && \
		bash dsim-cli.sh $$algo status && \
		bash dsim-cli.sh $$algo stop || exit 1; \
	done

.PHONY: test-byzantine-corrupt
test-byzantine-corrupt:
	@echo -e "\n$(MAGENTA)$(BOLD)=== Byzantine Test: Corrupt Nodes (PBFT, SBFT, HotStuff, Prime) ===$(RESET)"
	@for algo in pbft sbft hotstuff prime; do \
		echo -e "\n$(YELLOW)--- [$$algo] Testing 8 nodes with 2 corrupt Byzantine nodes ---$(RESET)"; \
		bash dsim-cli.sh topology 8 full --byzantine=corrupt:2 && \
		bash dsim-cli.sh $$algo start && \
		sleep 3 && \
		bash dsim-cli.sh $$algo test --values 100,200,300 && \
		sleep 5 && \
		bash dsim-cli.sh $$algo verify && \
		bash dsim-cli.sh $$algo status && \
		bash dsim-cli.sh $$algo stop || exit 1; \
	done

.PHONY: test-byzantine-delay
test-byzantine-delay:
	@echo -e "\n$(MAGENTA)$(BOLD)=== Byzantine Test: Delay Nodes (PBFT, SBFT, HotStuff) ===$(RESET)"
	@for algo in pbft sbft hotstuff; do \
		echo -e "\n$(YELLOW)--- [$$algo] Testing 7 nodes with 1 delay Byzantine node ---$(RESET)"; \
		bash dsim-cli.sh topology 7 full --byzantine=delay:1 && \
		bash dsim-cli.sh $$algo start && \
		sleep 3 && \
		bash dsim-cli.sh $$algo test --values 100,200,300 && \
		sleep 5 && \
		bash dsim-cli.sh $$algo verify && \
		bash dsim-cli.sh $$algo stop || exit 1; \
	done

.PHONY: test-byzantine-mixed
test-byzantine-mixed:
	@echo -e "\n$(MAGENTA)$(BOLD)=== Byzantine Test: Mixed Malicious Nodes (PBFT) ===$(RESET)"
	@echo -e "$(YELLOW)--- [pbft] Testing 8 nodes with corrupt:1 and delay:1 ---$(RESET)"
	@bash dsim-cli.sh topology 8 full --byzantine=corrupt:1,delay:1
	@bash dsim-cli.sh pbft start
	@sleep 3
	@bash dsim-cli.sh pbft test --values 100,200,300
	@sleep 5
	@bash dsim-cli.sh pbft verify
	@bash dsim-cli.sh pbft status
	@bash dsim-cli.sh pbft stop

# --- Crash Fault Testing (Raft, Paxos) ---
.PHONY: test-crash
test-crash: reset
	@echo -e "\n$(MAGENTA)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)💥 RUNNING CRASH FAULT TOLERANCE TESTS (CFT: Raft & Paxos)$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)======================================================================$(RESET)\n"
	@$(MAKE) test-crash-raft
	@$(MAKE) test-crash-paxos

.PHONY: test-crash-raft
test-crash-raft:
	@echo -e "\n$(MAGENTA)$(BOLD)=== Crash Fault Test: Raft with $(CRASH) nodes ===$(RESET)"
	@bash dsim-cli.sh topology 6 full --crash=crash:2
	@bash dsim-cli.sh raft start
	@sleep 3
	@bash dsim-cli.sh raft test --values 10,20,30
	@sleep 3
	@bash dsim-cli.sh raft verify
	@bash dsim-cli.sh raft status
	@bash dsim-cli.sh raft stop
	@echo -e "$(GREEN)✔ Raft crash fault test passed$(RESET)"

.PHONY: test-crash-paxos
test-crash-paxos:
	@echo -e "\n$(MAGENTA)$(BOLD)=== Crash Fault Test: Paxos with $(CRASH) nodes ===$(RESET)"
	@bash dsim-cli.sh topology 8 full --crash=crash:3
	@bash dsim-cli.sh paxos start
	@sleep 3
	@bash dsim-cli.sh paxos test --values 99,88,77
	@sleep 3
	@bash dsim-cli.sh paxos verify
	@bash dsim-cli.sh paxos status
	@bash dsim-cli.sh paxos stop
	@echo -e "$(GREEN)✔ Paxos crash fault test passed$(RESET)"

# ==============================================================================
# Network Topology Variation Tests
# ==============================================================================

.PHONY: test-topologies test-topology-full test-topology-ring test-topology-star test-topology-line
test-topologies: reset
	@echo -e "\n$(CYAN)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(CYAN)$(BOLD)🕸️  TESTING TOPOLOGY VARIATIONS (Full, Ring, Star, Line)$(RESET)"
	@echo -e "$(CYAN)$(BOLD)======================================================================$(RESET)\n"
	@$(MAKE) test-topology-full
	@$(MAKE) test-topology-ring
	@$(MAKE) test-topology-star
	@$(MAKE) test-topology-line
	@echo -e "\n$(GREEN)$(BOLD)✅ All Topology Tests Completed!$(RESET)\n"

test-topology-full:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing Full Mesh Topology (PBFT & Raft, 6 nodes) ---$(RESET)"
	@bash dsim-cli.sh topology 6 full
	@bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 10,20,30 && sleep 2 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop
	@bash dsim-cli.sh raft start && sleep 3 && bash dsim-cli.sh raft test --values 10,20,30 && sleep 2 && bash dsim-cli.sh raft verify && bash dsim-cli.sh raft stop

test-topology-ring:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing Ring Topology (PBFT & Paxos, 6 nodes) ---$(RESET)"
	@bash dsim-cli.sh topology 6 ring
	@bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 100,200,300 && sleep 2 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop
	@bash dsim-cli.sh paxos start && sleep 3 && bash dsim-cli.sh paxos test --values 100,200,300 && sleep 2 && bash dsim-cli.sh paxos verify && bash dsim-cli.sh paxos stop

test-topology-star:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing Star Topology (PBFT & HotStuff, 8 nodes) ---$(RESET)"
	@bash dsim-cli.sh topology 8 star
	@bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 10,20,30 && sleep 2 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop
	@bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --values 10,20,30 && sleep 2 && bash dsim-cli.sh hotstuff verify && bash dsim-cli.sh hotstuff stop

test-topology-line:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing Line Topology (MIS & MST-GHS, 8 nodes) ---$(RESET)"
	@bash dsim-cli.sh topology 8 line
	@bash dsim-cli.sh mis start && sleep 3 && bash dsim-cli.sh mis test && sleep 8 && bash dsim-cli.sh mis verify && bash dsim-cli.sh mis stop

# ==============================================================================
# Network Latency Simulation Tests
# ==============================================================================

.PHONY: test-latency test-latency-lan test-latency-wan test-latency-high test-latency-unstable test-latency-custom test-latency-byzantine
test-latency: reset
	@echo -e "\n$(CYAN)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(CYAN)$(BOLD)🌐 TESTING NETWORK LATENCY PROFILES (LAN, WAN, High, Unstable)$(RESET)"
	@echo -e "$(CYAN)$(BOLD)======================================================================$(RESET)\n"
	@$(MAKE) test-latency-lan
	@$(MAKE) test-latency-wan
	@$(MAKE) test-latency-high
	@$(MAKE) test-latency-unstable
	@$(MAKE) test-latency-byzantine
	@bash dsim-cli.sh latency none
	@echo -e "\n$(GREEN)$(BOLD)✅ Latency Simulation Tests Completed!$(RESET)\n"

test-latency-lan:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing LAN Latency (1-5ms) with PBFT & Raft ---$(RESET)"
	@bash dsim-cli.sh latency lan
	@bash dsim-cli.sh topology 4 full
	@bash dsim-cli.sh pbft start && sleep 2 && bash dsim-cli.sh pbft test --values 100,200,300 && sleep 3 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop
	@bash dsim-cli.sh raft start && sleep 2 && bash dsim-cli.sh raft test --values 100,200,300 && sleep 3 && bash dsim-cli.sh raft verify && bash dsim-cli.sh raft stop

test-latency-wan:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing WAN Latency (50-150ms) with PBFT & SBFT ---$(RESET)"
	@bash dsim-cli.sh latency wan
	@bash dsim-cli.sh topology 4 full
	@bash dsim-cli.sh pbft start && sleep 2 && bash dsim-cli.sh pbft test --values 100,200,300 && sleep 4 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop
	@bash dsim-cli.sh sbft start && sleep 2 && bash dsim-cli.sh sbft test --values 100,200,300 && sleep 4 && bash dsim-cli.sh sbft verify && bash dsim-cli.sh sbft stop

test-latency-high:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing High Latency (200-800ms) with HotStuff ---$(RESET)"
	@bash dsim-cli.sh latency high
	@bash dsim-cli.sh topology 4 full
	@bash dsim-cli.sh hotstuff start && sleep 3 && bash dsim-cli.sh hotstuff test --values 100,200,300 && sleep 5 && bash dsim-cli.sh hotstuff verify && bash dsim-cli.sh hotstuff stop

test-latency-unstable:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing Unstable Latency (10-500ms) with Prime & Paxos ---$(RESET)"
	@bash dsim-cli.sh latency unstable
	@bash dsim-cli.sh topology 4 full
	@bash dsim-cli.sh prime start && sleep 3 && bash dsim-cli.sh prime test --values 100,200,300 && sleep 5 && bash dsim-cli.sh prime verify && bash dsim-cli.sh prime stop
	@bash dsim-cli.sh paxos start && sleep 3 && bash dsim-cli.sh paxos test --values 100,200,300 && sleep 5 && bash dsim-cli.sh paxos verify && bash dsim-cli.sh paxos stop

test-latency-custom:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing Custom Latency ($(MIN_LATENCY)-$(MAX_LATENCY)ms, $(LATENCY_DIST)) ---$(RESET)"
	@bash dsim-cli.sh latency custom $(MIN_LATENCY) $(MAX_LATENCY) $(LATENCY_DIST)
	@bash dsim-cli.sh topology 4 full
	@bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 100,200,300 && sleep 4 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop

test-latency-byzantine:
	@echo -e "\n$(CYAN)$(BOLD)--- Testing WAN Latency + Byzantine Nodes (PBFT, 7 nodes) ---$(RESET)"
	@bash dsim-cli.sh latency wan
	@bash dsim-cli.sh topology 7 full --byzantine=delay:1,corrupt:1
	@bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 100,200,300 && sleep 5 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop

# ==============================================================================
# TPS (Transactions Per Second) & Performance Load Tests
# ==============================================================================

.PHONY: test-tps test-tps-burst test-tps-duration test-tps-metrics
test-tps: reset
	@echo -e "\n$(YELLOW)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(YELLOW)$(BOLD)⚡ RUNNING TPS & PERFORMANCE LOAD TESTS$(RESET)"
	@echo -e "$(YELLOW)$(BOLD)======================================================================$(RESET)\n"
	@$(MAKE) test-tps-burst
	@$(MAKE) test-tps-duration
	@echo -e "\n$(GREEN)$(BOLD)✅ TPS Performance Tests Completed!$(RESET)\n"

test-tps-burst:
	@echo -e "\n$(YELLOW)$(BOLD)=== TPS Burst Testing (100 tx instant) ===$(RESET)"
	@for algo in pbft sbft raft paxos hotstuff prime; do \
		echo -e "\n$(CYAN)--- [$$algo] Burst Test ($(COUNT) txs) ---$(RESET)"; \
		bash dsim-cli.sh topology 4 full && \
		bash dsim-cli.sh $$algo start && \
		sleep 3 && \
		bash dsim-cli.sh $$algo test --count $(COUNT) && \
		sleep 5 && \
		bash dsim-cli.sh $$algo verify && \
		bash dsim-cli.sh $$algo test --tps && \
		bash dsim-cli.sh $$algo stop || exit 1; \
	done

test-tps-duration:
	@echo -e "\n$(YELLOW)$(BOLD)=== TPS Sustained Duration Testing (50 tx over $(DURATION)s) ===$(RESET)"
	@for algo in pbft raft hotstuff; do \
		echo -e "\n$(CYAN)--- [$$algo] Sustained Duration Test (50 tx over $(DURATION)s) ---$(RESET)"; \
		bash dsim-cli.sh topology 4 full && \
		bash dsim-cli.sh $$algo start && \
		sleep 3 && \
		bash dsim-cli.sh $$algo test --count 50 --duration $(DURATION) && \
		sleep 4 && \
		bash dsim-cli.sh $$algo verify && \
		bash dsim-cli.sh $$algo test --tps && \
		bash dsim-cli.sh $$algo stop || exit 1; \
	done

test-tps-metrics:
	@echo -e "\n$(YELLOW)$(BOLD)=== TPS Metrics Analysis ===$(RESET)"
	@bash dsim-cli.sh topology 4 full
	@bash dsim-cli.sh pbft start && sleep 2 && bash dsim-cli.sh pbft test --count 50 && sleep 4 && bash dsim-cli.sh pbft test --tps && bash dsim-cli.sh pbft stop

# ==============================================================================
# Comprehensive Benchmark Commands
# ==============================================================================

.PHONY: test-benchmarks benchmark-latency-full benchmark-scalability-full benchmark-latency benchmark-scalability
test-benchmarks: benchmark-latency-full benchmark-scalability-full
	@echo -e "\n$(GREEN)$(BOLD)✅ All Automated Benchmarks Completed! CSV Reports Generated.$(RESET)\n"

benchmark-latency-full: reset
	@echo -e "\n$(MAGENTA)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)📊 RUNNING FULL LATENCY BENCHMARK (All 5 Algos × 5 Latency Profiles)$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)======================================================================$(RESET)\n"
	@node test-latency.js full

benchmark-scalability-full: reset
	@echo -e "\n$(MAGENTA)$(BOLD)======================================================================$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)📊 RUNNING FULL SCALABILITY BENCHMARK (All Algos × 4-8 Replicas × Latency Profiles)$(RESET)"
	@echo -e "$(MAGENTA)$(BOLD)======================================================================$(RESET)\n"
	@node scalability-benchmark.js

benchmark-latency:
	@if [ -z "$(ALGO)" ]; then \
		echo "Usage: make benchmark-latency ALGO=<pbft|sbft|raft|paxos|hotstuff>"; \
		exit 1; \
	fi
	@bash dsim-cli.sh benchmark latency $(ALGO)

benchmark-scalability:
	@if [ -z "$(ALGO)" ]; then \
		echo "Usage: make benchmark-scalability ALGO=<pbft|sbft|raft|paxos|hotstuff>"; \
		exit 1; \
	fi
	@bash dsim-cli.sh benchmark scalability $(ALGO)

# ==============================================================================
# Step-by-Step Level Workflows (as defined in CLI Reference)
# ==============================================================================

.PHONY: test-levels test-level1 test-level2 test-level3 test-level4 test-level5
test-levels: test-level1 test-level2 test-level3 test-level5
	@echo -e "\n$(GREEN)$(BOLD)✅ All Level Workflows (1-5) Completed!$(RESET)\n"

test-level1: reset
	@echo -e "\n$(BLUE)$(BOLD)=== Level 1: Basic Workflow Test ===$(RESET)"
	@bash dsim-cli.sh topology 4 full && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop

test-level2: reset
	@echo -e "\n$(BLUE)$(BOLD)=== Level 2: Fault Workflow Test (Byzantine Corrupt) ===$(RESET)"
	@bash dsim-cli.sh topology 7 full --byzantine=corrupt:1 && bash dsim-cli.sh pbft start && sleep 3 && bash dsim-cli.sh pbft test --values 100,200,300 && bash dsim-cli.sh pbft verify && bash dsim-cli.sh pbft stop

test-level3: reset
	@echo -e "\n$(BLUE)$(BOLD)=== Level 3: Multi-Algorithm Comparison Workflow ===$(RESET)"
	@bash dsim-cli.sh topology 6 full
	@for algo in pbft raft paxos hotstuff prime; do \
		echo -e "\n$(YELLOW)Comparing $$algo...$(RESET)"; \
		bash dsim-cli.sh $$algo start && sleep 3 && bash dsim-cli.sh $$algo test && bash dsim-cli.sh $$algo verify && bash dsim-cli.sh $$algo stop || exit 1; \
	done

test-level4: reset
	@echo -e "\n$(BLUE)$(BOLD)=== Level 4: Research Benchmark Workflow ===$(RESET)"
	@bash dsim-cli.sh benchmark latency full
	@bash dsim-cli.sh benchmark scalability

test-level5: reset
	@echo -e "\n$(BLUE)$(BOLD)=== Level 5: Production Stress Test (12 nodes, Byzantine faults, WAN, Load) ===$(RESET)"
	@bash dsim-cli.sh latency wan
	@bash dsim-cli.sh topology 12 full --byzantine=silent:2,corrupt:1
	@bash dsim-cli.sh pbft start
	@sleep 3
	@bash dsim-cli.sh pbft test --count 100 --duration 10
	@sleep 5
	@bash dsim-cli.sh pbft verify
	@bash dsim-cli.sh pbft stats
	@bash dsim-cli.sh pbft stop
	@bash dsim-cli.sh latency none

# ==============================================================================
# Lifecycle & Helper Operations
# ==============================================================================

.PHONY: start stop status stats logs verify
start:
	@if [ -z "$(ALGO)" ]; then echo "Usage: make start ALGO=<algorithm>"; exit 1; fi
	@bash dsim-cli.sh $(ALGO) start

stop:
	@if [ -z "$(ALGO)" ]; then echo "Usage: make stop ALGO=<algorithm>"; exit 1; fi
	@bash dsim-cli.sh $(ALGO) stop

status:
	@if [ -z "$(ALGO)" ]; then \
		echo -e "$(CYAN)$(BOLD)--- Current Topology & Latency Status ---$(RESET)"; \
		bash dsim-cli.sh topology show; \
		bash dsim-cli.sh latency show; \
	else \
		bash dsim-cli.sh $(ALGO) status; \
	fi

stats:
	@if [ -z "$(ALGO)" ]; then echo "Usage: make stats ALGO=<algorithm>"; exit 1; fi
	@bash dsim-cli.sh $(ALGO) stats

logs:
	@if [ -z "$(ALGO)" ]; then echo "Usage: make logs ALGO=<algorithm>"; exit 1; fi
	@bash dsim-cli.sh $(ALGO) logs

verify:
	@if [ -z "$(ALGO)" ]; then echo "Usage: make verify ALGO=<algorithm>"; exit 1; fi
	@bash dsim-cli.sh $(ALGO) verify

.PHONY: stop-all clean reset clean-logs clean-reports
stop-all:
	@echo -e "$(YELLOW)Stopping all running simulation nodes...$(RESET)"
	@bash dsim-cli.sh stop-all 2>/dev/null || true
	@pkill -f "node index.js" 2>/dev/null || true
	@echo -e "$(GREEN)✔ All nodes stopped.$(RESET)"

reset: stop-all
	@echo -e "$(YELLOW)Resetting simulation configuration to default state...$(RESET)"
	@bash dsim-cli.sh latency none >/dev/null 2>&1 || true
	@bash dsim-cli.sh topology 4 full >/dev/null 2>&1 || true
	@echo -e "$(GREEN)✔ Reset complete: 4 nodes, full topology, 0ms latency.$(RESET)"

clean-logs:
	@echo -e "$(YELLOW)Cleaning log files...$(RESET)"
	@find . -name "*.log" -type f -delete 2>/dev/null || true
	@find . -name "*.pid" -type f -delete 2>/dev/null || true
	@echo -e "$(GREEN)✔ Logs cleaned.$(RESET)"

clean-reports:
	@echo -e "$(YELLOW)Cleaning benchmark CSV reports...$(RESET)"
	@find . -name "latency-*.csv" -type f -delete 2>/dev/null || true
	@find . -name "scalability-*.csv" -type f -delete 2>/dev/null || true
	@find . -name "tps-*.csv" -type f -delete 2>/dev/null || true
	@echo -e "$(GREEN)✔ CSV reports cleaned.$(RESET)"

clean: stop-all clean-logs
	@echo -e "$(GREEN)✔ Full cleanup complete.$(RESET)"

# ==============================================================================
# Interactive Help Menu
# ==============================================================================

.PHONY: help
help:
	@echo -e "\n$(CYAN)$(BOLD)==============================================================================$(RESET)"
	@echo -e "$(CYAN)$(BOLD)             DistSim - Distributed Consensus Simulation Makefile              $(RESET)"
	@echo -e "$(CYAN)$(BOLD)==============================================================================$(RESET)"
	@echo -e "\n$(BOLD)MAIN TEST TARGETS:$(RESET)"
	@echo -e "  $(GREEN)make test-all$(RESET)              Run complete test suite across all algorithms & features"
	@echo -e "  $(GREEN)make test-quick$(RESET)            Run fast smoke test across all 8 algorithms (4 nodes, 0 latency)"
	@echo -e "  $(GREEN)make test-consensus$(RESET)        Run tests for all consensus algorithms (PBFT, SBFT, Raft, Paxos, HotStuff, Prime)"
	@echo -e "  $(GREEN)make test-graph$(RESET)            Run tests for all graph algorithms (MIS, MST-GHS)"
	@echo -e "  $(GREEN)make test-faults$(RESET)           Run all Byzantine and crash fault tolerance tests"
	@echo -e "  $(GREEN)make test-topologies$(RESET)       Run tests across network topologies (full, ring, star, line)"
	@echo -e "  $(GREEN)make test-latency$(RESET)          Run tests across latency profiles (lan, wan, high, unstable)"
	@echo -e "  $(GREEN)make test-tps$(RESET)              Run TPS burst and sustained duration performance load tests"
	@echo -e "  $(GREEN)make test-levels$(RESET)           Run Level 1 to Level 5 testing workflows"
	@echo -e "  $(GREEN)make test-benchmarks$(RESET)       Run full latency and scalability benchmark suites"
	@echo -e "\n$(BOLD)PER-ALGORITHM TARGETS:$(RESET)"
	@echo -e "  $(CYAN)make test-pbft$(RESET)            Test PBFT consensus"
	@echo -e "  $(CYAN)make test-sbft$(RESET)            Test SBFT consensus"
	@echo -e "  $(CYAN)make test-raft$(RESET)            Test Raft consensus"
	@echo -e "  $(CYAN)make test-paxos$(RESET)           Test Paxos consensus"
	@echo -e "  $(CYAN)make test-hotstuff$(RESET)        Test HotStuff consensus"
	@echo -e "  $(CYAN)make test-prime$(RESET)           Test Prime consensus"
	@echo -e "  $(CYAN)make test-mis$(RESET)             Test MIS graph algorithm"
	@echo -e "  $(CYAN)make test-mstghs$(RESET)          Test MST-GHS graph algorithm"
	@echo -e "\n$(BOLD)FAULT TOLERANCE TARGETS:$(RESET)"
	@echo -e "  $(MAGENTA)make test-byzantine$(RESET)        Run all Byzantine tests (silent, corrupt, delay, mixed)"
	@echo -e "  $(MAGENTA)make test-byzantine-silent$(RESET) Test silent Byzantine nodes"
	@echo -e "  $(MAGENTA)make test-byzantine-corrupt$(RESET)Test corrupt Byzantine nodes"
	@echo -e "  $(MAGENTA)make test-byzantine-delay$(RESET)  Test delayed Byzantine nodes"
	@echo -e "  $(MAGENTA)make test-crash$(RESET)            Run crash fault tests (Raft & Paxos)"
	@echo -e "\n$(BOLD)BENCHMARK TARGETS:$(RESET)"
	@echo -e "  $(YELLOW)make benchmark-latency-full$(RESET)      Run 5 algorithms × 5 latency profiles"
	@echo -e "  $(YELLOW)make benchmark-scalability-full$(RESET)  Run algorithms × replica counts × latencies"
	@echo -e "  $(YELLOW)make benchmark-latency ALGO=pbft$(RESET) Benchmark latency for specific algorithm"
	@echo -e "  $(YELLOW)make benchmark-scalability ALGO=raft$(RESET) Benchmark scalability for specific algorithm"
	@echo -e "\n$(BOLD)LIFECYCLE & UTILITIES:$(RESET)"
	@echo -e "  $(BLUE)make status [ALGO=pbft]$(RESET)    Show topology/latency status or node status"
	@echo -e "  $(BLUE)make start ALGO=pbft$(RESET)       Start nodes for an algorithm"
	@echo -e "  $(BLUE)make stop ALGO=pbft$(RESET)        Stop nodes for an algorithm"
	@echo -e "  $(BLUE)make stats ALGO=pbft$(RESET)       Show statistics for an algorithm"
	@echo -e "  $(BLUE)make verify ALGO=pbft$(RESET)      Verify consensus for an algorithm"
	@echo -e "  $(BLUE)make stop-all$(RESET)              Stop all running node processes"
	@echo -e "  $(BLUE)make reset$(RESET)                 Reset topology to 4 nodes full and latency to none"
	@echo -e "  $(BLUE)make clean$(RESET)                 Stop all processes and clean log files"
	@echo -e "  $(BLUE)make clean-reports$(RESET)         Remove generated benchmark CSV files"
	@echo -e "\n$(BOLD)CONFIGURABLE PARAMETERS:$(RESET)"
	@echo -e "  NODES=N          (default: 4, range: 4-22)"
	@echo -e "  TOPOLOGY=type    (full | ring | star | line)"
	@echo -e "  LATENCY=profile  (none | lan | wan | high | unstable)"
	@echo -e "  VALUES=X,Y,Z     (custom transaction values)"
	@echo -e "  COUNT=N          (number of transactions for TPS test)"
	@echo -e "  DURATION=S       (seconds for sustained duration TPS test)"
	@echo -e "  BYZANTINE=spec   (e.g., silent:1, corrupt:2, delay:1)"
	@echo -e "  CRASH=spec       (e.g., crash:1, crash:2)"
	@echo -e "\n$(BOLD)EXAMPLE COMMANDS:$(RESET)"
	@echo -e "  make test-pbft NODES=8 VALUES=111,222,333"
	@echo -e "  make test-byzantine-corrupt"
	@echo -e "  make test-tps-burst COUNT=50"
	@echo -e "  make test-latency-wan"
	@echo -e "  make test-level5"
	@echo -e "$(CYAN)==============================================================================$(RESET)\n"
