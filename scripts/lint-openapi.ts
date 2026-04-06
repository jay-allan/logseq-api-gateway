import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const configPath = path.join(ROOT, 'dev.config.json');

if (!fs.existsSync(configPath)) {
    console.error(
        'dev.config.json not found.\n' +
        'Copy dev.config.example.json → dev.config.json and fill in your rmoaApiKey.\n' +
        'See DEVELOPMENT.md § OpenAPI generation for details.'
    );
    process.exit(1);
}

const devConfig = JSON.parse(
    fs.readFileSync(configPath, 'utf-8')
) as { rmoaApiKey?: string };

if (!devConfig.rmoaApiKey || devConfig.rmoaApiKey === 'your-rmoa-api-key-here') {
    console.error(
        'rmoaApiKey is not set in dev.config.json.\n' +
        'Sign up at https://api.ratemyopenapi.com/docs and add your key.'
    );
    process.exit(1);
}

execSync(
    `rmoa lint --dir openapi --filename spec.json --minimum-score 80 --api-key ${devConfig.rmoaApiKey}`,
    { stdio: 'inherit', cwd: ROOT }
);
