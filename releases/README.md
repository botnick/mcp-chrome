# Chrome MCP Server Extension - Latest Release

## Quick Install

### 1. Download

Download [chrome-mcp-server-latest.zip](/releases/chrome-extension/latest/chrome-mcp-server-lastest.zip)

### 2. Install

1. Unzip the downloaded file
2. Open Chrome
3. Go to `chrome://extensions/`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the unzipped folder

### 3. Verify

- The extension icon should appear in the toolbar
- Click it to open the config panel
- Confirm the status is normal

## Configuration

### Native Server Connection

1. Make sure the Native Server is running (default port 12306)
2. Enter the correct port in the extension popup
3. Click **Connect** to test

## Troubleshooting

1. **Extension won't load**
   - Make sure Developer mode is enabled
   - Check the folder structure is intact

2. **Can't connect to Native Server**
   - Confirm the Native Server is running
   - Check the port number
   - Check the browser console for errors

3. **Features not working**
   - Refresh the page
   - Restart Chrome
   - Reload the extension

## Support

If you run into issues:

1. Check the browser console for errors
2. Search existing GitHub Issues
3. Open a new Issue with details

## Security Note

This extension requires elevated permissions. Only install from trusted sources.
