import { useState, useEffect } from 'react';
import { getClientId, setClientId, startLogin } from '../lib/spotifyAuth';
import useSpotifyStore from '../store/spotifyStore';
import { getDevices } from '../lib/spotifyAPI';

export default function SpotifySettingsScreen({ onBack }) {
  const { isAuthenticated, user, logout, getToken, activeDeviceId, setActiveDevice } = useSpotifyStore();
  const [clientIdInput, setClientIdInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    setClientIdInput(getClientId());
  }, []);

  // Load devices when authenticated
  useEffect(() => {
    if (isAuthenticated) loadDevices();
  }, [isAuthenticated]);

  const handleSaveClientId = () => {
    setClientId(clientIdInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogin = async () => {
    try {
      await startLogin();
    } catch (err) {
      alert(err.message);
    }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const token = await getToken();
      if (token) {
        const devs = await getDevices(token);
        setDevices(devs);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDevices(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/60 backdrop-blur-sm border-b border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <h1 className="text-lg font-bold text-gray-800">Spotify Instellingen</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Status */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-3 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3">
            {user.imageUrl && (
              <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-green-800">{user.displayName}</p>
              <p className="text-xs text-green-600">
                {user.product === 'premium' ? 'Premium' : 'Gratis'} account
              </p>
            </div>
            <button
              onClick={logout}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-green-300 text-sm font-semibold text-green-700 active:scale-95 transition-transform"
            >
              Uitloggen
            </button>
          </div>
        )}

        {isAuthenticated && user?.product !== 'premium' && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            <p className="font-bold">Spotify Premium vereist</p>
            <p>De Spotify Connect API werkt alleen met een Premium account.</p>
          </div>
        )}

        {/* Client ID */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-1">
            Spotify Client ID
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Maak een app op{' '}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 underline"
            >
              developer.spotify.com
            </a>
            {' '}en plak het Client ID hier. Zet als redirect URI:{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">{window.location.origin}/</code>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="Plak je Client ID"
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-mono text-sm focus:border-green-500 focus:outline-none transition-colors"
            />
            <button
              onClick={handleSaveClientId}
              className={`shrink-0 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {saved ? 'Opgeslagen!' : 'Bewaar'}
            </button>
          </div>
        </div>

        {/* Login button */}
        {!isAuthenticated && (
          <button
            onClick={handleLogin}
            disabled={!getClientId()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#1DB954] text-white font-bold text-base disabled:opacity-50 active:scale-95 transition-transform shadow-lg shadow-green-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Inloggen met Spotify
          </button>
        )}

        {/* Devices */}
        {isAuthenticated && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-gray-600">Apparaten</label>
              <button
                onClick={loadDevices}
                disabled={loadingDevices}
                className="text-xs font-semibold text-green-600 active:scale-95 transition-transform"
              >
                {loadingDevices ? 'Laden...' : 'Vernieuwen'}
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl px-4 py-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Geen apparaten gevonden</p>
                <p className="text-xs text-gray-400">
                  Open de Spotify app op je telefoon, tablet of computer
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => setActiveDevice(device.id, device.name)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                      device.id === activeDeviceId
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <DeviceIcon type={device.type} active={device.id === activeDeviceId} />
                    <div className="flex-1 text-left min-w-0">
                      <p className={`text-sm font-bold truncate ${
                        device.id === activeDeviceId ? 'text-green-700' : 'text-gray-800'
                      }`}>
                        {device.name}
                      </p>
                      <p className="text-xs text-gray-400">{device.type}</p>
                    </div>
                    {device.isActive && (
                      <span className="shrink-0 text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        Actief
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
          <h3 className="text-sm font-bold text-gray-600">Hoe werkt het?</h3>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Maak een Spotify Developer app aan (gratis)</li>
            <li>Plak het Client ID hierboven en bewaar</li>
            <li>Log in met je Spotify Premium account</li>
            <li>Open Spotify op het apparaat waarop je wil luisteren</li>
            <li>Koppel een Spotify track aan je liedje in de editor</li>
            <li>De app bestuurt Spotify op afstand terwijl je speelt!</li>
          </ol>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

function DeviceIcon({ type, active }) {
  const color = active ? '#16a34a' : '#9ca3af';
  if (type === 'Smartphone') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  if (type === 'Computer') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  // Speaker / other
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}
