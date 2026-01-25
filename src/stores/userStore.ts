import { create } from 'zustand';
import type { UserContext } from '../models';

interface UserState {
    user: UserContext | null;
    isLoading: boolean;

    setUser: (user: UserContext | null) => void;
    loadUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isLoading: false,

    setUser: (user) => set({ user }),

    loadUser: async () => {
        set({ isLoading: true });
        // In production, user is typically handled by AuthProvider
        // This store can still hold the semantic "UserContext"
        set({ isLoading: false });
    },
}));
