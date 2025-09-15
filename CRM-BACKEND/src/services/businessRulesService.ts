import { Pool } from 'pg';

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  conditions: any;
  actions: any;
  isActive: boolean;
  priority: number;
}

export interface RuleContext {
  caseData: any;
  userData: any;
  clientData: any;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  executed: boolean;
  actions: any[];
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
          errors: [error instanceof Error ? error.message : 'Unknown error']
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
        actions: []
      };
    }

    const executedActions = await this.executeActions(rule.actions, context);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      executed: true,
      actions: executedActions
    };
  }

  private evaluateConditions(conditions: any, context: RuleContext): boolean {
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

  private async executeActions(actions: any[], context: RuleContext): Promise<any[]> {
    const executedActions: any[] = [];

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

  private async executeAction(action: any, context: RuleContext): Promise<any> {
    switch (action.type) {
      case 'UPDATE_PRIORITY':
        return this.updateCasePriority(context.caseData.id, action.value);
      case 'ASSIGN_TO_USER':
        return this.assignCaseToUser(context.caseData.id, action.userId);
      case 'ADD_NOTE':
        return this.addCaseNote(context.caseData.id, action.note);
      case 'SEND_NOTIFICATION':
        return this.sendNotification(action.recipient, action.message);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private getFieldValue(field: string, context: RuleContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  private async getActiveRules(): Promise<BusinessRule[]> {
    // For now, return empty array - can be implemented with database storage
    return [];
  }

  private async updateCasePriority(caseId: string, priority: string): Promise<any> {
    const query = `
      UPDATE cases 
      SET priority = $1, "updatedAt" = CURRENT_TIMESTAMP 
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [priority, caseId]);
    return { type: 'UPDATE_PRIORITY', caseId, priority, success: true };
  }

  private async assignCaseToUser(caseId: string, userId: string): Promise<any> {
    const query = `
      UPDATE cases 
      SET "assignedTo" = $1, "updatedAt" = CURRENT_TIMESTAMP 
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [userId, caseId]);
    return { type: 'ASSIGN_TO_USER', caseId, userId, success: true };
  }

  private async addCaseNote(caseId: string, note: string): Promise<any> {
    // This would typically add to a notes table
    return { type: 'ADD_NOTE', caseId, note, success: true };
  }

  private async sendNotification(recipient: string, message: string): Promise<any> {
    // This would typically integrate with notification service
    return { type: 'SEND_NOTIFICATION', recipient, message, success: true };
  }

  async validateRule(rule: Partial<BusinessRule>): Promise<{ valid: boolean; errors: string[] }> {
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

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async getAllRules(): Promise<BusinessRule[]> {
    // For now, return empty array - can be implemented with database storage
    return [];
  }

  async updateRule(ruleId: string, updates: Partial<BusinessRule>): Promise<BusinessRule | null> {
    // For now, return null - can be implemented with database storage
    return null;
  }
}

export default BusinessRulesService;
