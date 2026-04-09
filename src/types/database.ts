export interface EmailQueue {
  id: string;
  campaign_id: string;
  sender_id: string;
  contact_id: number;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  html_content: string;
  text_content: string | null;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  error_message: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  country_code: string;
  tag: string | null;
  sequence_position: number | null;
  parent_queue_id: string | null; // For dependency logic tracking
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSender {
  id: string;
  name: string;
  email: string;
  password?: string;
  service: 'resend' | 'gmail' | 'custom';
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  daily_limit: number;
  is_active: boolean;
  sent_today: number;
  last_reset_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  template_id: string;
  target_type: 'all' | 'wordpress' | 'selected' | 'tag';
  status: 'queued' | 'running' | 'paused' | 'completed';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Contact {
  id: number;
  site_id?: number;
  type: 'email' | 'phone' | 'linkedin';
  value: string;
  source_page?: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
}
