const fs = require('fs');
const path = require('path');

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.next') {
            walk(full);
        } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('depends_on_email_id')) {
                const updated = content.replaceAll('depends_on_email_id', 'depends_on_queue_id');
                fs.writeFileSync(full, updated, 'utf8');
                console.log('Fixed:', full);
            }
        }
    }
}

walk('src');
console.log('Done');
