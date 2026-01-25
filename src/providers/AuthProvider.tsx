import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { msalInstance, signIn, signOut, getActiveAccount } from '../services/authService';

// ─── AUTH CONTEXT ──────────────────────────────────────────

interface AuthContextValue {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AccountInfo | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── AUTH CONTEXT PROVIDER (INNER) ─────────────────────────

function AuthContextProvider({ children }: { children: React.ReactNode }) {
    const { inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [user, setUser] = useState<AccountInfo | null>(null);

    useEffect(() => {
        const account = getActiveAccount();
        if (account) {
            setUser(account);
        } else if (inProgress === InteractionStatus.None) {
            // Auto-login if no user and no interaction in progress
            signIn().catch(console.error);
        }
    }, [isAuthenticated, inProgress]);

    const login = useCallback(async () => {
        await signIn();
    }, []);

    const logout = useCallback(async () => {
        await signOut();
        setUser(null);
    }, []);

    const isLoading = inProgress !== InteractionStatus.None;

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── AUTH PROVIDER (OUTER WRAPPER) ─────────────────────────

interface AuthProviderProps {
    children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    return (
        <MsalProvider instance={msalInstance}>
            <AuthContextProvider>
                {children}
            </AuthContextProvider>
        </MsalProvider>
    );
}

// ─── HOOK ──────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
