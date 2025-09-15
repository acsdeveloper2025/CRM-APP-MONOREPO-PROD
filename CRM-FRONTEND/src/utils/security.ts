// Input sanitization and validation utilities

export class SecurityUtils {
  // XSS Protection
  static sanitizeHtml(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  static escapeHtml(input: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    
    return input.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
  }

  // SQL Injection Protection (for display purposes)
  static sanitizeSqlInput(input: string): string {
    return input.replace(/[';-]/g, '');
  }

  // URL validation
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  static sanitizeUrl(url: string): string {
    if (!this.isValidUrl(url)) {
      return '#';
    }
    return url;
  }

  // Email validation
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Phone number validation
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  // Password strength validation
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    return {
      isValid: score >= 4,
      score,
      feedback,
    };
  }

  // Content Security Policy helpers
  static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Rate limiting helpers
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, number[]>();

    return (identifier: string): boolean => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(identifier)) {
        requests.set(identifier, []);
      }

      const userRequests = requests.get(identifier)!;
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => time > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
      }

      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      return true; // Request allowed
    };
  }

  // Session security
  static generateSessionId(): string {
    return crypto.randomUUID();
  }

  static isSessionExpired(timestamp: number, maxAge: number): boolean {
    return Date.now() - timestamp > maxAge;
  }

  // CSRF Protection
  static generateCSRFToken(): string {
    return this.generateNonce();
  }

  static validateCSRFToken(token: string, expectedToken: string): boolean {
    return token === expectedToken;
  }

  // File upload security
  static validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type);
  }

  static validateFileSize(file: File, maxSizeBytes: number): boolean {
    return file.size <= maxSizeBytes;
  }

  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // Data masking for logging
  static maskSensitiveData(data: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard'];
    
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    const masked = { ...data };
    
    for (const [key, value] of Object.entries(masked)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object') {
        masked[key] = this.maskSensitiveData(value);
      }
    }

    return masked;
  }

  // Input validation
  static validateInput(input: string, type: 'alphanumeric' | 'numeric' | 'alpha' | 'email' | 'url'): boolean {
    const patterns = {
      alphanumeric: /^[a-zA-Z0-9]+$/,
      numeric: /^[0-9]+$/,
      alpha: /^[a-zA-Z]+$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/.+/,
    };

    return patterns[type].test(input);
  }

  // Secure random string generation
  static generateSecureRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    return Array.from(array, byte => chars[byte % chars.length]).join('');
  }

  // Content validation
  static containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  // Browser security checks
  static checkBrowserSecurity(): {
    hasSecureContext: boolean;
    hasLocalStorage: boolean;
    hasSessionStorage: boolean;
    hasCrypto: boolean;
    cookiesEnabled: boolean;
  } {
    return {
      hasSecureContext: window.isSecureContext,
      hasLocalStorage: typeof Storage !== 'undefined',
      hasSessionStorage: typeof sessionStorage !== 'undefined',
      hasCrypto: typeof crypto !== 'undefined',
      cookiesEnabled: navigator.cookieEnabled,
    };
  }

  // Secure storage helpers
  static secureStore(key: string, value: any, encrypt: boolean = false): void {
    try {
      let dataToStore = JSON.stringify(value);
      
      if (encrypt) {
        // In a real app, you would use proper encryption
        dataToStore = btoa(dataToStore);
      }
      
      localStorage.setItem(key, dataToStore);
    } catch (error) {
      console.error('Failed to store data securely:', error);
    }
  }

  static secureRetrieve(key: string, decrypt: boolean = false): any {
    try {
      let data = localStorage.getItem(key);
      
      if (!data) return null;
      
      if (decrypt) {
        data = atob(data);
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to retrieve data securely:', error);
      return null;
    }
  }
}
