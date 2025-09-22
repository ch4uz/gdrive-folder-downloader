import React, { useState, useEffect } from 'react';
import './App.css';

// Declare global variables for Google APIs
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

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
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const [downloadedFiles, setDownloadedFiles] = useState<FileData[]>([]);
  const [downloadedFolderName, setDownloadedFolderName] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [pickerLoaded, setPickerLoaded] = useState(false);

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

    // Load Google API configuration
    loadGoogleConfig();
  }, []);

  const loadGoogleConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config`);
      const config = await response.json();
      setGoogleApiKey(config.googleApiKey);
      setGoogleClientId(config.googleClientId);
    } catch (error) {
      console.error('Error loading Google config:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated && googleApiKey && googleClientId) {
      loadPickerAPI();
    }
  }, [isAuthenticated, googleApiKey, googleClientId]);

  const loadPickerAPI = () => {
    if (window.gapi) {
      window.gapi.load('picker', () => {
        setPickerLoaded(true);
      });
    }
  };

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
        // Store access token for picker
        if (tokens.access_token) {
          localStorage.setItem('google_access_token', tokens.access_token);
        }
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
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

  const openPicker = () => {
    if (!window.gapi || !pickerLoaded) {
      setError('Google Picker API not loaded');
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true))
      .addView(new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setQuery('type:folder'))
      .setOAuthToken(getAccessToken())
      .setDeveloperKey(googleApiKey)
      .setCallback(pickerCallback)
      .build();
    
    picker.setVisible(true);
  };

  const getAccessToken = () => {
    // Get the access token from the OAuth client
    // This is a simplified version - in production you'd want better token management
    return localStorage.getItem('google_access_token') || '';
  };

  const pickerCallback = (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const doc = data.docs[0];
      if (doc) {
        setSelectedFolder(doc.id);
        setSelectedFolderName(doc.name);
        setError('');
      }
    } else if (data.action === window.google.picker.Action.CANCEL) {
      // User cancelled the picker
    }
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
          <h2>Select a folder to download:</h2>
          <div className="picker-container">
            <button 
              onClick={openPicker}
              disabled={!pickerLoaded || loading}
              className="picker-button"
            >
              {pickerLoaded ? 'Choose Folder from Google Drive' : 'Loading Picker...'}
            </button>
            {selectedFolderName && (
              <div className="selected-folder">
                <p><strong>Selected folder:</strong> {selectedFolderName}</p>
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
