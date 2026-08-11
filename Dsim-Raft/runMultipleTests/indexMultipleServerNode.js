const { exec } = require('child_process');

// Function to run a command in a new Terminal window
function runCommandInNewTerminal(command) {
    const platform = process.platform;

    if (platform === 'darwin') {
        // Escape the command for osascript
        const escapedCommand = command.replace(/"/g, '\\"');

        // Use osascript to open a new Terminal and run the command
        // change the name of script like ./newRunNode.sh
        const terminalCommand = `osascript -e 'tell application "Terminal" to do script "./runMultipleServerForSimBFT.sh \\"${escapedCommand}\\""'`;

        exec(terminalCommand, (error, stdout, stderr) => {
            if (error)
            {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr)
            {
                console.error(`Stderr: ${stderr}`);
                return;
            }
            console.log(`Output: ${stdout}`);
        });
    } else {
        console.error('This script only works on macOS.');
    }
}

// Array of commands to run in separate terminals
const commands = [
    'npm run node1',
    'npm run node2',
    'npm run node3',
    'npm run node4',
    'npm run node5',
    'npm run node6',
    'npm run node7',
    'npm run node8'
];

// Loop through each command and open a new Terminal for each one
commands.forEach(command => {
    runCommandInNewTerminal(command);
});
