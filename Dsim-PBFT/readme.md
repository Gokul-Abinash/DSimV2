# SimBFT_PBFT

A simulation framework for the PBFT (Practical Byzantine Fault Tolerance) protocol, supporting digital signatures, view changes, and performance testing.

---
# To run the algorithm
# Run the following to generate the public and private key pairs

Mention the number of nodes in the file named generateAllKeys.js and then run

node generateAllKeys.js

# Step 1: Go to the folder:
cd runMultipleTests

# Step 2: Run
./dsim-cli.sh start

# Step 3: Test
./dsim-cli.sh test

It sends the request in the form of operation and data once the submit button is clicked!

# To test with multiple requests run the following:
# After executing till step 2 skip step 3 and run

cd framework
node test_pbft_TPS.js
