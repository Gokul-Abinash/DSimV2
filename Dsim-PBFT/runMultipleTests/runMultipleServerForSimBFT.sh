#!/bin/bash

## How to run this script
## Usage: ./runnode.sh "npm run node1"

# Hardcoded path to the target folder
target_dir="/Users/administrator/Documents/Research/IITM/DistSim/sim2/Dsim-PBFT/framework"

# Navigate to the specified folder
cd "$target_dir" || { echo "Error: Could not change directory to $target_dir"; exit 1; }

# Print the current directory
echo "Now in directory: $(pwd)"

# Check if the current directory is the same as the target directory
if [ "$(pwd)" == "$target_dir" ]; then
    clear
    # Execute the command passed as the first argument
    if [ -n "$1" ]; then
        echo "Executing command: $1"
        eval "$1" &
    else
        echo "Error: No command provided to run."
    fi
else
    echo "Error: Not in the expected directory."
fi

# Wait for all background processes to finish
wait
