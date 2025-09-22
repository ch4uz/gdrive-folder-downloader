import React, { useState, useEffect } from 'react';
import './App.css';

interface Folder {
  id: string;
  name: string;
  parents?: string[];
  isShared?: boolean;
  folderType?: 'owned' | 'shared' | 'shared-drive' | 'shared-drive-shortcut';
  driveType?: 'personal' | 'shared';
  sharedDriveName?: string;
  sharedDriveId?: string;
  isShortcut?: boolean;
  originalId?: string;
}

interface FileData {
  name: string;
  path: string;
  mimeType: string;
  size: string;
  data: string;
  originalName?: string;
  originalMimeType?: string;
  wasExported?: boolean;
}

interface DownloadedFolder {
  folderName: string;
  totalFiles: number;
  files: FileData[];
}

const API_BASE_URL = 'http://localhost:3001';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredFolders, setFilteredFolders] = useState<Folder[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [downloadedFiles, setDownloadedFiles] = useState<FileData[]>([]);
  const [downloadedFolderName, setDownloadedFolderName] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const tokens = urlParams.get('tokens');
    
    if (authStatus === 'success' && tokens) {
      try {
        const decodedTokens = JSON.parse(decodeURIComponent(tokens));
        setTokensOnServer(decodedTokens);
      } catch (error) {
        console.error('Error parsing tokens:', error);
        setError('Authentication failed - invalid tokens');
      }
    } else if (authStatus === 'error') {
      setError('Authentication failed');
    }
  }, []);

  const setTokensOnServer = async (tokens: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/set-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens }),
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchFolders();
      } else {
        setError('Failed to set authentication tokens');
      }
    } catch (error) {
      console.error('Error setting tokens:', error);
      setError('Failed to set authentication tokens');
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`);
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      setError('Failed to initiate authentication');
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/folders`);
      const data = await response.json();
      console.log('Folders data:', data);
      
      if (Array.isArray(data)) {
        setFolders(data);
        setFilteredFolders(data);
      } else {
        console.error('Expected array but got:', typeof data, data);
        setFolders([]);
        setFilteredFolders([]);
        setError('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
      setError('Failed to fetch folders');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedFolder('');
    setSelectedFolderName('');
    
    if (query.trim() === '') {
      setFilteredFolders(folders);
      setShowDropdown(false);
    } else {
      const filtered = folders.filter(folder =>
        folder.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredFolders(filtered);
      setShowDropdown(true);
    }
  };

  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolder(folder.id);
    setSelectedFolderName(folder.name);
    setSearchQuery(folder.name);
    setShowDropdown(false);
  };

  const handleInputFocus = () => {
    if (folders.length > 0) {
      setFilteredFolders(folders);
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow clicking on items
    setTimeout(() => {
      setShowDropdown(false);
    }, 150);
  };

  const downloadFolderContents = async () => {
    if (!selectedFolder) {
      setError('Please select a folder');
      return;
    }

    setLoading(true);
    setError('');
    setDownloadedFiles([]);
    setDownloadedFolderName('');
    setTotalFiles(0);

    try {
      const response = await fetch(`${API_BASE_URL}/download-folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId: selectedFolder }),
      });

      const data: DownloadedFolder = await response.json();
      setDownloadedFiles(data.files);
      setDownloadedFolderName(data.folderName);
      setTotalFiles(data.totalFiles);
    } catch (error) {
      console.error('Error downloading folder contents:', error);
      setError('Failed to download folder contents');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (file: FileData) => {
    const byteCharacters = atob(file.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: file.mimeType });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes);
    if (isNaN(size)) return 'Unknown size';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Google Drive Folder Downloader</h1>
          <p>Click the button below to authenticate with Google Drive</p>
          <button onClick={handleGoogleAuth} className="auth-button">
            Connect to Google Drive
          </button>
          {error && <p className="error">{error}</p>}
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Google Drive Folder Downloader</h1>
        
        <div className="folder-selection">
          <h2>Search and select a folder to download:</h2>
          <div className="autocomplete-container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="Type to search folders..."
              className="folder-input"
            />
            {showDropdown && filteredFolders.length > 0 && (
              <div className="autocomplete-dropdown">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`autocomplete-item ${
                      folder.folderType === 'shared-drive' ? 'shared-drive-folder' :
                      folder.folderType === 'shared-drive-shortcut' ? 'shared-drive-shortcut-folder' : 
                      folder.isShared ? 'shared-folder' : 'owned-folder'
                    }`}
                    onClick={() => handleFolderSelect(folder)}
                  >
                    <div className="folder-info">
                      <strong>{folder.name}</strong>
                      <div className="folder-badges">
                        {folder.folderType === 'shared' && <span className="shared-indicator">👥 Shared</span>}
                        {folder.folderType === 'shared-drive' && (
                          <span className="shared-drive-indicator">
                            🏢 {folder.sharedDriveName || 'Shared Drive'}
                          </span>
                        )}
                        {folder.folderType === 'shared-drive-shortcut' && (
                          <span className="shared-drive-shortcut-indicator">
                            🔗 Shared Drive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showDropdown && searchQuery && filteredFolders.length === 0 && (
              <div className="autocomplete-dropdown">
                <div className="autocomplete-item no-results">
                  No folders found
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={downloadFolderContents} 
            disabled={!selectedFolder || loading}
            className="download-button"
          >
            {loading ? 'Downloading...' : 'Download Folder Contents'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {downloadedFiles.length > 0 && (
          <div className="downloaded-files">
            <h2>Downloaded Folder: "{downloadedFolderName}"</h2>
            <p className="folder-stats">Total files downloaded recursively: {totalFiles} files in memory</p>
            <div className="file-list">
              {downloadedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <strong>{file.name}</strong>
                    {file.wasExported && file.originalName && (
                      <p className="exported-info">
                        📄 Exported from: {file.originalName}
                      </p>
                    )}
                    <p className="file-path">Path: {file.path}</p>
                    <p>Type: {file.mimeType}</p>
                    {file.wasExported && file.originalMimeType && (
                      <p className="original-type">Original: {file.originalMimeType}</p>
                    )}
                    <p>Size: {formatFileSize(file.size)}</p>
                  </div>
                  <button 
                    onClick={() => downloadFile(file)}
                    className="download-file-button"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
