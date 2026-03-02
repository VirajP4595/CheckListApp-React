import { create } from 'zustand';
import type { UserContext } from '../models';
import { sharePointGroupService } from '../services/sharePointGroupService';
import { AppConfig } from '../config/environment';

interface UserState {
    user: UserContext | null;
    isLoading: boolean;
    isSuperAdmin: boolean;
    isAdminChecked: boolean;

    setUser: (user: UserContext | null) => void;
    checkAdminRole: () => Promise<void>;
    loadUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isLoading: false,
    isSuperAdmin: false,
    isAdminChecked: false,

    setUser: (user) => set({ user }),

    checkAdminRole: async () => {
        try {
            const isAdmin = await sharePointGroupService.isCurrentUserInGroup(AppConfig.admin.superAdminGroup);
            set({ isSuperAdmin: isAdmin, isAdminChecked: true });
        } catch (error) {
            console.error('Failed to check admin role', error);
            set({ isSuperAdmin: false, isAdminChecked: true });
        }
    },

    loadUser: async () => {
        set({ isLoading: true });
        // In production, user is typically handled by AuthProvider
        // This store can still hold the semantic "UserContext"
        set({ isLoading: false });
    },
}));
