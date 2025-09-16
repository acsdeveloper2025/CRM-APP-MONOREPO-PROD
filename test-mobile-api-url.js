const { chromium } = require('playwright');

// Configuration
const STATIC_IP = '103.14.234.36';
const MOBILE_URL = `http://${STATIC_IP}:5180`;

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, prefix, message) {
    console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function success(message) {
    log(colors.green, '✓', message);
}

function error(message) {
    log(colors.red, '✗', message);
}

function info(message) {
    log(colors.blue, 'INFO', message);
}

function warning(message) {
    log(colors.yellow, '!', message);
}

async function testMobileAPIURL() {
    console.log('🧪 Testing Mobile App API URL Configuration');
    console.log('===========================================');
    console.log('');
    
    let browser;
    
    try {
        // Launch browser
        info('Launching browser...');
        browser = await chromium.launch({ 
            headless: false,  // Show browser for debugging
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Listen for console messages to see API URL detection
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (text.includes('API URL') || text.includes('AuthContext')) {
                info(`Console: ${text}`);
            }
        });
        
        // Listen for network requests to see which API URL is being used
        const networkRequests = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('/api/')) {
                networkRequests.push(url);
                info(`Network Request: ${url}`);
            }
        });
        
        // Navigate to mobile app
        info(`Navigating to mobile app: ${MOBILE_URL}`);
        await page.goto(MOBILE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for page to load and API detection to complete
        await page.waitForTimeout(3000);
        
        // Try to find login form
        const loginForm = await page.locator('input[type="text"], input[type="email"]').first();
        const passwordField = await page.locator('input[type="password"]').first();
        
        if (await loginForm.count() > 0 && await passwordField.count() > 0) {
            success('Login form found');
            
            // Fill in login credentials
            await loginForm.fill('nikhil.parab');
            await passwordField.fill('nikhil123');
            
            info('Filled login credentials');
            
            // Find and click login button
            const loginButton = await page.locator('button').filter({ hasText: /login|sign in/i }).first();
            
            if (await loginButton.count() > 0) {
                info('Attempting login...');
                
                // Click login and wait for network activity
                await Promise.all([
                    page.waitForResponse(response => response.url().includes('/api/mobile/auth/login'), { timeout: 10000 }),
                    loginButton.click()
                ]);
                
                success('Login request sent');
                
                // Check which API URL was used
                const loginRequests = networkRequests.filter(url => url.includes('/api/mobile/auth/login'));
                
                if (loginRequests.length > 0) {
                    const loginURL = loginRequests[0];
                    if (loginURL.includes(STATIC_IP)) {
                        success(`✅ Login request used static IP: ${loginURL}`);
                    } else {
                        error(`❌ Login request used wrong URL: ${loginURL}`);
                    }
                } else {
                    warning('No login requests detected');
                }
                
            } else {
                warning('Login button not found');
            }
        } else {
            warning('Login form not found - may already be logged in');
        }
        
        // Wait a bit more to see any additional network requests
        await page.waitForTimeout(2000);
        
        // Summary
        console.log('');
        console.log('===========================================');
        console.log('Test Summary:');
        console.log(`Total API requests: ${networkRequests.length}`);
        
        const staticIPRequests = networkRequests.filter(url => url.includes(STATIC_IP));
        const localIPRequests = networkRequests.filter(url => url.includes('10.100.100.30'));
        
        console.log(`Requests to static IP (${STATIC_IP}): ${staticIPRequests.length}`);
        console.log(`Requests to local IP (10.100.100.30): ${localIPRequests.length}`);
        
        if (staticIPRequests.length > 0) {
            success('✅ Mobile app is using static IP for API requests!');
            staticIPRequests.forEach(url => info(`  ${url}`));
        } else if (localIPRequests.length > 0) {
            error('❌ Mobile app is still using local IP for API requests');
            localIPRequests.forEach(url => error(`  ${url}`));
        } else {
            warning('⚠️ No API requests detected');
        }
        
        // Keep browser open for manual inspection
        info('Browser will stay open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (err) {
        error(`Test failed: ${err.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
testMobileAPIURL().catch(console.error);
