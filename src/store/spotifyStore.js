import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { refreshAccessToken, handleCallback, getClientId } from '../lib/spotifyAuth';
import { getUserProfile } from '../lib/spotifyAPI';

const useSpotifyStore = create(
  persist(
    (set, get) => ({
      // Auth state
      accessToken: null,
      refreshToken: null,
      expiresAt: 0,
      isAuthenticated: false,

      // User info
      user: null, // { id, displayName, product, imageUrl }

      // Active device
      activeDeviceId: null,
      activeDeviceName: null,

      /**
       * Handle OAuth callback code → exchange for tokens.
       */
      handleAuthCallback: async (code) => {
        const tokens = await handleCallback(code);
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          isAuthenticated: true,
        });

        // Fetch user profile
        try {
          const profile = await getUserProfile(tokens.accessToken);
          set({ user: profile });
        } catch {
          // Non-critical — auth still works
        }
      },

      /**
       * Get a valid access token, refreshing if needed.
       * Returns null if not authenticated.
       */
      getToken: async () => {
        const state = get();
        if (!state.isAuthenticated || !state.refreshToken) return null;

        // Token still valid (with 60s buffer)
        if (state.accessToken && Date.now() < state.expiresAt - 60000) {
          return state.accessToken;
        }

        // Need to refresh
        try {
          const tokens = await refreshAccessToken(state.refreshToken);
          set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
          });
          return tokens.accessToken;
        } catch {
          // Refresh failed — log out
          get().logout();
          return null;
        }
      },

      setActiveDevice: (deviceId, deviceName) => {
        set({ activeDeviceId: deviceId, activeDeviceName: deviceName });
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: 0,
          isAuthenticated: false,
          user: null,
          activeDeviceId: null,
          activeDeviceName: null,
        });
      },
    }),
    {
      name: 'akkoordenboek-spotify',
      version: 1,
      // Only persist tokens and user — not transient state
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        activeDeviceId: state.activeDeviceId,
        activeDeviceName: state.activeDeviceName,
      }),
    }
  )
);

export default useSpotifyStore;
