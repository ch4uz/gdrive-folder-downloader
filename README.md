# Google Drive Folder Downloader

A powerful React and Node.js application that allows users to authenticate with Google Drive and recursively download entire folders, including content from shared drives and team drives. The application automatically handles Google Workspace documents by exporting them to standard formats.

![Google Drive Folder Downloader](https://img.shields.io/badge/Google%20Drive-Folder%20Downloader-blue?style=for-the-badge&logo=googledrive)

## ✨ Features

### 🔐 Complete Google Drive Access
- **Personal Drive Folders**: Access all your personal Google Drive folders
- **Shared Folders**: Download folders shared directly with you
- **Shared Drives/Team Drives**: Full access to organizational shared drives
- **Shortcut Folders**: Includes folders that appear with "Belongs to a shared drive" tooltip

### 📂 Smart Folder Management
- **Recursive Download**: Downloads entire folder structures including all subfolders
- **Google Drive Picker**: Native Google interface for folder selection with full hierarchy navigation
- **Universal Access**: Seamless access to all folder types:
  - 📁 **Personal Drive** - Your personal Google Drive folders
  - 👥 **Shared Folders** - Folders shared directly with you
  - 🏢 **Shared Drives** - Team/organizational shared drives
  - 🔗 **Shortcut Folders** - Shortcuts to shared drive content

### 📄 Google Workspace Export
Automatically exports Google Workspace documents to standard formats:
- **Google Docs** → PDF (.pdf)
- **Google Sheets** → Excel (.xlsx)
- **Google Slides** → PowerPoint (.pptx)
- **Google Forms** → PDF (.pdf)
- **Google Drawings** → PNG (.png)

### 💾 In-Memory Storage
- Downloads all files to browser memory
- Individual file download with proper filenames
- Maintains original folder structure paths
- Shows file metadata and export information

## 🛠️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Node.js with Express and TypeScript
- **API**: Google Drive API v3 with OAuth 2.0
- **Authentication**: Google OAuth 2.0 with proper token management

## 📋 Prerequisites

- Node.js 16+ and npm
- Google Cloud Console account
- Basic knowledge of React and Node.js

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/gdrive-folder-downloader.git
cd gdrive-folder-downloader
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## ⚙️ Google Cloud Console Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 2. Enable Required APIs

1. Navigate to **APIs & Services** → **Library**
2. Search for and enable the following APIs:
   - **Google Drive API** - Click on it and press **Enable**
   - **Google Picker API** - Click on it and press **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill in required fields:
   - **App name**: "Google Drive Folder Downloader"
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue** through all steps
5. Add your email as a test user in the **Test users** section

### 4. Create Required Credentials

#### OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Configure:
   - **Name**: "Drive Downloader Client"
   - **Authorized redirect URIs**: `http://localhost:3001/auth/google/callback`
5. Click **Create**
6. **Important**: Copy both the **Client ID** and **Client Secret**

#### API Key (for Google Picker)
1. In the same **Credentials** page, click **Create Credentials** → **API Key**
2. Copy the generated **API Key**
3. (Optional) Click **Restrict Key** to limit usage to your domain and the required APIs for better security

## 🔧 Environment Configuration

### Backend Environment Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Copy the example environment file:
```bash
cp .env.example .env
```

3. Edit the `.env` file with your Google credentials:
```env
GOOGLE_CLIENT_ID=your_client_id_from_google_console
GOOGLE_CLIENT_SECRET=your_client_secret_from_google_console
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
GOOGLE_API_KEY=your_api_key_from_google_console
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Required credentials:**
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: From OAuth 2.0 Client IDs
- `GOOGLE_API_KEY`: From API Key creation (needed for Google Drive Picker)

**⚠️ Security Note**: Never commit the `.env` file to version control. It's already included in `.gitignore`.

## 🏃‍♂️ Running the Application

### 1. Start the Backend Server

```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:3001`

### 2. Start the Frontend (New Terminal)

```bash
cd frontend
npm start
```

The frontend will start on `http://localhost:3000`

### 3. Access the Application

Open your browser and navigate to `http://localhost:3000`

## 📖 Usage Guide

### 1. Authentication
1. Click **"Connect to Google Drive"**
2. Sign in with your Google account
3. Grant the requested permissions
4. You'll be redirected back to the application

### 2. Folder Selection
1. Click **"Choose Folder from Google Drive"** button
2. The Google Drive Picker will open showing all your accessible folders:
   - Personal Drive folders
   - Shared folders (folders shared with you)
   - Shared Drive/Team Drive folders
   - Folders with shortcuts from shared drives
3. Navigate through the folder structure using Google's native interface
4. Select your desired folder and click "Select"
5. The selected folder name will be displayed below the button

### 3. Download Process
1. Click **"Download Folder Contents"**
2. The application will recursively scan the entire folder structure
3. All files are downloaded to memory and displayed
4. Google Workspace documents are automatically exported to standard formats

### 4. File Management
1. View all downloaded files with their full paths
2. See export information for converted Google Workspace documents
3. Download individual files using the **Download** button
4. Files maintain their original folder structure in the filename

## 🔌 API Endpoints

### Authentication
- `GET /auth/google` - Initiate OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `POST /set-tokens` - Set authentication tokens

### Folder Operations
- `GET /folders` - Get all accessible folders (personal, shared, team drives)
- `POST /download-folder` - Recursively download folder contents

### File Operations
- `GET /download/:fileId` - Download individual file
- `GET /folder/:folderId/contents` - Get folder contents

## 📁 Project Structure

```
gdrive-folder-downloader/
├── backend/                   # Node.js Express server
│   ├── src/
│   │   └── index.ts          # Main server file with all endpoints
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/                  # React TypeScript application
│   ├── src/
│   │   ├── App.tsx           # Main React component
│   │   ├── App.css           # Styling
│   │   └── index.tsx         # React entry point
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

## 🔒 Security Considerations

### OAuth Scopes
The application requests minimal required permissions:
- `https://www.googleapis.com/auth/drive.readonly` - Read-only access to Google Drive

### Data Privacy
- **No server storage**: Files are only stored in browser memory
- **Temporary tokens**: OAuth tokens are only used during the session
- **No data persistence**: Application doesn't store any user data permanently

### Production Deployment
For production use:
1. Update redirect URIs in Google Cloud Console
2. Use proper environment variables
3. Implement proper session management
4. Add rate limiting and error handling
5. Use HTTPS for all communication

## 🐛 Troubleshooting

### Common Issues

**Authentication Failed**
- Verify your Google Cloud Console setup
- Check that you're added as a test user
- Ensure redirect URI matches exactly

**Google Drive Picker Issues**
- **"Loading Picker..." stuck**: Check that Google Picker API is enabled and API key is valid
- **Picker won't open**: Verify that both Google Drive API and Google Picker API are enabled
- **"No folders visible"**: Ensure you have proper permissions and the OAuth consent is configured correctly

**Download Failures**
- Large files may take time to process
- Some Google Workspace documents may have export limitations
- Check browser console for detailed error messages

**Build Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode
Enable detailed logging by checking the browser console and backend terminal output during operations.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Drive API for comprehensive file access
- React and Node.js communities for excellent documentation
- Contributors and testers who helped improve this tool

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/your-username/gdrive-folder-downloader/issues)
3. Create a new issue with detailed information about your problem

---

Made with ❤️ for easier Google Drive management