import { getGmailSettings, getGmailClient } from "./gmail-client";

export interface GmailValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  settings: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
    hasRedirectUri: boolean;
    source: 'database' | 'environment' | 'mixed';
  };
}

/**
 * Validates Gmail integration settings and provides detailed feedback
 */
export async function validateGmailSettings(): Promise<GmailValidationResult> {
  const result: GmailValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    settings: {
      hasClientId: false,
      hasClientSecret: false,
      hasRefreshToken: false,
      hasRedirectUri: false,
      source: 'environment'
    }
  };

  try {
    const settings = await getGmailSettings();

    // Check which source provided the settings
    const hasDbSettings = !!process.env.GMAIL_CLIENT_ID || !!process.env.GMAIL_CLIENT_SECRET;
    result.settings.source = hasDbSettings ? 'environment' : 'database';

    // Validate Client ID
    result.settings.hasClientId = !!settings.clientId;
    if (!settings.clientId) {
      result.errors.push('GMAIL_CLIENT_ID is missing. Add it in Settings or as environment variable.');
      result.isValid = false;
    } else if (!settings.clientId.match(/^[\w-]+\.apps\.googleusercontent\.com$/)) {
      result.warnings.push('GMAIL_CLIENT_ID format looks incorrect. Should end with .apps.googleusercontent.com');
    }

    // Validate Client Secret
    result.settings.hasClientSecret = !!settings.clientSecret;
    if (!settings.clientSecret) {
      result.errors.push('GMAIL_CLIENT_SECRET is missing. Add it in Settings or as environment variable.');
      result.isValid = false;
    } else if (settings.clientSecret.length < 10) {
      result.warnings.push('GMAIL_CLIENT_SECRET seems too short. Double-check the value.');
    }

    // Validate Refresh Token
    result.settings.hasRefreshToken = !!settings.refreshToken;
    if (!settings.refreshToken) {
      result.errors.push('GMAIL_REFRESH_TOKEN is missing. Complete the OAuth flow to generate it.');
      result.isValid = false;
    } else if (settings.refreshToken.length < 20) {
      result.warnings.push('GMAIL_REFRESH_TOKEN seems too short. It may be invalid.');
    }

    // Validate Redirect URI
    result.settings.hasRedirectUri = !!settings.redirectUri;
    if (!settings.redirectUri) {
      result.warnings.push('GMAIL_REDIRECT_URI is missing. Using default: http://localhost:3000/auth/google/callback');
    }

    // Test the connection if we have all required credentials
    if (result.isValid) {
      try {
        const gmail = await getGmailClient();
        await gmail.users.getProfile({ userId: 'me' });
        // Success! Connection works
      } catch (error: any) {
        result.isValid = false;
        if (error.message.includes('invalid_grant')) {
          result.errors.push('Refresh token is invalid or expired. Re-authorize the Gmail integration.');
        } else if (error.message.includes('unauthorized_client')) {
          result.errors.push('Client ID or Secret is incorrect. Check your Google Cloud Console settings.');
        } else {
          result.errors.push(`Gmail API connection failed: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    result.isValid = false;
    result.errors.push(`Failed to validate settings: ${error.message}`);
  }

  return result;
}

/**
 * Tests Gmail API access and returns detailed profile information
 */
export async function testGmailConnection() {
  try {
    const gmail = await getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });

    return {
      success: true,
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      historyId: profile.data.historyId
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
