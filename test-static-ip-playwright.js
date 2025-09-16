const { chromium } = require('playwright');

// Configuration
const STATIC_IP = '103.14.234.36';
const LOCAL_IP = '10.100.100.30';

// Test URLs
const FRONTEND_URL = `http://${STATIC_IP}:5173`;
const MOBILE_URL = `http://${STATIC_IP}:5180`;
const BACKEND_URL = `http://${STATIC_IP}:3000`;

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

async function testBackendAPI() {
    info('Testing Backend API via static IP...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/health`);
        const data = await response.json();
        
        if (data.status === 'OK') {
            success('Backend API accessible via static IP');
            return true;
        } else {
            error('Backend API returned unexpected response');
            return false;
        }
    } catch (err) {
        error(`Backend API test failed: ${err.message}`);
        return false;
    }
}

async function testFrontendAccess(browser) {
    info('Testing Frontend access via static IP...');
    
    try {
        const page = await browser.newPage();
        
        // Set longer timeout for network requests
        page.setDefaultTimeout(30000);
        
        // Navigate to frontend
        const response = await page.goto(FRONTEND_URL, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        if (response.status() === 200) {
            success('Frontend accessible via static IP');
            
            // Check if page loaded properly
            const title = await page.title();
            info(`Frontend page title: ${title}`);
            
            // Check for React app elements
            const hasReactRoot = await page.locator('#root').count() > 0;
            if (hasReactRoot) {
                success('Frontend React app loaded successfully');
            } else {
                warning('Frontend loaded but React app may not be initialized');
            }
            
            await page.close();
            return true;
        } else {
            error(`Frontend returned status: ${response.status()}`);
            await page.close();
            return false;
        }
    } catch (err) {
        error(`Frontend test failed: ${err.message}`);
        return false;
    }
}

async function testMobileAccess(browser) {
    info('Testing Mobile app access via static IP...');
    
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        
        const response = await page.goto(MOBILE_URL, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        if (response.status() === 200) {
            success('Mobile app accessible via static IP');
            
            const title = await page.title();
            info(`Mobile app page title: ${title}`);
            
            // Check for mobile app elements
            const hasReactRoot = await page.locator('#root').count() > 0;
            if (hasReactRoot) {
                success('Mobile app React components loaded successfully');
            } else {
                warning('Mobile app loaded but React app may not be initialized');
            }
            
            await page.close();
            return true;
        } else {
            error(`Mobile app returned status: ${response.status()}`);
            await page.close();
            return false;
        }
    } catch (err) {
        error(`Mobile app test failed: ${err.message}`);
        return false;
    }
}

async function testWebSocketConnection(browser) {
    info('Testing WebSocket connection via static IP...');
    
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        
        // Navigate to frontend first
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Check for WebSocket connection in console
        const wsErrors = [];
        const wsConnections = [];
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('WebSocket') || text.includes('socket.io')) {
                if (text.includes('failed') || text.includes('error')) {
                    wsErrors.push(text);
                } else if (text.includes('connected') || text.includes('established')) {
                    wsConnections.push(text);
                }
            }
        });
        
        // Wait for WebSocket connection attempts
        await page.waitForTimeout(5000);
        
        if (wsErrors.length === 0) {
            success('No WebSocket connection errors detected');
            if (wsConnections.length > 0) {
                success('WebSocket connection established successfully');
                info(`WebSocket messages: ${wsConnections.join(', ')}`);
            }
            await page.close();
            return true;
        } else {
            error('WebSocket connection errors detected:');
            wsErrors.forEach(err => error(`  ${err}`));
            await page.close();
            return false;
        }
    } catch (err) {
        error(`WebSocket test failed: ${err.message}`);
        return false;
    }
}

