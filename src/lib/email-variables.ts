/**
 * Email Variable System
 * Handles variable extraction and replacement for email templates
 */

export interface EmailVariable {
  key: string;
  label: string;
  description: string;
  color: string;
  category: "sender" | "receiver" | "content" | "date";
}

export interface VariableContext {
  sender_name?: string;
  receiver_email?: string;
  website_url?: string;
  company_name?: string;
  date?: string;
}

/**
 * All available email variables with their metadata
 */
export const EMAIL_VARIABLES: EmailVariable[] = [
  {
    key: "{{sender_name}}",
    label: "Sender Name",
    description:
      "Name of the sender from the sender account (fetched from email_senders table)",
    color: "#3b82f6",
    category: "sender",
  },
  {
    key: "{{receiver_name}}",
    label: "Receiver Name",
    description:
      'Name extracted from receiver email (e.g., jeetsuthar123@gmail.com → "Jeetsuthar"). Generic emails (support@, help@, info@) are replaced with meaningful pronouns.',
    color: "#10b981",
    category: "receiver",
  },
  {
    key: "{{website_url}}",
    label: "Website URL",
    description: "Website URL of the recipient (fetched from sites table)",
    color: "#f59e0b",
    category: "content",
  },
  {
    key: "{{company_name}}",
    label: "Company Name",
    description:
      'Company name extracted from website URL (e.g., https://www.google.com → "Google")',
    color: "#8b5cf6",
    category: "content",
  },
  {
    key: "{{date}}",
    label: "Current Date",
    description:
      'Current date in format: MMMM DD, YYYY (e.g., "April 09, 2026")',
    color: "#ef4444",
    category: "date",
  },
];

/**
 * Extract receiver name from email address
 * - Removes numbers and special characters
 * - Converts to title case
 * - Handles generic emails with meaningful pronouns
 */
