/**
 * Unit Tests for Dependency Calculator
 *
 * Tests for email queue dependency chain calculations
 */

import { describe, it, expect } from '@jest/globals';

// Mock dependency calculator functions
// These would be imported from the actual implementation
function calculateEmailPosition(emailId: number, allEmails: any[]): number {
  return allEmails.findIndex(e => e.id === emailId);
}

function getDependentEmails(emailId: number, allEmails: any[]): any[] {
  return allEmails.filter(e => e.depends_on_email_id === emailId);
}

function getPreviousEmail(emailId: number, allEmails: any[]): any | null {
  const email = allEmails.find(e => e.id === emailId);
  if (!email || !email.depends_on_email_id) return null;
  return allEmails.find(e => e.id === email.depends_on_email_id) || null;
}

function validateDependencyChain(emailId: number, allEmails: any[]): {
  is_valid: boolean;
  can_proceed: boolean;
  blocked_by: any[];
} {
  const email = allEmails.find(e => e.id === emailId);
  if (!email) {
    return { is_valid: false, can_proceed: false, blocked_by: [] };
  }

  if (!email.depends_on_email_id) {
    return { is_valid: true, can_proceed: true, blocked_by: [] };
  }

  const previousEmail = allEmails.find(e => e.id === email.depends_on_email_id);
  if (!previousEmail) {
    return { is_valid: false, can_proceed: false, blocked_by: [] };
  }

  const blocked = previousEmail.status !== 'sent';
  return {
    is_valid: true,
    can_proceed: !blocked,
    blocked_by: blocked ? [previousEmail] : []
  };
}

