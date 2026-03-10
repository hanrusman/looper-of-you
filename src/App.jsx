import { useState } from 'react';
import AppShell from './components/layout/AppShell';
import SongLibraryScreen from './screens/SongLibraryScreen';
import SongPlayerScreen from './screens/SongPlayerScreen';
import SongEditorScreen from './screens/SongEditorScreen';

function App() {
  const [screen, setScreen] = useState('library');
  const [currentSongId, setCurrentSongId] = useState(null);
  const [editSongId, setEditSongId] = useState(null);

  const handlePlaySong = (songId) => {
    setCurrentSongId(songId);
    setScreen('player');
  };

  const handleEditSong = (songId) => {
    setEditSongId(songId || null);
    setScreen('editor');
  };

  const handleSaveSong = () => {
    setEditSongId(null);
    setScreen('library');
  };

  return (
    <AppShell>
      {screen === 'library' && (
        <SongLibraryScreen
          onPlay={handlePlaySong}
          onEdit={handleEditSong}
          onAdd={() => handleEditSong(null)}
        />
      )}

      {screen === 'player' && (
        <SongPlayerScreen
          songId={currentSongId}
          onBack={() => setScreen('library')}
        />
      )}

      {screen === 'editor' && (
        <SongEditorScreen
          songId={editSongId}
          onSave={handleSaveSong}
          onBack={() => setScreen('library')}
        />
      )}
    </AppShell>
  );
}

export default App;