export function extractReceiverName(email: string): string {
  if (!email) return "there";

  const localPart = email.split("@")[0].toLowerCase();

  // Generic email patterns
  const genericPatterns: Record<string, string> = {
    support: "support team",
    help: "help desk",
    info: "information team",
    contact: "contact team",
    admin: "the administrator",
    sales: "sales team",
    marketing: "marketing team",
    billing: "billing department",
    accounts: "accounts team",
    noreply: "automated system",
    "no-reply": "automated system",
    team: "the team",
    hello: "you",
    hi: "you",
    webmaster: "the webmaster",
    office: "the office",
    enquiries: "enquiries team",
    jobs: "hiring team",
    careers: "careers team",
    hr: "HR department",
    press: "press team",
    news: "news team",
    subscribe: "you",
    newsletter: "you",
    members: "member services",
    customers: "customer team",
    service: "service team",
    feedback: "feedback team",
    suggestions: "suggestions team",
    questions: "questions team",
    answers: "answers team",
    supports: "supports team",
    assistance: "assistance team",
    inquiry: "inquiry team",
    inquiries: "inquiries team",
    request: "request team",
    requests: "requests team",
    order: "order team",
    orders: "orders team",
    shipping: "shipping team",
    delivery: "delivery team",
    return: "returns team",
    returns: "returns team",
    refund: "refund team",
    refunds: "refund team",
    payment: "payment team",
    payments: "payments team",
    invoice: "invoice team",
    invoices: "invoices team",
    receipt: "receipt team",
    receipts: "receipts team",
    technical: "technical team",
    tech: "technical team",
    it: "IT department",
    security: "security team",
    abuse: "abuse team",
    spam: "spam team",
    postmaster: "the postmaster",
    hostmaster: "the hostmaster",
    usp: "the usp",
    mailer: "the mailer",
    daemon: "the daemon",
    root: "the system administrator",
    operator: "the operator",
    sysadmin: "the system administrator",
    web: "the webmaster",
  };

  // Check if it's a generic email
  for (const [pattern, replacement] of Object.entries(genericPatterns)) {
    if (localPart === pattern || localPart.includes(pattern)) {
      return replacement;
    }
  }

  // Extract name from email and clean it up
  let name = localPart
    // Remove common separators
    .replace(/[._-]/g, " ")
    // Remove numbers
    .replace(/\d+/g, "")
    // Remove special characters except spaces and apostrophes
    .replace(/[^a-z\s']/g, "")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();

  // Convert to title case
  if (name.length > 0) {
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Fallback for emails that are too generic or have no clear name
  return "there";
}

/**
 * Extract company name from URL
 * - Removes protocol, www, TLD
 * - Converts to title case
 * - Handles common patterns
 */
export function extractCompanyName(url: string): string {
  if (!url) return "the company";

  try {
    // Remove protocol and path
    let domain = url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    // Remove port number if present
    domain = domain.split(":")[0];

    // Remove TLD and any additional domain parts
    const parts = domain.split(".");
    if (parts.length >= 2) {
      // Get the main domain name (second-level domain)
      const mainDomain = parts[parts.length - 2] || parts[0];

      // Convert to title case and clean up
      let companyName = mainDomain
        .replace(/[-_]/g, " ")
        .replace(/\d+/g, "")
        .replace(/[^a-z\s]/g, "")
        .trim();

      if (companyName.length > 0) {
        return companyName
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }

    return "the company";
  } catch (error) {
    return "the company";
  }
}

/**
 * Get current date in formatted string
 */
export function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "2-digit",
  };
  return now.toLocaleDateString("en-US", options);
}

/**
 * Replace variables in template with actual values
 */
export function replaceVariables(
  content: string,
  context: VariableContext,
): string {
  if (!content) return "";

  let result = content;

  // Replace each variable
  for (const variable of EMAIL_VARIABLES) {
    const value = getVariableValue(variable.key, context);
    if (value !== null) {
      // Use global regex to replace all occurrences
      const regex = new RegExp(escapeRegex(variable.key), "g");
      result = result.replace(regex, value);
    }
  }

  return result;
}

/**
 * Get value for a specific variable
 */
function getVariableValue(
  key: string,
  context: VariableContext,
): string | null {
  switch (key) {
    case "{{sender_name}}":
      return context.sender_name || "Team";

    case "{{receiver_name}}":
      if (context.receiver_email) {
        return extractReceiverName(context.receiver_email);
      }
      return "there";

    case "{{website_url}}":
      return context.website_url || "";

    case "{{company_name}}":
      if (context.website_url) {
        return extractCompanyName(context.website_url);
      }
      return "the company";

    case "{{date}}":
      return context.date || getCurrentDate();

    default:
      return null;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract all variables used in a template
 */
export function extractVariablesFromTemplate(content: string): string[] {
  if (!content) return [];

  const variablePattern = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    const fullVariable = `{{${match[1]}}}`;
    if (!variables.includes(fullVariable)) {
      variables.push(fullVariable);
    }
  }

  return variables;
}

/**
 * Check if a template contains any variables
 */
export function hasVariables(content: string): boolean {
  if (!content) return false;
  return /\{\{[^}]+\}\}/.test(content);
}

/**
 * Get variable by key
 */
export function getVariableByKey(key: string): EmailVariable | undefined {
  return EMAIL_VARIABLES.find((v) => v.key === key);
}

/**
 * Get variables by category
 */
export function getVariablesByCategory(
  category: EmailVariable["category"],
): EmailVariable[] {
  return EMAIL_VARIABLES.filter((v) => v.category === category);
}

/**
 * Highlight variables in HTML content with colors
 */
export function highlightVariables(content: string): string {
  if (!content) return "";

  let result = content;

  for (const variable of EMAIL_VARIABLES) {
    const regex = new RegExp(escapeRegex(variable.key), "g");
    const replacement = `<span style="background-color: ${variable.color}20; color: ${variable.color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; cursor: pointer;" data-variable="${variable.key}" class="email-variable">${variable.key}</span>`;
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * Remove variable highlighting from HTML content
 */
export function removeVariableHighlighting(content: string): string {
  if (!content) return "";

  // Replace highlighted spans with just the variable text
  return content.replace(
    /<span[^>]*class="email-variable"[^>]*data-variable="([^"]+)"[^>]*>\{\{[^}]+\}\}<\/span>/g,
    "$1",
  );
}
