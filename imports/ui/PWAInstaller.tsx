import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // Detect if we're on localhost/development (ngrok is considered production for PWA testing)
    const localhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    setIsLocalhost(localhost);

    // Detect iOS and Android
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const android = /Android/.test(navigator.userAgent);
    setIsIOS(iOS);
    setIsAndroid(android);

    // Debug info for troubleshooting
    const debug = `Platform: ${navigator.userAgent}
HTTPS: ${location.protocol === 'https:'}
Localhost: ${localhost}
iOS: ${iOS}
Android: ${android}
Service Worker: ${'serviceWorker' in navigator}
BeforeInstallPrompt supported: ${'onbeforeinstallprompt' in window}`;
    setDebugInfo(debug);
    console.log('🔍 PWA Debug Info:', debug);

    // Additional Android debugging
    if (android) {
      console.log('🤖 Android Device Detected - PWA Install Requirements Check:', {
        hostname: window.location.hostname,
        isHTTPS: location.protocol === 'https:',
        hasManifest: !!document.querySelector('link[rel="manifest"]'),
        hasServiceWorker: 'serviceWorker' in navigator,
        isLocalhost: localhost,
        localhostCheck: {
          isLocalhost: window.location.hostname === 'localhost',
          is127001: window.location.hostname === '127.0.0.1',
          actualHostname: window.location.hostname
        },
        userAgent: navigator.userAgent,
        supportsBIP: 'onbeforeinstallprompt' in window,
        currentURL: window.location.href
      });

      // Check if service worker is registered
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          console.log('🔧 Service Worker Status:', {
            registrations: registrations.length,
            active: registrations.map(reg => ({
              scope: reg.scope,
              state: reg.active?.state
            }))
          });
        });
      }
    }

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isIOSStandalone);

    // Check if user has dismissed the banner before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    setIsDismissed(dismissed === 'true');

    // For iOS, show install prompt if not installed and not dismissed (works in production)
    if (iOS && !isIOSStandalone && !dismissed) {
      setTimeout(() => {
        setShowBanner(true);
        setIsInstallable(true);
      }, 3000);
      return;
    }

    // Listen for the beforeinstallprompt event (Android/Desktop on HTTPS)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🚀 ANDROID: beforeinstallprompt event fired!', {
        event: e,
        eventType: e.type,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        isAndroid: android,
        isLocalhost: localhost
      });
      
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      
      console.log('✅ ANDROID: Install prompt deferred and ready!', {
        deferredPrompt: !!e,
        isInstallable: true
      });
      
      // Show banner after a delay if not dismissed
      if (!dismissed) {
        console.log('📱 ANDROID: Showing install banner in 3 seconds...');
        setTimeout(() => {
          setShowBanner(true);
          console.log('📱 ANDROID: Install banner now visible!');
        }, 3000); // Show after 3 seconds
      } else {
        console.log('❌ ANDROID: Install banner dismissed by user previously');
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('App installed successfully!');
      setIsInstalled(true);
      setIsInstallable(false);
      setShowBanner(false);
      setShowIOSInstructions(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-install-dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Android debug: Check if beforeinstallprompt event fires within 10 seconds
    if (android && !localhost) {
      setTimeout(() => {
        if (!deferredPrompt) {
          console.log('⚠️ ANDROID: beforeinstallprompt event did NOT fire after 10 seconds!');
          console.log('🔍 ANDROID: Possible reasons:', {
            'Not HTTPS': location.protocol !== 'https:',
            'No Service Worker': !('serviceWorker' in navigator),
            'No Manifest': !document.querySelector('link[rel="manifest"]'),
            'Already Installed': isStandalone || isIOSStandalone,
            'User Dismissed Before': dismissed === 'true',
            'Not Chrome/Edge': !/Chrome|Edg/.test(navigator.userAgent),
            'Engagement Requirements': 'User may need to interact with site more'
          });
        } else {
          console.log('✅ ANDROID: beforeinstallprompt event fired successfully!');
        }
      }, 10000);
    }

    // Force show install button for testing (remove this in final version)
    if (!localhost && android && !isStandalone && !dismissed) {
      setTimeout(() => {
        if (!deferredPrompt) {
          console.warn('No beforeinstallprompt event received on Android. Check PWA criteria.');
          // Still show the install button for manual testing
          setIsInstallable(true);
          setShowBanner(true);
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // Handle iOS Safari install instructions
    if (isIOS && !deferredPrompt) {
      setShowIOSInstructions(true);
      return;
    }

    // For Android without beforeinstallprompt, show manual instructions
    if (isAndroid && !deferredPrompt) {
      alert(`📱 Manual Install Instructions for Android:

1. Open Chrome menu (3 dots) ⋮
2. Tap "Add to Home screen" or "Install app"
3. Confirm installation

If you don't see the option:
• Make sure you're using Chrome/Edge
• Check that the URL is HTTPS
• Try refreshing the page

Debug Info:
${debugInfo}`);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installation accepted');
        setShowBanner(false);
      } else {
        console.log('PWA installation dismissed');
        handleDismiss();
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSInstructions(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const MobileIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="16" height="24" rx="3" fill="currentColor"/>
      <rect x="10" y="7" width="12" height="16" fill="white"/>
      <circle cx="16" cy="25" r="1" fill="white"/>
    </svg>
  );

  const DownloadIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13L6 9H8V5H12V9H14L10 13Z" fill="currentColor"/>
      <path d="M4 15H16V17H4V15Z" fill="currentColor"/>
    </svg>
  );

  const CloseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.25 6.25L8.125 14.375L3.75 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const ShareIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3V13M10 3L6 7M10 3L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 14V16C3 16.5523 3.44772 17 4 17H16C16.5523 17 17 16.5523 17 16V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  const HomeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10L10 3L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 8V16C5 16.5523 5.44772 17 6 17H14C14.5523 17 15 16.5523 15 16V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  if (isInstalled) {
    return (
      <div style={styles.installedContainer}>
        <CheckIcon />
        <span style={styles.installedText}>App Installed</span>
      </div>
    );
  }

  // Debug mode for Android - show debug info even if not installable
  if (isAndroid && !isLocalhost && !isInstalled && (!isInstallable || !showBanner)) {
    return (
      <div style={styles.debugContainer}>
        <div style={styles.debugHeader}>🤖 Android PWA Debug</div>
        <div style={styles.debugText}>
          <div>Event Fired: {deferredPrompt ? '✅ Yes' : '❌ No'}</div>
          <div>HTTPS: {window.location.protocol === 'https:' ? '✅' : '❌'}</div>
          <div>Dismissed: {isDismissed ? '✅' : '❌'}</div>
        </div>
        <button 
          onClick={() => {
            console.log('🔍 Manual Debug Trigger - Current State:', {
              deferredPrompt: !!deferredPrompt,
              isInstallable,
              showBanner,
              isDismissed,
              debugInfo
            });
            // Force show banner for testing
            setShowBanner(true);
            setIsInstallable(true);
          }}
          style={styles.debugButton}
        >
          Force Test
        </button>
      </div>
    );
  }

  if (!isInstallable || isDismissed || !showBanner) {
    return null;
  }

  // iOS Installation Instructions
  if (showIOSInstructions) {
    return (
      <div style={styles.bannerContainer}>
        <div style={styles.banner}>
          <div style={styles.bannerContent}>
            <div style={styles.iconContainer}>
              <MobileIcon />
            </div>
            <div style={styles.textContent}>
              <h3 style={styles.bannerTitle}>Install App</h3>
              <div style={styles.iosInstructions}>
                <p style={styles.iosStep}>
                  <span style={styles.stepNumber}>1.</span>
                  Tap the <ShareIcon /> share button
                </p>
                <p style={styles.iosStep}>
                  <span style={styles.stepNumber}>2.</span>
                  Tap "Add to Home Screen" <HomeIcon />
                </p>
              </div>
            </div>
          </div>
          <div style={styles.actions}>
            <button onClick={handleDismiss} style={styles.dismissButton}>
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.bannerContainer}>
      <div style={styles.banner}>
        <div style={styles.bannerContent}>
          <div style={styles.iconContainer}>
            <MobileIcon />
          </div>
          <div style={styles.textContent}>
            <h3 style={styles.bannerTitle}>
              {isLocalhost ? 'Install App (Dev Mode)' : 'Install App'}
            </h3>
            <p style={styles.bannerDescription}>
              {isLocalhost 
                ? 'Click for install instructions (needs HTTPS)'
                : 'Get quick access and enhanced features'
              }
            </p>
          </div>
        </div>
        <div style={styles.actions}>
          <button onClick={handleInstallClick} style={styles.installButton}>
            <DownloadIcon />
            <span>Install</span>
          </button>
          <button onClick={handleDismiss} style={styles.dismissButton}>
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  bannerContainer: {
    position: 'fixed' as const,
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    maxWidth: '400px',
    width: 'calc(100% - 32px)',
    animation: 'slideDown 0.3s ease-out',
  },

  banner: {
    backgroundColor: '#ffffff',
    border: '1px solid #e1e5e9',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  } as React.CSSProperties,

  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  } as React.CSSProperties,

  iconContainer: {
    color: '#667eea',
    flexShrink: 0,
  } as React.CSSProperties,

  textContent: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  bannerTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 4px 0',
    color: '#1a1a1b',
    lineHeight: '20px',
  } as React.CSSProperties,

  bannerDescription: {
    fontSize: '13px',
    color: '#7c7c83',
    margin: 0,
    lineHeight: '16px',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  } as React.CSSProperties,

  installButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#5a6fd8',
      transform: 'translateY(-1px)',
    }
  } as React.CSSProperties,

  dismissButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    backgroundColor: 'transparent',
    color: '#7c7c83',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#f6f7f8',
      color: '#1a1a1b',
    }
  } as React.CSSProperties,

  installedContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#d4edda',
    color: '#155724',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #c3e6cb',
  } as React.CSSProperties,

  installedText: {
    fontSize: '13px',
  } as React.CSSProperties,

  iosInstructions: {
    marginTop: '8px',
  } as React.CSSProperties,

  iosStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#7c7c83',
    margin: '4px 0',
    lineHeight: '16px',
  } as React.CSSProperties,

  stepNumber: {
    backgroundColor: '#667eea',
    color: 'white',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  debugContainer: {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '8px',
    padding: '12px',
    maxWidth: '250px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  } as React.CSSProperties,

  debugHeader: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#856404',
  } as React.CSSProperties,

  debugText: {
    fontSize: '12px',
    color: '#856404',
    marginBottom: '8px',
    lineHeight: '1.4',
  } as React.CSSProperties,

  debugButton: {
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#856404',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  } as React.CSSProperties,
};

// Add CSS animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @media (max-width: 480px) {
    .pwa-banner-container {
      top: 8px;
      width: calc(100% - 16px);
    }
  }
`;
document.head.appendChild(styleSheet);
