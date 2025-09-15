import { Linking } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';

export interface DeepLinkData {
  type: 'case' | 'notification' | 'form' | 'settings';
  id?: string;
  action?: string;
  params?: Record<string, any>;
}

class DeepLinkingService {
  private static instance: DeepLinkingService;
  private navigationRef: NavigationContainerRef<any> | null = null;
  private pendingLink: string | null = null;

  private constructor() {}

  public static getInstance(): DeepLinkingService {
    if (!DeepLinkingService.instance) {
      DeepLinkingService.instance = new DeepLinkingService();
    }
    return DeepLinkingService.instance;
  }

  /**
   * Initialize deep linking service
   */
  public initialize(navigationRef: NavigationContainerRef<any>): void {
    this.navigationRef = navigationRef;

    // Handle initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('📱 App opened with initial URL:', url);
        this.handleDeepLink(url);
      }
    });

    // Listen for incoming links while app is running
    const linkingListener = Linking.addEventListener('url', (event) => {
      console.log('📱 Deep link received:', event.url);
      this.handleDeepLink(event.url);
    });

    // Handle pending link if navigation wasn't ready before
    if (this.pendingLink) {
      this.handleDeepLink(this.pendingLink);
      this.pendingLink = null;
    }

    console.log('✅ Deep linking service initialized');
  }

  /**
   * Handle deep link URL
   */
  public handleDeepLink(url: string): void {
    try {
      if (!this.navigationRef) {
        console.warn('⚠️ Navigation not ready, storing pending link:', url);
        this.pendingLink = url;
        return;
      }

      const linkData = this.parseDeepLink(url);
      if (!linkData) {
        console.warn('⚠️ Invalid deep link format:', url);
        return;
      }

      this.navigateToDeepLink(linkData);
    } catch (error) {
      console.error('❌ Failed to handle deep link:', error);
    }
  }

  /**
   * Parse deep link URL into structured data
   */
  private parseDeepLink(url: string): DeepLinkData | null {
    try {
      // Support multiple URL schemes
      // crm://case/123
      // crm://notification/456
      // crm://form/residence/789
      // https://crm.example.com/cases/123
      
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);

      if (pathSegments.length === 0) {
        return null;
      }

      const type = pathSegments[0] as DeepLinkData['type'];
      const id = pathSegments[1];
      const action = pathSegments[2];

      // Parse query parameters
      const params: Record<string, any> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return {
        type,
        id,
        action,
        params: Object.keys(params).length > 0 ? params : undefined,
      };
    } catch (error) {
      console.error('❌ Failed to parse deep link:', error);
      return null;
    }
  }

  /**
   * Navigate to the appropriate screen based on deep link data
   */
  private navigateToDeepLink(linkData: DeepLinkData): void {
    if (!this.navigationRef) {
      console.warn('⚠️ Navigation not available');
      return;
    }

    console.log('🔗 Navigating to deep link:', linkData);

    switch (linkData.type) {
      case 'case':
        this.navigateToCase(linkData.id, linkData.action, linkData.params);
        break;
      case 'notification':
        this.navigateToNotification(linkData.id, linkData.params);
        break;
      case 'form':
        this.navigateToForm(linkData.id, linkData.action, linkData.params);
        break;
      case 'settings':
        this.navigateToSettings(linkData.action, linkData.params);
        break;
      default:
        console.warn('⚠️ Unknown deep link type:', linkData.type);
        this.navigateToHome();
    }
  }

  /**
   * Navigate to case details
   */
  private navigateToCase(caseId?: string, action?: string, params?: Record<string, any>): void {
    if (!caseId) {
      console.warn('⚠️ Case ID not provided, navigating to cases list');
      this.navigationRef?.navigate('Cases');
      return;
    }

    switch (action) {
      case 'edit':
        this.navigationRef?.navigate('CaseEdit', { caseId, ...params });
        break;
      case 'form':
        this.navigationRef?.navigate('CaseForm', { caseId, ...params });
        break;
      case 'attachments':
        this.navigationRef?.navigate('CaseAttachments', { caseId, ...params });
        break;
      default:
        this.navigationRef?.navigate('CaseDetails', { caseId, ...params });
    }
  }

  /**
   * Navigate to notification center or specific notification
   */
  private navigateToNotification(notificationId?: string, params?: Record<string, any>): void {
    if (notificationId) {
      // Navigate to specific notification (if such screen exists)
      this.navigationRef?.navigate('NotificationDetails', { notificationId, ...params });
    } else {
      // Navigate to notification center
      this.navigationRef?.navigate('Notifications', params);
    }
  }

  /**
   * Navigate to form
   */
  private navigateToForm(formType?: string, action?: string, params?: Record<string, any>): void {
    if (!formType) {
      console.warn('⚠️ Form type not provided');
      return;
    }

    const caseId = params?.caseId;
    if (!caseId) {
      console.warn('⚠️ Case ID not provided for form navigation');
      return;
    }

    switch (formType) {
      case 'residence':
        this.navigationRef?.navigate('ResidenceVerificationForm', { caseId, ...params });
        break;
      case 'office':
        this.navigationRef?.navigate('OfficeVerificationForm', { caseId, ...params });
        break;
      case 'business':
        this.navigationRef?.navigate('BusinessVerificationForm', { caseId, ...params });
        break;
      default:
        console.warn('⚠️ Unknown form type:', formType);
        this.navigateToCase(caseId);
    }
  }

  /**
   * Navigate to settings
   */
  private navigateToSettings(section?: string, params?: Record<string, any>): void {
    switch (section) {
      case 'notifications':
        this.navigationRef?.navigate('NotificationSettings', params);
        break;
      case 'profile':
        this.navigationRef?.navigate('ProfileSettings', params);
        break;
      case 'about':
        this.navigationRef?.navigate('AboutSettings', params);
        break;
      default:
        this.navigationRef?.navigate('Settings', params);
    }
  }

  /**
   * Navigate to home screen
   */
  private navigateToHome(): void {
    this.navigationRef?.navigate('Home');
  }

  /**
   * Generate deep link URL for sharing
   */
  public generateDeepLink(linkData: DeepLinkData): string {
    const baseUrl = 'crm://';
    let path = linkData.type;

    if (linkData.id) {
      path += `/${linkData.id}`;
    }

    if (linkData.action) {
      path += `/${linkData.action}`;
    }

    let url = baseUrl + path;

    if (linkData.params && Object.keys(linkData.params).length > 0) {
      const searchParams = new URLSearchParams(linkData.params);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  /**
   * Generate case deep link
   */
  public generateCaseLink(caseId: string, action?: string, params?: Record<string, any>): string {
    return this.generateDeepLink({
      type: 'case',
      id: caseId,
      action,
      params,
    });
  }

  /**
   * Generate form deep link
   */
  public generateFormLink(
    formType: string,
    caseId: string,
    params?: Record<string, any>
  ): string {
    return this.generateDeepLink({
      type: 'form',
      id: formType,
      params: { caseId, ...params },
    });
  }

  /**
   * Generate notification deep link
   */
  public generateNotificationLink(notificationId?: string, params?: Record<string, any>): string {
    return this.generateDeepLink({
      type: 'notification',
      id: notificationId,
      params,
    });
  }

  /**
   * Share case via deep link
   */
  public async shareCase(caseId: string, caseNumber?: string): Promise<void> {
    try {
      const url = this.generateCaseLink(caseId);
      const message = caseNumber 
        ? `Check out case ${caseNumber}: ${url}`
        : `Check out this case: ${url}`;

      // This would integrate with your sharing mechanism
      console.log('📤 Sharing case:', message);
      
      // Example: await Share.share({ message, url });
    } catch (error) {
      console.error('❌ Failed to share case:', error);
    }
  }

  /**
   * Handle notification tap with deep linking
   */
  public handleNotificationTap(notificationData: any): void {
    try {
      if (notificationData.actionType === 'OPEN_CASE' && notificationData.caseId) {
        const url = this.generateCaseLink(notificationData.caseId);
        this.handleDeepLink(url);
      } else if (notificationData.actionUrl) {
        // Handle custom action URLs
        this.handleDeepLink(notificationData.actionUrl);
      } else {
        // Default to notification center
        const url = this.generateNotificationLink();
        this.handleDeepLink(url);
      }
    } catch (error) {
      console.error('❌ Failed to handle notification tap:', error);
    }
  }

  /**
   * Check if URL is a valid deep link for this app
   */
  public isValidDeepLink(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'crm:' || 
             (urlObj.protocol === 'https:' && urlObj.hostname.includes('crm'));
    } catch {
      return false;
    }
  }

  /**
   * Get current navigation state for debugging
   */
  public getCurrentRoute(): string | null {
    if (!this.navigationRef) {
      return null;
    }

    const state = this.navigationRef.getCurrentRoute();
    return state?.name || null;
  }
}

export const deepLinkingService = DeepLinkingService.getInstance();
