const fs = require('fs');
let code = fs.readFileSync('test-api.js', 'utf8');

// 1. Rename log in first script to log1
code = code.replace(/function log\(/g, 'function log1(');
code = code.replace(/log\(/g, 'log1(');

// 2. The second script's log also got renamed to log1. Let's change it back to log
code = code.replace(/function log1\(label, \{ status, data \}\) \{/g, 'function log(label, { status, data }) {');
code = code.replace(/log1\(/g, 'log('); // Oops, this would revert the first one too.

// Let's do it safely:
let firstPart = code.substring(0, code.indexOf('runTests().catch('));
let secondPart = code.substring(code.indexOf('runTests().catch('));

firstPart = firstPart.replace(/function log\(/g, 'function log1(');
firstPart = firstPart.replace(/log\(/g, 'log1(');
// Also fix dates
firstPart = firstPart.replace(/'2026-12-20'/g, "new Date().toLocaleDateString('en-CA')");

secondPart = secondPart.replace(/const days = \['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'\];/g, "const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];");

fs.writeFileSync('test-api.js', firstPart + secondPart);
console.log('Fixed test-api.js');
