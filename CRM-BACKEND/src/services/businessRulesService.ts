// Disabled require-await rule for this file as some methods are async for consistency
import type { Pool } from 'pg';

export type RuleCondition = Record<string, unknown>;

export interface UpdatePriorityAction {
  type: 'UPDATE_PRIORITY';
  value: string;
}

export interface AssignUserAction {
  type: 'ASSIGN_TO_USER';
  userId: string;
}

export interface AddNoteAction {
  type: 'ADD_NOTE';
  note: string;
}

export interface SendNotificationAction {
  type: 'SEND_NOTIFICATION';
  recipient: string;
  message: string;
}

export type RuleAction =
  | UpdatePriorityAction
  | AssignUserAction
  | AddNoteAction
  | SendNotificationAction;

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition;
  actions: RuleAction[];
  isActive: boolean;
  priority: number;
}

export interface RuleContext {
  caseData: Record<string, unknown>;
  userData: Record<string, unknown>;
  clientData: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ActionResult {
  type: string;
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  executed: boolean;
  actions: ActionResult[];
  errors?: string[];
}

class BusinessRulesService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async executeRules(context: RuleContext): Promise<RuleResult[]> {
    const rules = await this.getActiveRules();
    const results: RuleResult[] = [];

    for (const rule of rules) {
      try {
        const result = await this.executeRule(rule, context);
        results.push(result);
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          executed: false,
          actions: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    return results;
  }

  private async executeRule(rule: BusinessRule, context: RuleContext): Promise<RuleResult> {
    const conditionsMet = this.evaluateConditions(rule.conditions, context);

    if (!conditionsMet) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        executed: false,
        actions: [],
      };
    }

    const executedActions = await this.executeActions(rule.actions, context);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      executed: true,
      actions: executedActions,
    };
  }

  private evaluateConditions(conditions: RuleCondition, context: RuleContext): boolean {
    if (!conditions || typeof conditions !== 'object') {
      return true;
    }

    // Simple condition evaluation - can be extended
    for (const [field, expectedValue] of Object.entries(conditions)) {
      const actualValue = this.getFieldValue(field, context);
      if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  private async executeActions(
    actions: RuleAction[],
    context: RuleContext
  ): Promise<ActionResult[]> {
    const executedActions: ActionResult[] = [];

    for (const action of actions || []) {
      try {
        const result = await this.executeAction(action, context);
        executedActions.push(result);
      } catch (error) {
        console.error('Error executing action:', error);
      }
    }

    return executedActions;
  }

  private async executeAction(action: RuleAction, context: RuleContext): Promise<ActionResult> {
    switch (action.type) {
      case 'UPDATE_PRIORITY':
        return this.updateCasePriority(context.caseData.id as string, action.value);
      case 'ASSIGN_TO_USER':
        return this.assignCaseToUser(context.caseData.id as string, action.userId);
      case 'ADD_NOTE':
        return this.addCaseNote(context.caseData.id as string, action.note);
      case 'SEND_NOTIFICATION':
        return this.sendNotification(action.recipient, action.message);
      default:
        throw new Error(`Unknown action type: ${(action as { type: string }).type}`);
    }
  }

  private getFieldValue(field: string, context: RuleContext): unknown {
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private getActiveRules(): Promise<BusinessRule[]> {
    // For now, return empty array - can be implemented with database storage
    return Promise.resolve([]);
  }

  private async updateCasePriority(caseId: string, priority: string): Promise<ActionResult> {
    const query = `
      UPDATE cases 
      SET priority = $1, "updatedAt" = CURRENT_TIMESTAMP 
      WHERE id = $2
      RETURNING *
    `;

    await this.pool.query(query, [priority, caseId]);
    return { type: 'UPDATE_PRIORITY', caseId, priority, success: true };
  }

  // DEPRECATED: Case-level assignment removed
  // All assignments are now handled at the verification task level
  private assignCaseToUser(caseId: string, userId: string): Promise<ActionResult> {
    // This method is deprecated and should not be used
    // Use verification task assignment instead
    return Promise.resolve({
      type: 'ASSIGN_TO_USER',
      caseId,
      userId,
      success: false,
      error: 'Case-level assignment is deprecated. Use task-level assignment instead.',
    });
  }

  private addCaseNote(caseId: string, note: string): Promise<ActionResult> {
    // This would typically add to a notes table
    return Promise.resolve({ type: 'ADD_NOTE', caseId, note, success: true });
  }

  private sendNotification(recipient: string, message: string): Promise<ActionResult> {
    // This would typically integrate with notification service
    return Promise.resolve({ type: 'SEND_NOTIFICATION', recipient, message, success: true });
  }

  validateRule(rule: Partial<BusinessRule>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!rule.name || rule.name.trim().length === 0) {
      errors.push('Rule name is required');
    }

    if (!rule.conditions) {
      errors.push('Rule conditions are required');
    }

    if (!rule.actions || !Array.isArray(rule.actions) || rule.actions.length === 0) {
      errors.push('Rule must have at least one action');
    }

    return Promise.resolve({
      valid: errors.length === 0,
      errors,
    });
  }

  getAllRules(): Promise<BusinessRule[]> {
    // For now, return empty array - can be implemented with database storage
    return Promise.resolve([]);
  }

  updateRule(_ruleId: string, _updates: Partial<BusinessRule>): Promise<BusinessRule | null> {
    // For now, return null - can be implemented with database storage
    return Promise.resolve(null);
  }
}

export default BusinessRulesService;
