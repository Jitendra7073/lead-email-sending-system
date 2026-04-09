/**
 * Integration Tests for Dependency Chain Management
 *
 * Tests the email dependency chain APIs and validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { executeQuery } from '@/lib/db/postgres';

describe('Dependency Chain Management', () => {
  let testCampaignId: number;
  let testGroupId: number;
  let testQueueEmails: any[] = [];

  beforeEach(async () => {
    // Create test template group with gaps
    const groupResult = await executeQuery(
      `INSERT INTO template_groups (name, gap_days, gap_hours, gap_minutes, send_time)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Dependency Test Group', 2, 0, 0, '10:00']
    );
    testGroupId = groupResult[0].id;

    // Create test templates
    await executeQuery(
      `INSERT INTO templates (group_id, name, template_order, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [testGroupId, 'Template 1', 1, 'Subject 1', 'Body 1']
    );

    await executeQuery(
      `INSERT INTO templates (group_id, name, template_order, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [testGroupId, 'Template 2', 2, 'Subject 2', 'Body 2']
    );

    await executeQuery(
      `INSERT INTO templates (group_id, name, template_order, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [testGroupId, 'Template 3', 3, 'Subject 3', 'Body 3']
    );

    // Create test contact
    const contactResult = await executeQuery(
      `INSERT INTO contacts (type, value, country_code, timezone)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['email', 'test@example.com', 'US', 'America/New_York']
    );
    const contactId = contactResult[0].id;

    // Get template IDs
    const templates = await executeQuery(
      `SELECT id FROM templates WHERE group_id = $1 ORDER BY template_order`,
      [testGroupId]
    );

    // Create campaign
    const campaignResult = await executeQuery(
      `INSERT INTO campaigns (name, template_group_id, start_date)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Dependency Test Campaign', testGroupId, '2026-04-07']
    );
    testCampaignId = campaignResult[0].id;

    // Create queued emails with dependencies
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const dependsOn = i > 0 ? testQueueEmails[i - 1]?.id : null;

      const emailResult = await executeQuery(
        `INSERT INTO email_queue
         (campaign_id, contact_id, template_id, scheduled_at, status, template_order, depends_on_email_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          testCampaignId,
          contactId,
          template.id,
          `2026-04-${7 + i}T10:00:00Z`,
          i === 0 ? 'sent' : 'pending',
          i + 1,
          dependsOn
        ]
      );

      testQueueEmails.push({ id: emailResult[0].id, template_id: template.id, order: i + 1 });
    }
  });

  afterEach(async () => {
    // Clean up test data
    await executeQuery('DELETE FROM email_queue WHERE campaign_id = $1', [testCampaignId]);
    await executeQuery('DELETE FROM campaigns WHERE id = $1', [testCampaignId]);
    await executeQuery('DELETE FROM templates WHERE group_id = $1', [testGroupId]);
    await executeQuery('DELETE FROM template_groups WHERE id = $1', [testGroupId]);
    await executeQuery('DELETE FROM contacts WHERE value = $1', ['test@example.com']);
    testQueueEmails = [];
  });

  describe('GET /api/queue/[id]/dependencies', () => {
    it('should return dependency chain for middle email', async () => {
      const middleEmailId = testQueueEmails[1].id;

      const response = await fetch(`http://localhost:8080/api/queue/${middleEmailId}/dependencies`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.dependencies).toBeDefined();

      // Should have previous email
      expect(data.data.dependencies.previous).toBeDefined();
      expect(data.data.dependencies.previous.id).toBe(testQueueEmails[0].id);

      // Should have next email
      expect(data.data.dependencies.next).toBeDefined();
      expect(data.data.dependencies.next.length).toBe(1);
      expect(data.data.dependencies.next[0].id).toBe(testQueueEmails[2].id);

      // Should show chain status
      expect(data.data.chain_status).toBeDefined();
      expect(data.data.chain_status.total_emails).toBe(3);
      expect(data.data.chain_status.current_position).toBe(2);
    });

    it('should handle first email in chain', async () => {
      const firstEmailId = testQueueEmails[0].id;

      const response = await fetch(`http://localhost:8080/api/queue/${firstEmailId}/dependencies`);
      expect(response.status).toBe(200);

      const data = await response.json();

      // Should not have previous email
      expect(data.data.dependencies.previous).toBeNull();

      // Should have next emails
      expect(data.data.dependencies.next).toBeDefined();
      expect(data.data.dependencies.next.length).toBeGreaterThan(0);

      // Should indicate first in chain
      expect(data.data.metadata.is_first_in_chain).toBe(true);
    });

    it('should handle last email in chain', async () => {
      const lastEmailId = testQueueEmails[2].id;

      const response = await fetch(`http://localhost:8080/api/queue/${lastEmailId}/dependencies`);
      expect(response.status).toBe(200);

      const data = await response.json();

      // Should not have next emails
      expect(data.data.dependencies.next).toHaveLength(0);

      // Should indicate last in chain
      expect(data.data.metadata.is_last_in_chain).toBe(true);
    });

    it('should include chain visualization', async () => {
      const emailId = testQueueEmails[1].id;

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/dependencies`);
      const data = await response.json();

      expect(data.data.dependencies.chain).toBeDefined();
      expect(data.data.dependencies.chain.length).toBe(3);

      // Check current email is marked
      const currentEmail = data.data.dependencies.chain.find((e: any) => e.is_current);
      expect(currentEmail).toBeDefined();
      expect(currentEmail.id).toBe(emailId);
    });

    it('should calculate chain health correctly', async () => {
      const emailId = testQueueEmails[1].id;

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/dependencies`);
      const data = await response.json();

      const chainStatus = data.data.chain_status;

      // First email is sent, so chain should not be blocked
      expect(chainStatus.is_chain_blocked).toBe(false);
      expect(chainStatus.can_proceed).toBe(true);
      expect(chainStatus.completed_before).toBe(1);
    });
  });

  describe('POST /api/queue/[id]/validate', () => {
    it('should validate email schedule', async () => {
      const emailId = testQueueEmails[1].id;

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.validation).toBeDefined();
      expect(data.data.recalculated_schedule).toBeDefined();
    });

    it('should suggest adjustments if needed', async () => {
      const emailId = testQueueEmails[1].id;

      // Update scheduled time to be outside business hours
      await executeQuery(
        `UPDATE email_queue SET scheduled_at = $1 WHERE id = $2`,
        ['2026-04-07T02:00:00Z', emailId]
      );

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      expect(data.data.validation.is_valid).toBeDefined();
      expect(data.data.recalculated_schedule.adjustments).toBeDefined();
    });

    it('should auto-adjust when requested', async () => {
      const emailId = testQueueEmails[2].id;

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_adjust: true })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should indicate if auto-adjusted
      expect(data.data.metadata).toBeDefined();
    });

    it('should not auto-adjust sent emails', async () => {
      const sentEmailId = testQueueEmails[0].id;

      const response = await fetch(`http://localhost:8080/api/queue/${sentEmailId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_adjust: true })
      });

      const data = await response.json();

      // Should not auto-adjust sent emails
      expect(data.data.metadata.can_auto_adjust).toBe(false);
    });
  });

  describe('dependency chain validation', () => {
    it('should detect blocked chains', async () => {
      // Mark first email as failed
      await executeQuery(
        `UPDATE email_queue SET status = 'failed' WHERE id = $1`,
        [testQueueEmails[0].id]
      );

      const emailId = testQueueEmails[1].id;

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/dependencies`);
      const data = await response.json();

      expect(data.data.chain_status.is_chain_blocked).toBe(true);
      expect(data.data.chain_status.can_proceed).toBe(false);
    });

    it('should handle missing dependencies gracefully', async () => {
      // Create email with invalid dependency
      const invalidResult = await executeQuery(
        `INSERT INTO email_queue (campaign_id, contact_id, template_id, scheduled_at, status, template_order, depends_on_email_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [testCampaignId, 1, testQueueEmails[0].template_id, '2026-04-07T10:00:00Z', 'pending', 4, 99999]
      );

      const invalidEmailId = invalidResult[0].id;

      const response = await fetch(`http://localhost:8080/api/queue/${invalidEmailId}/dependencies`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.dependencies.previous).toBeDefined();

      // Cleanup
      await executeQuery('DELETE FROM email_queue WHERE id = $1', [invalidEmailId]);
    });
  });

  describe('chain statistics', () => {
    it('should provide accurate chain position', async () => {
      const firstEmailId = testQueueEmails[0].id;
      const middleEmailId = testQueueEmails[1].id;
      const lastEmailId = testQueueEmails[2].id;

      const firstResponse = await fetch(`http://localhost:8080/api/queue/${firstEmailId}/dependencies`);
      const middleResponse = await fetch(`http://localhost:8080/api/queue/${middleEmailId}/dependencies`);
      const lastResponse = await fetch(`http://localhost:8080/api/queue/${lastEmailId}/dependencies`);

      const firstData = (await firstResponse.json()).data.chain_status;
      const middleData = (await middleResponse.json()).data.chain_status;
      const lastData = (await lastResponse.json()).data.chain_status;

      expect(firstData.current_position).toBe(1);
      expect(middleData.current_position).toBe(2);
      expect(lastData.current_position).toBe(3);
    });

    it('should count pending emails correctly', async () => {
      const emailId = testQueueEmails[0].id;

      const response = await fetch(`http://localhost:8080/api/queue/${emailId}/dependencies`);
      const data = await response.json();

      // 2 pending emails after the first one
      expect(data.data.chain_status.pending_after).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent email ID', async () => {
      const response = await fetch('http://localhost:8080/api/queue/99999/dependencies');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      // Should return empty or not found state
    });

    it('should handle invalid email ID', async () => {
      const response = await fetch('http://localhost:8080/api/queue/invalid/dependencies');
      expect(response.status).toBe(400);
    });
  });
});
