#!/usr/bin/env node

/**
 * Simple Authentication Setup Script
 * Run this script to generate secure passwords and update your .env file
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Simple Authentication Setup\n');

// Generate secure random strings
const generateSecureString = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('base64');
};

const APP_PASSWORD = generateSecureString(24);
const JWT_SECRET = generateSecureString(32);

console.log('Generated secure credentials:');
console.log('═══════════════════════════════════════');
console.log(`APP_PASSWORD:    ${APP_PASSWORD}`);
console.log(`JWT_SECRET:       ${JWT_SECRET}`);
console.log('═══════════════════════════════════════\n');

// Update .env file
const envPath = path.join(__dirname, '..', '.env');

try {
  let envContent = '';
  let envUpdated = false;

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Check if auth variables already exist
  const hasAppPassword = envContent.includes('APP_PASSWORD=');
  const hasJwtSecret = envContent.includes('JWT_SECRET=');

  if (hasAppPassword && hasJwtSecret) {
    console.log('⚠️  Authentication variables already exist in .env');
    console.log('    Skipping .env update to avoid overwriting existing values.\n');
    console.log('    To regenerate, manually update these values in your .env file:');
    console.log(`    APP_PASSWORD=${APP_PASSWORD}`);
    console.log(`    JWT_SECRET=${JWT_SECRET}\n`);
  } else {
    // Append to .env if file exists, otherwise create new
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }

    envContent += `\n# Simple Authentication Configuration\n`;
    envContent += `# Generated on ${new Date().toISOString()}\n`;
    envContent += `APP_PASSWORD=${APP_PASSWORD}\n`;
    envContent += `JWT_SECRET=${JWT_SECRET}\n`;
    envContent += `SESSION_DURATION=86400\n`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with authentication credentials\n');
    envUpdated = true;
  }

  // Print instructions
  console.log('📋 Next Steps:\n');
  console.log('1. Save your password in a secure location (password manager)');
  console.log(`   Password: ${APP_PASSWORD}\n`);

  if (envUpdated) {
    console.log('2. Restart your development server:');
    console.log('   pnpm run dev\n');
  }

  console.log('3. Visit http://localhost:3000');
  console.log('   You will be redirected to the login page\n');

  console.log('4. Enter the password to access the system\n');

  console.log('🔒 Security Tips:');
  console.log('   • Change the password regularly (every 90 days)');
  console.log('   • Use different passwords for dev/staging/production');
  console.log('   • Never commit .env to version control');
  console.log('   • Share the password securely (encrypted messaging only)\n');

  console.log('✨ Setup complete! Your application is now password-protected.\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
