import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.json({ authUrl });
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens in a simple way (in production, use proper session management)
    const tokenString = encodeURIComponent(JSON.stringify(tokens));
    res.redirect(`${process.env.FRONTEND_URL}?auth=success&tokens=${tokenString}`);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=error`);
  }
});

app.post('/set-tokens', (req, res) => {
  const { tokens } = req.body;
  oauth2Client.setCredentials(tokens);
  res.json({ success: true });
});

app.get('/folders', async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // First, get all shared drives (Team Drives)
    const sharedDrives = await drive.drives.list({
      fields: 'drives(id, name)'
    });

    // Debug: List all shortcuts to see what we're working with
    try {
      const allShortcuts = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.shortcut'",
        fields: 'files(id, name, shortcutDetails)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
      console.log(`Found ${allShortcuts.data.files?.length || 0} shortcuts total:`, 
        allShortcuts.data.files?.map(s => ({
          name: s.name,
          targetMimeType: s.shortcutDetails?.targetMimeType
        }))
      );
    } catch (e) {
      console.log('Error fetching shortcuts for debugging:', e);
    }
    
    // Fetch folders from multiple sources
    const queries = [
      // Owned folders in My Drive
      drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and 'me' in owners",
        fields: 'files(id, name, parents, owners)',
      }),
      // Shared folders (folders shared with me) in My Drive
      drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and sharedWithMe=true",
        fields: 'files(id, name, parents, owners, sharingUser)',
      }),
      // All folders with broader scope to catch shortcuts and shared drive folders
      drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut'",
        fields: 'files(id, name, parents, shortcutDetails, driveId, capabilities)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      })
    ];
    
    // Add queries for each shared drive
    if (sharedDrives.data.drives) {
      for (const sharedDrive of sharedDrives.data.drives) {
        if (sharedDrive.id) {
          queries.push(
            drive.files.list({
              q: "mimeType='application/vnd.google-apps.folder'",
              driveId: sharedDrive.id,
              includeItemsFromAllDrives: true,
              supportsAllDrives: true,
              corpora: 'drive',
              fields: 'files(id, name, parents, driveId)',
            })
          );
        }
      }
    }
    
    const responses = await Promise.all(queries);
    
    // Combine and mark folders from different sources
    const allFolders = [];
    
    // Owned folders
    if (responses[0].data.files) {
      allFolders.push(...responses[0].data.files.map(folder => ({
        ...folder,
        isShared: false,
        folderType: 'owned',
        driveType: 'personal'
      })));
    }
    
    // Shared folders
    if (responses[1].data.files) {
      allFolders.push(...responses[1].data.files.map(folder => ({
        ...folder,
        isShared: true,
        folderType: 'shared',
        driveType: 'personal'
      })));
    }
    
    // Process all folders from the broader query (shortcuts and shared drive folders)
    if (responses[2].data.files) {
      console.log(`Processing ${responses[2].data.files.length} items from broader query`);
      
      for (const item of responses[2].data.files) {
        console.log(`Item: ${item.name}, mimeType: ${item.mimeType}, driveId: ${item.driveId}, hasShortcut: ${!!item.shortcutDetails}`);
        
        if (item.mimeType === 'application/vnd.google-apps.shortcut' && 
            item.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder') {
          // This is a folder shortcut
          allFolders.push({
            id: item.shortcutDetails.targetId || item.id,
            name: item.name,
            parents: item.parents,
            isShared: true,
            folderType: 'shared-drive-shortcut',
            driveType: 'shared',
            isShortcut: true,
            originalId: item.id
          });
        } else if ((item.mimeType === 'application/vnd.google-apps.folder' || !item.mimeType) && item.driveId) {
          // This is a folder in a shared drive that wasn't caught by our specific shared drive queries
          // Some shared drive folders have undefined mimeType but have a driveId
          const existingFolder = allFolders.find(f => f.id === item.id);
          if (!existingFolder) {
            console.log(`Adding shared drive folder: ${item.name} (driveId: ${item.driveId})`);
            allFolders.push({
              ...item,
              mimeType: 'application/vnd.google-apps.folder', // Set the correct mimeType
              isShared: true,
              folderType: 'shared-drive',
              driveType: 'shared'
            });
          }
        }
      }
    }
    
    // Shared drive folders
    if (sharedDrives.data.drives) {
      let responseIndex = 3; // Skip first 3 responses (owned, shared folders, and shortcuts)
      
      for (const sharedDrive of sharedDrives.data.drives) {
        if (sharedDrive.id) {
          const response = responses[responseIndex];
          
          if (response && response.data.files) {
            allFolders.push(...response.data.files.map(folder => ({
              ...folder,
              isShared: true,
              folderType: 'shared-drive',
              driveType: 'shared',
              sharedDriveName: sharedDrive.name,
              sharedDriveId: sharedDrive.id
            })));
          }
          
          responseIndex++;
        }
      }
    }
    
    // Sort folders by name for better UX
    allFolders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    console.log(`Found ${allFolders.length} folders total:`, {
      owned: allFolders.filter(f => f.folderType === 'owned').length,
      shared: allFolders.filter(f => f.folderType === 'shared').length,
      sharedDrive: allFolders.filter(f => f.folderType === 'shared-drive').length,
      sharedDriveShortcuts: allFolders.filter(f => f.folderType === 'shared-drive-shortcut').length
    });
    
    res.json(allFolders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.get('/folder/:folderId/contents', async (req, res) => {
  const { folderId } = req.params;
  
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, size)',
    });
    
    res.json(response.data.files);
  } catch (error) {
    console.error('Error fetching folder contents:', error);
    res.status(500).json({ error: 'Failed to fetch folder contents' });
  }
});

app.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const fileMetadata = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });
    
    const response = await drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });
    
    const chunks: Buffer[] = [];
    
    response.data.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    response.data.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.json({
        name: fileMetadata.data.name,
        mimeType: fileMetadata.data.mimeType,
        size: fileMetadata.data.size,
        data: buffer.toString('base64')
      });
    });
    
    response.data.on('error', (error) => {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: 'Failed to download file' });
    });
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

const downloadFileRecursively = async (drive: any, fileId: string, filePath: string, supportsSharedDrives: boolean = false): Promise<any> => {
  try {
    console.log(`Attempting to download file: ${filePath} (fileId: ${fileId}, supportsSharedDrives: ${supportsSharedDrives})`);
    const fileMetadataParams: any = {
      fileId,
      fields: 'name, mimeType, size, driveId'
    };
    
    if (supportsSharedDrives) {
      fileMetadataParams.supportsAllDrives = true;
    }

    const fileMetadata = await drive.files.get(fileMetadataParams);
    const mimeType = fileMetadata.data.mimeType;
    
    console.log(`File mimeType: ${mimeType}`);

    let response;
    let exportedFileName = fileMetadata.data.name;
    let exportedMimeType = mimeType;

    // Check if this is a Google Workspace document that needs to be exported
    if (mimeType === 'application/vnd.google-apps.document') {
      // Google Docs -> Export as PDF
      console.log('Exporting Google Doc as PDF');
      const exportParams: any = {
        fileId,
        mimeType: 'application/pdf'
      };
      if (supportsSharedDrives) {
        exportParams.supportsAllDrives = true;
      }
      response = await drive.files.export(exportParams, { responseType: 'stream' });
      exportedFileName += '.pdf';
      exportedMimeType = 'application/pdf';
      
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Google Sheets -> Export as Excel
      console.log('Exporting Google Sheet as Excel');
      const exportParams: any = {
        fileId,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
      if (supportsSharedDrives) {
        exportParams.supportsAllDrives = true;
      }
      response = await drive.files.export(exportParams, { responseType: 'stream' });
      exportedFileName += '.xlsx';
      exportedMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      // Google Slides -> Export as PowerPoint
      console.log('Exporting Google Slides as PowerPoint');
      const exportParams: any = {
        fileId,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };
      if (supportsSharedDrives) {
        exportParams.supportsAllDrives = true;
      }
      response = await drive.files.export(exportParams, { responseType: 'stream' });
      exportedFileName += '.pptx';
      exportedMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      
    } else if (mimeType === 'application/vnd.google-apps.form') {
      // Google Forms -> Export as PDF
      console.log('Exporting Google Form as PDF');
      const exportParams: any = {
        fileId,
        mimeType: 'application/pdf'
      };
      if (supportsSharedDrives) {
        exportParams.supportsAllDrives = true;
      }
      response = await drive.files.export(exportParams, { responseType: 'stream' });
      exportedFileName += '.pdf';
      exportedMimeType = 'application/pdf';
      
    } else if (mimeType === 'application/vnd.google-apps.drawing') {
      // Google Drawings -> Export as PNG
      console.log('Exporting Google Drawing as PNG');
      const exportParams: any = {
        fileId,
        mimeType: 'image/png'
      };
      if (supportsSharedDrives) {
        exportParams.supportsAllDrives = true;
      }
      response = await drive.files.export(exportParams, { responseType: 'stream' });
      exportedFileName += '.png';
      exportedMimeType = 'image/png';
      
    } else {
      // Regular file download
      const downloadParams: any = {
        fileId,
        alt: 'media'
      };
      
      if (supportsSharedDrives) {
        downloadParams.supportsAllDrives = true;
      }

      response = await drive.files.get(downloadParams, { responseType: 'stream' });
    }

    const chunks: Buffer[] = [];

    await new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      response.data.on('end', () => {
        resolve(void 0);
      });

      response.data.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    return {
      name: exportedFileName,
      path: filePath,
      mimeType: exportedMimeType,
      size: buffer.length.toString(), // Use actual downloaded size for exported files
      data: buffer.toString('base64'),
      originalName: fileMetadata.data.name,
      originalMimeType: fileMetadata.data.mimeType,
      wasExported: exportedFileName !== fileMetadata.data.name
    };
  } catch (error) {
    console.error(`Error downloading file at ${filePath}:`, error);
    return null;
  }
};

const downloadFolderRecursively = async (drive: any, folderId: string, currentPath: string = '', supportsSharedDrives: boolean = false): Promise<any[]> => {
  const downloadedFiles: any[] = [];

  try {
    const listParams: any = {
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, size)',
    };

    if (supportsSharedDrives) {
      listParams.includeItemsFromAllDrives = true;
      listParams.supportsAllDrives = true;
    }

    const listResponse = await drive.files.list(listParams);

    const items = listResponse.data.files || [];

    for (const item of items) {
      const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;

      if (item.mimeType === 'application/vnd.google-apps.folder' || (!item.mimeType && supportsSharedDrives)) {
        console.log(`Processing folder: ${itemPath}`);
        const subfolderFiles = await downloadFolderRecursively(drive, item.id!, itemPath, supportsSharedDrives);
        downloadedFiles.push(...subfolderFiles);
      } else {
        console.log(`Downloading file: ${itemPath}`);
        const downloadedFile = await downloadFileRecursively(drive, item.id!, itemPath, supportsSharedDrives);
        if (downloadedFile) {
          downloadedFiles.push(downloadedFile);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing folder at ${currentPath}:`, error);
  }

  return downloadedFiles;
};

app.post('/download-folder', async (req, res) => {
  const { folderId } = req.body;
  
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Get folder metadata with shared drive support
    const folderMetadata = await drive.files.get({
      fileId: folderId,
      fields: 'name, driveId',
      supportsAllDrives: true
    });
    
    const isSharedDrive = !!folderMetadata.data.driveId;
    
    console.log(`Starting recursive download of folder: ${folderMetadata.data.name} (${isSharedDrive ? 'Shared Drive' : 'Personal Drive'})`);
    
    const downloadedFiles = await downloadFolderRecursively(drive, folderId, '', isSharedDrive);
    
    console.log(`Download complete. Total files: ${downloadedFiles.length}`);
    
    res.json({ 
      folderName: folderMetadata.data.name,
      totalFiles: downloadedFiles.length,
      files: downloadedFiles,
      isSharedDrive: isSharedDrive
    });
    
  } catch (error) {
    console.error('Error downloading folder contents:', error);
    res.status(500).json({ error: 'Failed to download folder contents' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});