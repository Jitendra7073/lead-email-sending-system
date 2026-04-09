/**
 * Email Sequences Type Definitions
 */

export interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: EmailSequenceItem[];
}

export interface EmailSequenceItem {
  id: string;
  sequence_id: string;
  template_id: string;
  position: number;
  delay_days: number;
  delay_hours: number;
  created_at: string;
  updated_at: string;
  template_name?: string;
  template_subject?: string;
  template_category?: string;
}

export interface CreateSequenceInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateSequenceInput {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface CreateSequenceItemInput {
  template_id: string;
  delay_days?: number;
  delay_hours?: number;
}

export interface UpdateSequenceItemInput {
  item_id: string;
  position?: number;
  delay_days?: number;
  delay_hours?: number;
}

export interface SequenceWithItems extends EmailSequence {
  items: Array<EmailSequenceItem & {
    template_name?: string;
    template_subject?: string;
    template_category?: string;
  }>;
}

export interface SequenceDelay {
  days: number;
  hours: number;
  totalHours: number;
  formatted: string;
}

export function formatDelay(delayDays: number, delayHours: number): SequenceDelay {
  const totalHours = (delayDays || 0) * 24 + (delayHours || 0);

  let formatted = '';
  if (delayDays > 0) {
    formatted += `${delayDays}d `;
  }
  if (delayHours > 0) {
    formatted += `${delayHours}h`;
  }
  if (formatted === '') {
    formatted = 'Immediate';
  }

  return {
    days: delayDays || 0,
    hours: delayHours || 0,
    totalHours,
    formatted: formatted.trim()
  };
}

export function calculateSequenceDuration(items: EmailSequenceItem[]): SequenceDelay {
  const totalDays = items.reduce((sum, item) => sum + (item.delay_days || 0), 0);
  const totalHours = items.reduce((sum, item) => sum + (item.delay_hours || 0), 0);

  return formatDelay(totalDays, totalHours);
}
