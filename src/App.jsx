import { useState } from 'react';
import AppShell from './components/layout/AppShell';
import SongLibraryScreen from './screens/SongLibraryScreen';
import SongPlayerScreen from './screens/SongPlayerScreen';
import SongEditorScreen from './screens/SongEditorScreen';
import SongImportScreen from './screens/SongImportScreen';

function App() {
  const [screen, setScreen] = useState('library');
  const [currentSongId, setCurrentSongId] = useState(null);
  const [editSongId, setEditSongId] = useState(null);
  const [importData, setImportData] = useState(null);

  const handlePlaySong = (songId) => {
    setCurrentSongId(songId);
    setScreen('player');
  };

  const handleEditSong = (songId) => {
    setEditSongId(songId || null);
    setImportData(null);
    setScreen('editor');
  };

  const handleSaveSong = () => {
    setEditSongId(null);
    setImportData(null);
    setScreen('library');
  };

  const handleImport = (data) => {
    setImportData(data);
    setEditSongId(null);
    setScreen('editor');
  };

  return (
    <AppShell>
      {screen === 'library' && (
        <SongLibraryScreen
          onPlay={handlePlaySong}
          onEdit={handleEditSong}
          onAdd={() => handleEditSong(null)}
          onImport={() => setScreen('import')}
        />
      )}

      {screen === 'import' && (
        <SongImportScreen
          onImport={handleImport}
          onBack={() => setScreen('library')}
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
          importData={importData}
          onSave={handleSaveSong}
          onBack={() => { setImportData(null); setScreen('library'); }}
        />
      )}
    </AppShell>
  );
}

export default App;