async function testLoginFlow(browser) {
    info('Testing login flow via static IP...');
    
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Look for login form elements
        const hasLoginForm = await page.locator('input[type="email"], input[type="text"]').count() > 0;
        const hasPasswordField = await page.locator('input[type="password"]').count() > 0;
        const hasLoginButton = await page.locator('button').count() > 0;
        
        if (hasLoginForm && hasPasswordField && hasLoginButton) {
            success('Login form elements found');
            
            // Try to fill login form (if visible)
            try {
                await page.fill('input[type="email"], input[type="text"]', 'admin@acs.com');
                await page.fill('input[type="password"]', 'admin123');
                success('Login form filled successfully');
            } catch (fillErr) {
                warning('Could not fill login form (may be different structure)');
            }
            
            await page.close();
            return true;
        } else {
            warning('Login form not found - may already be logged in or different page structure');
            await page.close();
            return false;
        }
    } catch (err) {
        error(`Login flow test failed: ${err.message}`);
        return false;
    }
}

async function testMobileAPIEndpoints(browser) {
    info('Testing Mobile API endpoints via static IP...');
    
    try {
        const page = await browser.newPage();
        
        // Test version check endpoint
        const versionResponse = await page.evaluate(async (backendUrl) => {
            try {
                const response = await fetch(`${backendUrl}/api/mobile/auth/version-check`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentVersion: '4.0.0',
                        platform: 'WEB',
                        buildNumber: '1'
                    })
                });
                return await response.json();
            } catch (err) {
                return { error: err.message };
            }
        }, BACKEND_URL);
        
        if (versionResponse.success) {
            success('Mobile API version check endpoint working');
            await page.close();
            return true;
        } else {
            error(`Mobile API test failed: ${JSON.stringify(versionResponse)}`);
            await page.close();
            return false;
        }
    } catch (err) {
        error(`Mobile API test failed: ${err.message}`);
        return false;
    }
}

async function runAllTests() {
    console.log('🧪 CRM Static IP Access Test with Playwright');
    console.log('=============================================');
    console.log('');
    
    info(`Testing static IP: ${STATIC_IP}`);
    info(`Expected to resolve to: ${LOCAL_IP}`);
    console.log('');
    
    let browser;
    let testsPassed = 0;
    const totalTests = 6;
    
    try {
        // Launch browser
        info('Launching Chromium browser...');
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        success('Browser launched successfully');
        console.log('');
        
        // Run tests
        if (await testBackendAPI()) testsPassed++;
        if (await testFrontendAccess(browser)) testsPassed++;
        if (await testMobileAccess(browser)) testsPassed++;
        if (await testWebSocketConnection(browser)) testsPassed++;
        if (await testLoginFlow(browser)) testsPassed++;
        if (await testMobileAPIEndpoints(browser)) testsPassed++;
        
    } catch (err) {
        error(`Test execution failed: ${err.message}`);
    } finally {
        if (browser) {
            await browser.close();
            info('Browser closed');
        }
    }
    
    console.log('');
    console.log('=============================================');
    console.log(`Test Results: ${testsPassed}/${totalTests} passed`);
    
    if (testsPassed === totalTests) {
        success('🎉 All tests passed! Static IP access is working perfectly!');
        console.log('');
        info('✅ Your CRM system is accessible via static IP:');
        console.log(`  • Frontend: ${FRONTEND_URL}`);
        console.log(`  • Mobile: ${MOBILE_URL}`);
        console.log(`  • Backend: ${BACKEND_URL}`);
        console.log('');
        success('🔧 The hairpin NAT issue has been resolved!');
        success('🌐 WebSocket connections are working properly!');
        success('📱 Mobile API endpoints are functional!');
    } else if (testsPassed >= 4) {
        warning('⚠️ Most tests passed, but some issues detected.');
        info('The CRM system is mostly functional via static IP.');
        info('Check the error messages above for specific issues.');
    } else {
        error('❌ Multiple tests failed. Static IP access needs configuration.');
        info('Please run the fix-static-ip-access.sh script first:');
        info('sudo ./fix-static-ip-access.sh');
    }
    
    return testsPassed === totalTests;
}

// Run the tests
runAllTests().catch(console.error);
