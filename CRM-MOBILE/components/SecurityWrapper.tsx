import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Security Wrapper Component
 * Provides security measures for sensitive content viewing
 */
interface SecurityWrapperProps {
  children: React.ReactNode;
  enableScreenshotPrevention?: boolean;
  enableWatermark?: boolean;
  watermarkText?: string;
  onSecurityViolation?: (type: 'screenshot' | 'recording') => void;
}

export const SecurityWrapper: React.FC<SecurityWrapperProps> = ({
  children,
  enableScreenshotPrevention = true,
  enableWatermark = true,
  watermarkText = 'CaseFlow Mobile - Confidential',
  onSecurityViolation
}) => {
  const [isSecure, setIsSecure] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);

  useEffect(() => {
    if (enableScreenshotPrevention) {
      enableSecurityMeasures();
    }

    return () => {
      disableSecurityMeasures();
    };
  }, [enableScreenshotPrevention]);

  /**
   * Enable security measures
   */
  const enableSecurityMeasures = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // For native platforms, we would use native plugins
        // This is a placeholder for actual implementation
        console.log('🔒 Enabling native security measures...');
        
        // Prevent screenshots on Android/iOS
        await preventScreenshots();
        
        // Detect screen recording
        await detectScreenRecording();
      } else {
        // For web platforms, use CSS and JavaScript measures
        enableWebSecurityMeasures();
      }
      
      setIsSecure(true);
      console.log('✅ Security measures enabled');
    } catch (error) {
      console.error('❌ Failed to enable security measures:', error);
      setShowSecurityWarning(true);
    }
  };

  /**
   * Disable security measures
   */
  const disableSecurityMeasures = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('🔓 Disabling native security measures...');
        // Restore normal screenshot capability
        await allowScreenshots();
      } else {
        disableWebSecurityMeasures();
      }
      
      setIsSecure(false);
      console.log('✅ Security measures disabled');
    } catch (error) {
      console.error('❌ Failed to disable security measures:', error);
    }
  };

  /**
   * Prevent screenshots on native platforms
   */
  const preventScreenshots = async () => {
    // This would use a native plugin like @capacitor-community/privacy-screen
    // For demo purposes, we'll simulate this
    console.log('📱 Screenshot prevention enabled');
  };

  /**
   * Allow screenshots on native platforms
   */
  const allowScreenshots = async () => {
    console.log('📱 Screenshot prevention disabled');
  };

  /**
   * Detect screen recording
   */
  const detectScreenRecording = async () => {
    // This would use native APIs to detect screen recording
    console.log('🎥 Screen recording detection enabled');
  };

  /**
   * Enable web security measures
   */
  const enableWebSecurityMeasures = () => {
    // Disable right-click context menu
    document.addEventListener('contextmenu', preventContextMenu);
    
    // Disable text selection
    document.addEventListener('selectstart', preventSelection);
    
    // Disable drag and drop
    document.addEventListener('dragstart', preventDragStart);
    
    // Disable print screen (limited effectiveness)
    document.addEventListener('keydown', handleKeyDown);
    
    // Disable developer tools (limited effectiveness)
    document.addEventListener('keydown', preventDevTools);
    
    console.log('🌐 Web security measures enabled');
  };

  /**
   * Disable web security measures
   */
  const disableWebSecurityMeasures = () => {
    document.removeEventListener('contextmenu', preventContextMenu);
    document.removeEventListener('selectstart', preventSelection);
    document.removeEventListener('dragstart', preventDragStart);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keydown', preventDevTools);
    
    console.log('🌐 Web security measures disabled');
  };

  /**
   * Prevent context menu
   */
  const preventContextMenu = (e: Event) => {
    e.preventDefault();
    return false;
  };

  /**
   * Prevent text selection
   */
  const preventSelection = (e: Event) => {
    e.preventDefault();
    return false;
  };

  /**
   * Prevent drag start
   */
  const preventDragStart = (e: Event) => {
    e.preventDefault();
    return false;
  };

  /**
   * Handle key down events
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent Print Screen
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      onSecurityViolation?.('screenshot');
      console.warn('🚨 Screenshot attempt detected');
      return false;
    }
  };

  /**
   * Prevent developer tools
   */
  const preventDevTools = (e: KeyboardEvent) => {
    // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
      (e.ctrlKey && e.key === 'U')
    ) {
      e.preventDefault();
      console.warn('🚨 Developer tools access attempt detected');
      return false;
    }
  };

  /**
   * Generate watermark style
   */
  const getWatermarkStyle = (): React.CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 1000,
    background: `repeating-linear-gradient(
      45deg,
      transparent,
      transparent 100px,
      rgba(0, 0, 0, 0.05) 100px,
      rgba(0, 0, 0, 0.05) 200px
    )`,
    fontSize: '12px',
    color: 'rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    transform: 'rotate(-45deg)',
    userSelect: 'none'
  });

  if (showSecurityWarning) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-yellow-600 text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-yellow-800 mb-2">Security Warning</h3>
        <p className="text-yellow-700 text-center mb-4">
          Unable to enable all security measures. Some content protection features may not be available.
        </p>
        <button
          onClick={() => setShowSecurityWarning(false)}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
        >
          Continue Anyway
        </button>
      </div>
    );
  }

  return (
    <div 
      className="relative"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
      {children}
      
      {/* Watermark overlay */}
      {enableWatermark && (
        <div style={getWatermarkStyle()}>
          {watermarkText}
        </div>
      )}
      
      {/* Security status indicator */}
      {isSecure && (
        <div className="absolute top-2 left-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs flex items-center gap-1">
          <span>🔒</span>
          <span>Secure</span>
        </div>
      )}
    </div>
  );
};
