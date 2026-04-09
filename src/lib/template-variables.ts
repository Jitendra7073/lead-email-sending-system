/**
 * Template Variables System
 * Defines available variables for email templates with their metadata
 */

export interface TemplateVariable {
  key: string
  label: string
  description: string
  example: string
  icon: string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    key: 'sender_name',
    label: 'Sender Name',
    description: 'The name of the email sender (from the sender account)',
    example: 'John Smith',
    icon: '👤'
  },
  {
    key: 'receiver_name',
    label: 'Receiver Name',
    description: 'The name of the email recipient (extracted from their email address)',
    example: 'Sarah Johnson',
    icon: '📧'
  },
  {
    key: 'website_url',
    label: 'Website URL',
    description: 'The URL of the recipient\'s website',
    example: 'https://example.com',
    icon: '🌐'
  },
  {
    key: 'company_name',
    label: 'Company Name',
    description: 'Company name extracted from the website URL (e.g., "example.com" → "Example")',
    example: 'Acme Corp',
    icon: '🏢'
  },
  {
    key: 'date',
    label: 'Today\'s Date',
    description: 'Current date in format: MMMM D, YYYY (e.g., "January 15, 2025")',
    example: 'January 15, 2025',
    icon: '📅'
  }
]

/**
 * Extract company name from URL
 * Handles patterns like: https://www.example.com/path -> Example
 */
export function extractCompanyName(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname

    // Remove www., .com, .co.uk, etc.
    let name = hostname
      .replace(/^www\./i, '')
      .replace(/\.(com|org|net|io|co|app|tech|dev)$/i, '')
      .replace(/\.(co\.uk|co\.in|co\.us)$/i, '')

    // Split by dots and hyphens, capitalize each part
    const parts = name.split(/[.-]/)
    const capitalized = parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')

    return capitalized || 'Company'
  } catch {
    return 'Company'
  }
}

/**
 * Extract receiver name from email address
 * Handles: john.doe@example.com -> John Doe
 */
export function extractReceiverName(email: string): string {
  const localPart = email.split('@')[0]
  const parts = localPart
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .filter(part => part.length > 1)

  return parts.join(' ') || email.split('@')[0]
}

/**
 * Format current date
 */
export function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Replace variables in template with actual values
 */
export interface VariableValues {
  sender_name?: string
  receiver_name?: string
  receiver_email?: string
  website_url?: string
}

export function replaceTemplateVariables(
  template: string,
  values: VariableValues
): string {
  let result = template

  // Replace sender_name
  if (values.sender_name) {
    result = result.replace(/\{\{sender_name\}\}/gi, values.sender_name)
  }

  // Replace receiver_name
  const receiverName = values.receiver_name || extractReceiverName(values.receiver_email || '')
  result = result.replace(/\{\{receiver_name\}\}/gi, receiverName)

  // Replace website_url
  if (values.website_url) {
    result = result.replace(/\{\{website_url\}\}/gi, values.website_url)
  }

  // Replace company_name
  if (values.website_url) {
    const companyName = extractCompanyName(values.website_url)
    result = result.replace(/\{\{company_name\}\}/gi, companyName)
  }

  // Replace date
  result = result.replace(/\{\{date\}\}/gi, formatDate())

  return result
}

/**
 * Variable regex pattern for matching {{variable}} format
 */
export const VARIABLE_REGEX = /\{\{(\w+)\}\}/g

/**
 * Check if a string contains any template variables
 */
export function hasVariables(text: string): boolean {
  return VARIABLE_REGEX.test(text)
}

/**
 * Extract all variable keys from a template
 */
export function extractVariableKeys(template: string): string[] {
  const matches = template.matchAll(VARIABLE_REGEX)
  return Array.from(matches).map(m => m[1])
}