describe('DependencyCalculator', () => {
  const mockEmails = [
    { id: 1, contact_id: 100, template_id: 1, status: 'sent', depends_on_email_id: null, template_order: 1 },
    { id: 2, contact_id: 100, template_id: 2, status: 'pending', depends_on_email_id: 1, template_order: 2 },
    { id: 3, contact_id: 100, template_id: 3, status: 'pending', depends_on_email_id: 2, template_order: 3 },
    { id: 4, contact_id: 101, template_id: 1, status: 'sent', depends_on_email_id: null, template_order: 1 },
    { id: 5, contact_id: 101, template_id: 2, status: 'failed', depends_on_email_id: 4, template_order: 2 },
    { id: 6, contact_id: 101, template_id: 3, status: 'pending', depends_on_email_id: 5, template_order: 3 },
  ];

  describe('calculateEmailPosition', () => {
    it('should find position of email in chain', () => {
      const position = calculateEmailPosition(2, mockEmails);
      expect(position).toBe(1);
    });

    it('should return -1 for non-existent email', () => {
      const position = calculateEmailPosition(999, mockEmails);
      expect(position).toBe(-1);
    });

    it('should handle first email in chain', () => {
      const position = calculateEmailPosition(1, mockEmails);
      expect(position).toBe(0);
    });
  });

  describe('getDependentEmails', () => {
    it('should find emails that depend on given email', () => {
      const dependents = getDependentEmails(1, mockEmails);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(2);
    });

    it('should return empty array for email with no dependents', () => {
      const dependents = getDependentEmails(3, mockEmails);
      expect(dependents).toHaveLength(0);
    });

    it('should handle middle of chain', () => {
      const dependents = getDependentEmails(2, mockEmails);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(3);
    });
  });

  describe('getPreviousEmail', () => {
    it('should get previous email in chain', () => {
      const previous = getPreviousEmail(2, mockEmails);
      expect(previous).toBeDefined();
      expect(previous?.id).toBe(1);
    });

    it('should return null for first email in chain', () => {
      const previous = getPreviousEmail(1, mockEmails);
      expect(previous).toBeNull();
    });

    it('should return null for non-existent email', () => {
      const previous = getPreviousEmail(999, mockEmails);
      expect(previous).toBeNull();
    });
  });

  describe('validateDependencyChain', () => {
    it('should allow proceeding when previous email sent', () => {
      const validation = validateDependencyChain(2, mockEmails);
      expect(validation.is_valid).toBe(true);
      expect(validation.can_proceed).toBe(true);
      expect(validation.blocked_by).toHaveLength(0);
    });

    it('should block when previous email failed', () => {
      const validation = validateDependencyChain(6, mockEmails);
      expect(validation.is_valid).toBe(true);
      expect(validation.can_proceed).toBe(false);
      expect(validation.blocked_by).toHaveLength(1);
      expect(validation.blocked_by[0].id).toBe(5);
    });

    it('should allow first email to proceed', () => {
      const validation = validateDependencyChain(1, mockEmails);
      expect(validation.is_valid).toBe(true);
      expect(validation.can_proceed).toBe(true);
      expect(validation.blocked_by).toHaveLength(0);
    });

    it('should handle non-existent email', () => {
      const validation = validateDependencyChain(999, mockEmails);
      expect(validation.is_valid).toBe(false);
      expect(validation.can_proceed).toBe(false);
    });
  });

  describe('chain analysis', () => {
    it('should identify complete chain for contact', () => {
      const contact100Emails = mockEmails.filter(e => e.contact_id === 100);
      expect(contact100Emails).toHaveLength(3);

      const first = contact100Emails.find(e => e.template_order === 1);
      const middle = contact100Emails.find(e => e.template_order === 2);
      const last = contact100Emails.find(e => e.template_order === 3);

      expect(first?.depends_on_email_id).toBeNull();
      expect(middle?.depends_on_email_id).toBe(1);
      expect(last?.depends_on_email_id).toBe(2);
    });

    it('should detect blocked chains', () => {
      const contact101Emails = mockEmails.filter(e => e.contact_id === 101);
      const lastEmail = contact101Emails.find(e => e.template_order === 3);

      const validation = validateDependencyChain(lastEmail!.id, mockEmails);
      expect(validation.can_proceed).toBe(false);
      expect(validation.blocked_by[0].status).toBe('failed');
    });

    it('should calculate chain position', () => {
      const position2 = calculateEmailPosition(2, mockEmails);
      const position3 = calculateEmailPosition(3, mockEmails);

      expect(position2).toBeLessThan(position3);
      expect(position3 - position2).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle single email chain', () => {
      const singleChain = [{ id: 1, contact_id: 200, template_id: 1, status: 'pending', depends_on_email_id: null, template_order: 1 }];

      const validation = validateDependencyChain(1, singleChain);
      expect(validation.can_proceed).toBe(true);
      expect(validation.blocked_by).toHaveLength(0);
    });

    it('should handle broken dependencies', () => {
      const brokenChain = [
        { id: 1, contact_id: 300, template_id: 1, status: 'sent', depends_on_email_id: null, template_order: 1 },
        { id: 2, contact_id: 300, template_id: 2, status: 'pending', depends_on_email_id: 999, template_order: 2 }
      ];

      const validation = validateDependencyChain(2, brokenChain);
      expect(validation.is_valid).toBe(false);
    });

    it('should handle circular dependencies (invalid state)', () => {
      const circularChain = [
        { id: 1, contact_id: 400, template_id: 1, status: 'pending', depends_on_email_id: 2, template_order: 1 },
        { id: 2, contact_id: 400, template_id: 2, status: 'pending', depends_on_email_id: 1, template_order: 2 }
      ];

      const validation1 = validateDependencyChain(1, circularChain);
      const validation2 = validateDependencyChain(2, circularChain);

      expect(validation1.can_proceed).toBe(false);
      expect(validation2.can_proceed).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('should allow transition from pending to sent', () => {
      const emails = [
        { id: 1, contact_id: 500, template_id: 1, status: 'sent', depends_on_email_id: null, template_order: 1 },
        { id: 2, contact_id: 500, template_id: 2, status: 'pending', depends_on_email_id: 1, template_order: 2 }
      ];

      const validation = validateDependencyChain(2, emails);
      expect(validation.can_proceed).toBe(true);
    });

    it('should block transition when previous is pending', () => {
      const emails = [
        { id: 1, contact_id: 600, template_id: 1, status: 'pending', depends_on_email_id: null, template_order: 1 },
        { id: 2, contact_id: 600, template_id: 2, status: 'pending', depends_on_email_id: 1, template_order: 2 }
      ];

      const validation = validateDependencyChain(2, emails);
      expect(validation.can_proceed).toBe(false);
    });

    it('should block transition when previous is failed', () => {
      const emails = [
        { id: 1, contact_id: 700, template_id: 1, status: 'failed', depends_on_email_id: null, template_order: 1 },
        { id: 2, contact_id: 700, template_id: 2, status: 'pending', depends_on_email_id: 1, template_order: 2 }
      ];

      const validation = validateDependencyChain(2, emails);
      expect(validation.can_proceed).toBe(false);
    });
  });
});
