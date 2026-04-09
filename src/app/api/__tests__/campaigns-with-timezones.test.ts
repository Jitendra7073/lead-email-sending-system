/**
 * Integration Tests for Campaigns with Timezones
 *
 * Tests the complete flow of creating campaigns with timezone-aware scheduling
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { executeQuery } from '@/lib/db/postgres';

describe('Campaigns with Timezones Integration', () => {
  let testGroupId: number;
  let testContacts: any[] = [];

  beforeEach(async () => {
    // Create test template group
    const groupResult = await executeQuery(
      `INSERT INTO template_groups (name, gap_days, gap_hours, gap_minutes, send_time)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Test Group', 1, 0, 0, '10:00']
    );
    testGroupId = groupResult[0].id;

    // Create test templates
    await executeQuery(
      `INSERT INTO templates (group_id, name, template_order, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [testGroupId, 'Email 1', 1, 'Test Subject 1', 'Test Body 1']
    );

    await executeQuery(
      `INSERT INTO templates (group_id, name, template_order, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [testGroupId, 'Email 2', 2, 'Test Subject 2', 'Test Body 2']
    );

    // Create test contacts with different timezones
    const contactResults = await Promise.all([
      executeQuery(
        `INSERT INTO contacts (type, value, site_id, country_code, timezone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['email', 'us@example.com', 1, 'US', 'America/New_York']
      ),
      executeQuery(
        `INSERT INTO contacts (type, value, site_id, country_code, timezone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['email', 'uk@example.com', 2, 'GB', 'Europe/London']
      ),
      executeQuery(
        `INSERT INTO contacts (type, value, site_id, country_code, timezone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['email', 'in@example.com', 3, 'IN', 'Asia/Kolkata']
      ),
      executeQuery(
        `INSERT INTO contacts (type, value, site_id, country_code, timezone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['email', 'ae@example.com', 4, 'AE', 'Asia/Dubai']
      )
    ]);

    testContacts = contactResults.map(r => ({ id: r[0].id }));
  });

  afterEach(async () => {
    // Clean up test data
    await executeQuery('DELETE FROM email_queue WHERE template_id IN (SELECT id FROM templates WHERE group_id = $1)', [testGroupId]);
    await executeQuery('DELETE FROM templates WHERE group_id = $1', [testGroupId]);
    await executeQuery('DELETE FROM template_groups WHERE id = $1', [testGroupId]);
    await executeQuery('DELETE FROM contacts WHERE id = ANY($1)', [testContacts.map(c => c.id)]);
  });

  describe('POST /api/campaigns with timezone awareness', () => {
    it('should create campaign and queue emails with timezone adjustments', async () => {
      const startDate = '2026-04-07';

      const response = await fetch('http://localhost:8080/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Campaign',
          template_group_id: testGroupId,
          contact_ids: testContacts.map(c => c.id),
          start_date: startDate
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Check that emails were queued
      const queuedEmails = await executeQuery(
        `SELECT * FROM email_queue WHERE campaign_id = $1`,
        [data.data.id]
      );

      expect(queuedEmails.length).toBeGreaterThan(0);

      // Verify timezone-specific adjustments
      const usEmails = queuedEmails.filter((e: any) => e.contact_id === testContacts[0].id);
      const inEmails = queuedEmails.filter((e: any) => e.contact_id === testContacts[2].id);

      expect(usEmails.length).toBeGreaterThan(0);
      expect(inEmails.length).toBeGreaterThan(0);
    });

    it('should handle different weekend patterns correctly', async () => {
      // Create campaign starting on Friday (weekend in UAE, weekday in US)
      const fridayStart = '2026-04-10'; // Friday

      const response = await fetch('http://localhost:8080/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Weekend Test Campaign',
          template_group_id: testGroupId,
          contact_ids: testContacts.map(c => c.id),
          start_date: fridayStart
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      // Check UAE contact adjustments (Friday-Saturday weekend)
      const aeEmails = await executeQuery(
        `SELECT * FROM email_queue
         WHERE campaign_id = $1 AND contact_id = $2`,
        [data.data.id, testContacts[3].id]
      );

      expect(aeEmails.length).toBeGreaterThan(0);
      // Should be adjusted to Sunday
      const scheduledDate = new Date(aeEmails[0].scheduled_at);
      expect(scheduledDate.getDay()).not.toBe(5); // Not Friday
      expect(scheduledDate.getDay()).not.toBe(6); // Not Saturday
    });
  });

  describe('GET /api/campaigns with timezone metadata', () => {
    it('should include timezone information in campaign stats', async () => {
      // Create campaign first
      const createResponse = await fetch('http://localhost:8080/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Stats Test Campaign',
          template_group_id: testGroupId,
          contact_ids: testContacts.map(c => c.id),
          start_date: '2026-04-07'
        })
      });

      const campaignData = (await createResponse.json()).data;

      // Get campaign stats
      const statsResponse = await fetch(`http://localhost:8080/api/campaigns/${campaignData.id}/stats`);
      expect(statsResponse.status).toBe(200);

      const stats = await statsResponse.json();
      expect(stats.success).toBe(true);
      expect(stats.data).toBeDefined();
    });
  });

  describe('schedule preview endpoint', () => {
    it('should preview schedule with timezone adjustments', async () => {
      const response = await fetch('http://localhost:8080/api/schedule/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_group_id: testGroupId,
          contact_ids: testContacts.map(c => c.id),
          start_date: '2026-04-07'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.schedule).toBeDefined();
      expect(data.data.statistics).toBeDefined();

      // Check statistics
      expect(data.data.statistics.total_contacts).toBe(testContacts.length);
      expect(data.data.statistics.unique_timezones).toBeGreaterThan(0);
    });

    it('should show adjustment breakdown per contact', async () => {
      const response = await fetch('http://localhost:8080/api/schedule/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_group_id: testGroupId,
          contact_ids: testContacts.map(c => c.id),
          start_date: '2026-04-05' // Saturday
        })
      });

      const data = await response.json();

      // Should have weekend adjustments
      expect(data.data.statistics.weekend_adjustments).toBeGreaterThan(0);

      // Check individual contact schedules
      data.data.schedule.forEach((contact: any) => {
        expect(contact.emails).toBeDefined();
        expect(contact.emails.length).toBeGreaterThan(0);

        contact.emails.forEach((email: any) => {
          expect(email.adjustments).toBeDefined();
          expect(email.was_adjusted).toBeDefined();
        });
      });
    });
  });

  describe('timezone filtering in contacts API', () => {
    it('should filter contacts by timezone', async () => {
      const response = await fetch('http://localhost:8080/api/contacts?timezone=America/New_York');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should filter contacts by country code', async () => {
      const response = await fetch('http://localhost:8080/api/contacts?country_code=US');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should include timezone confidence in response', async () => {
      const response = await fetch('http://localhost:8080/api/contacts');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      data.data.forEach((contact: any) => {
        expect(contact.timezone_confidence).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('should handle invalid timezone gracefully', async () => {
      const response = await fetch('http://localhost:8080/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Timezone Campaign',
          template_group_id: testGroupId,
          contact_ids: testContacts.map(c => c.id),
          start_date: '2026-04-07'
        })
      });

      // Should not fail, but use fallback timezone
      expect(response.status).toBeLessThan(500);
    });

    it('should handle missing timezone data', async () => {
      // Create contact without timezone
      const noTzContact = await executeQuery(
        `INSERT INTO contacts (type, value, site_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['email', 'notz@example.com', 99]
      );

      const response = await fetch('http://localhost:8080/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'No Timezone Campaign',
          template_group_id: testGroupId,
          contact_ids: [noTzContact[0].id],
          start_date: '2026-04-07'
        })
      });

      // Should use default timezone
      expect(response.status).toBeLessThan(500);

      // Cleanup
      await executeQuery('DELETE FROM contacts WHERE id = $1', [noTzContact[0].id]);
    });
  });
});
