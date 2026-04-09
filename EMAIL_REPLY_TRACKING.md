# Email Reply Tracking

This system tracks replies to sent emails using the Gmail API. When recipients reply to your emails, the system detects these replies and stores them in the database for viewing in the admin panel.

## Setup Instructions

### 1. Gmail API Configuration

First, you need to set up the Gmail API in your Google Cloud Console:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API
4. Create OAuth 2.0 credentials (Desktop application)
5. Note down the Client ID and Client Secret

### 2. OAuth 2.0 Consent Screen

1. In Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required application information
4. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
5. Save and continue

### 3. Get Refresh Token

You need to get a refresh token to allow the application to access Gmail without user interaction:

1. Create an HTML file with the following content:
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Gmail OAuth Authorization</h1>
  <a href="https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080/auth/google/callback&scope=https://www.googleapis.com/auth/gmail.readonly%20https://www.googleapis.com/auth/gmail.modify&response_type=code&access_type=offline&prompt=consent">Authorize Gmail Access</a>
</body>
</html>
```

2. Replace `YOUR_CLIENT_ID` with your actual Client ID
3. Open the file in your browser and click the authorization link
4. Sign in with your Google account and grant permissions
5. After authorization, you'll be redirected to a URL with a `code` parameter
6. Use this code to exchange for a refresh token using a tool like Postman or curl:
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:8080/auth/google/callback"
```

7. Save the refresh token from the response

### 4. Environment Variables

Add the following to your `.env` file:

```env
# Gmail API Configuration
GMAIL_CLIENT_ID=your-google-client-id
GMAIL_CLIENT_SECRET=your-google-client-secret
GMAIL_REFRESH_TOKEN=your-google-refresh-token
GMAIL_REDIRECT_URI=http://localhost:8080/auth/google/callback
```

## How It Works

1. **Message-ID Headers**: When emails are sent, they include a unique Message-ID header
2. **Reply Detection**: The system periodically checks Gmail for replies to sent emails
3. **In-Reply-To Tracking**: Replies are identified by the In-Reply-To header matching sent email Message-IDs
4. **Database Storage**: Replies are stored in the `email_replies` table
5. **Frontend Display**: Replies are displayed in the Email Replies page with full details

## Database Schema

The `email_replies` table stores:

- `id`: Unique identifier
- `queue_id`: Reference to the original email in email_queue
- `message_id`: Message ID of the reply
- `reply_message_id`: Gmail message ID
- `from_email`: Reply sender's email
- `from_name`: Reply sender's name
- `subject`: Reply subject
- `body`: Reply body content
- `received_at`: When the reply was received
- `processed`: Whether the reply has been processed
- `thread_id`: Gmail thread ID
- `in_reply_to`: Original Message-ID this is replying to
- `is_reply`: Flag to indicate this is a reply

## Features

- **Real-time Monitoring**: Checks for new replies every 5 minutes
- **Reply Details**: Shows full reply content, sender information, and timestamps
- **Thread Support**: Links replies to original emails
- **Automatic Mark as Read**: Automatically marks processed replies as read in Gmail
- **Rate Limiting**: Uses Bottleneck to prevent API throttling

## Usage

1. Navigate to the "Email Replies" page in the admin panel
2. View all recent replies from the last 7 days
3. Click on any reply to see full details
4. Replies are automatically refreshed every 30 seconds

## Troubleshooting

### Common Issues

1. **No replies detected**:
   - Check Gmail API credentials in .env
   - Verify the Gmail account has permission to access the emails
   - Ensure emails were sent with Message-ID headers (this should be automatic)

2. **Authentication errors**:
   - Refresh token may have expired
   - Client ID/Secret may be incorrect
   - OAuth scopes may be missing

3. **API rate limits**:
   - The system includes rate limiting (4 requests/second)
   - Monitor API usage in Google Cloud Console

### Testing

To test the system:

1. Send an email through the system
2. Wait for the system to process (5 minutes max)
3. Reply to the sent email
4. Check the Email Replies page for the reply

The system should detect and display the reply within 5 minutes of receiving it.