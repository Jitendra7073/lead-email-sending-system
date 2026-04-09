/**
 * Schedule Calculation and Validation
 * Main export file for scheduling utilities
 */

export {
  calculateOptimalSchedule,
  calculateQuickSchedule,
  calculateBatchSchedules,
  isValidTimezone,
  getTimezoneOffset,
  type ScheduleCalculationParams,
  type ScheduleCalculationResult
} from './timezone-calculator';

export {
  calculateDependentSchedule,
  calculateEmailSequence,
  calculateQuickDependencySchedule,
  getSuggestedGapDays,
  revalidateDependencySchedule,
  type DependencyScheduleParams,
  type DependencyScheduleResult
} from './dependency-calculator';

export {
  revalidateSchedule,
  isScheduleStillValid,
  getAdjustmentIfNeeded,
  batchRevalidateSchedules,
  needsRefresh,
  autoFixSchedule,
  getScheduleHealthMetrics,
  getSuggestedFixes,
  exportValidationSummary,
  type QueueItem,
  type ValidationResult,
  type ValidationOptions
} from './schedule-validator';
