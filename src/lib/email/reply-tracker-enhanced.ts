import { getGmailClient } from "./gmail-client";

/**
 * Advanced reply finder that searches Gmail inbox directly
 * This bypasses the database and searches the user's actual inbox
 * Useful for finding replies to specific sent emails
 */
export async function findRepliesInInbox(options: {
  startDate?: Date;
  endDate?: Date;
  fromEmail?: string;
  toEmail?: string;
  subjectContains?: string;
  hasAttachment?: boolean;
}) {
  const gmail = await getGmailClient();

  // Build Gmail search query
  let searchQuery = "in:inbox";

  if (options.fromEmail) {
    searchQuery += ` from:(${options.fromEmail})`;
  }

  if (options.toEmail) {
    searchQuery += ` to:(${options.toEmail})`;
  }

  if (options.startDate) {
    searchQuery += ` after:${Math.floor(options.startDate.getTime() / 1000)}`;
  }

  if (options.endDate) {
    searchQuery += ` before:${Math.floor(options.endDate.getTime() / 1000)}`;
  }

  if (options.subjectContains) {
    searchQuery += ` subject:(${options.subjectContains})`;
  }

  if (options.hasAttachment) {
    searchQuery += ` has:attachment`;
  }

  console.log(`🔍 Searching Gmail with query: ${searchQuery}`);

  const response = await gmail.users.messages.list({
    userId: "me",
    q: searchQuery,
    maxResults: 100,
  });

  const messages = response.data.messages || [];

  // Fetch full details for each message
  const detailedMessages = [];

  for (const msg of messages) {
    try {
      const fullMessage = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = fullMessage.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value;

      detailedMessages.push({
        id: fullMessage.data.id,
        threadId: fullMessage.data.threadId,
        snippet: fullMessage.data.snippet,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        inReplyTo: getHeader("In-Reply-To"),
        messageId: getHeader("Message-ID"),
        references: getHeader("References"),
        labelIds: fullMessage.data.labelIds,
      });
    } catch (error) {
      console.error(`Error fetching message ${msg.id}:`, error);
    }
  }

  return {
    success: true,
    query: searchQuery,
    count: detailedMessages.length,
    messages: detailedMessages,
  };
}
