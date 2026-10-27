const fs = require('fs');

// Read the base64 content
const base64Content = fs.readFileSync('logo-base64-output.txt', 'utf8');

console.log('Generating MCP tool call...\n');

// Generate the tool call XML
const toolCall = `<invoke name="mcp_github_create_or_update_file">
<parameter name="owner">uzi-tzur
