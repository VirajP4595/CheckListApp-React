import { PublicClientApplication, Configuration, AccountInfo, SilentRequest, RedirectRequest, InteractionRequiredAuthError, BrowserAuthError } from '@azure/msal-browser';
import { AppConfig } from '../config/environment';

// ─── MSAL CONFIGURATION ────────────────────────────────────

const msalConfig: Configuration = {
    auth: {
        clientId: AppConfig.auth.clientId,
        authority: AppConfig.auth.authority,
        redirectUri: AppConfig.auth.redirectUri,
        postLogoutRedirectUri: AppConfig.auth.redirectUri,
        navigateToLoginRequestUrl: true
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: true // Helps with IE11/Edge
    },
    system: {
        allowNativeBroker: false, // Disable native broker to avoid iframe issues
        windowHashTimeout: 60000,
        iframeHashTimeout: 10000,
        loadFrameTimeout: 10000
    }
};

// ─── MSAL INSTANCE ─────────────────────────────────────────

export const msalInstance = new PublicClientApplication(msalConfig);

// Track initialization state
let msalInitialized = false;
let initializationPromise: Promise<void> | null = null;
let isRedirectInProgress = false;

/**
 * Check if we're in a hidden iframe (which blocks certain MSAL operations)
 */
function isInIframe(): boolean {
    try {
        return window !== window.parent;
    } catch {
        return true;
    }
}

/**
 * Initialize MSAL and handle any redirect response
 */
async function ensureInitialized(): Promise<void> {
    if (msalInitialized) return;

    if (!initializationPromise) {
        initializationPromise = (async () => {
            await msalInstance.initialize();

            // Handle redirect response if returning from login
            try {
                const response = await msalInstance.handleRedirectPromise();
                if (response) {
                    console.log('Login successful:', response.account?.username);
                    isRedirectInProgress = false;
                }
            } catch (error) {
                console.error('Redirect handling error:', error);
                isRedirectInProgress = false;
            }

            msalInitialized = true;
        })();
    }

    await initializationPromise;
}

// Start initialization immediately
ensureInitialized().catch(console.error);

// ─── TOKEN ACQUISITION ─────────────────────────────────────

/**
 * Get access token for Dataverse API
 */
export async function getDataverseToken(): Promise<string> {
    await ensureInitialized();

    // If we're in an iframe, we can't do interactive auth
    if (isInIframe()) {
        throw new Error('Cannot acquire token in iframe. Please open in main window.');
    }

    const account = getActiveAccount();
    if (!account) {
        // No account, redirect to login
        if (!isRedirectInProgress) {
            isRedirectInProgress = true;
            await signIn();
        }
        throw new Error('Redirecting to login...');
    }

    const request: SilentRequest = {
        scopes: AppConfig.auth.scopes.dataverse,
        account,
        forceRefresh: false
    };

    try {
        const response = await msalInstance.acquireTokenSilent(request);
        return response.accessToken;
    } catch (error) {
        // Check if it's a browser auth error that we can handle
        // We also handle 'monitor_window_timeout' which implies the silent iframe request failed (e.g. 3rd party cookies or network)
        if (error instanceof InteractionRequiredAuthError ||
            (error instanceof BrowserAuthError && (error.errorCode === 'monitor_window_timeout' || error.errorCode === 'token_renewal_error'))) {
            if (!isRedirectInProgress) {
                console.warn("Silent token acquisition failed (interaction required or timeout). Redirecting for authentication...");
                isRedirectInProgress = true;
                await msalInstance.acquireTokenRedirect(request);
            }
            throw new Error('Redirecting for authentication...');
        }

        // For block_iframe_reload errors, clear cache and redirect to fresh login
        if (error instanceof BrowserAuthError && error.errorCode === 'block_iframe_reload') {
            console.warn('Stale token cache detected. Clearing and redirecting to login...');
            // Clear all MSAL cache
            const accounts = msalInstance.getAllAccounts();
            accounts.forEach(_ => msalInstance.setActiveAccount(null));
            localStorage.clear(); // Clear stale tokens
            if (!isRedirectInProgress) {
                isRedirectInProgress = true;
                await signIn();
            }
            throw new Error('Clearing cache and redirecting to login...');
        }

        throw error;
    }
}

/**
 * Get access token for Microsoft Graph API (SharePoint)
 */
export async function getGraphToken(): Promise<string> {
    await ensureInitialized();

    if (isInIframe()) {
        throw new Error('Cannot acquire token in iframe. Please open in main window.');
    }

    const account = getActiveAccount();
    if (!account) {
        if (!isRedirectInProgress) {
            isRedirectInProgress = true;
            await signIn();
        }
        throw new Error('Redirecting to login...');
    }

    const request: SilentRequest = {
        scopes: AppConfig.auth.scopes.graph,
        account,
        forceRefresh: false
    };

    try {
        const response = await msalInstance.acquireTokenSilent(request);
        return response.accessToken;
    } catch (error) {
        if (error instanceof InteractionRequiredAuthError ||
            (error instanceof BrowserAuthError && (error.errorCode === 'monitor_window_timeout' || error.errorCode === 'token_renewal_error'))) {
            if (!isRedirectInProgress) {
                console.warn("Silent token acquisition failed (interaction required or timeout). Redirecting for authentication...");
                isRedirectInProgress = true;
                await msalInstance.acquireTokenRedirect(request);
            }
            throw new Error('Redirecting for authentication...');
        }
        throw error;
    }
}

// ─── ACCOUNT MANAGEMENT ────────────────────────────────────

/**
 * Get the currently active account
 */
export function getActiveAccount(): AccountInfo | null {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        return null;
    }
    // Return the first account (single-tenant app)
    return accounts[0];
}

/**
 * Sign in via redirect (SSO experience)
 */
export async function signIn(): Promise<void> {
    await ensureInitialized();

    if (isInIframe()) {
        throw new Error('Cannot sign in from iframe. Please open in main window.');
    }

    const request: RedirectRequest = {
        scopes: ['User.Read']
    };

    isRedirectInProgress = true;
    await msalInstance.loginRedirect(request);
}

/**
 * Sign out via redirect
 */
export async function signOut(): Promise<void> {
    await ensureInitialized();

    const account = getActiveAccount();
    if (account) {
        await msalInstance.logoutRedirect({
            account,
            postLogoutRedirectUri: AppConfig.auth.redirectUri
        });
    }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    return getActiveAccount() !== null;
}

/**
 * Check if a redirect is currently in progress
 */
export function isAuthRedirectInProgress(): boolean {
    return isRedirectInProgress;
}
