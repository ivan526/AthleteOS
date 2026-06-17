import { Injectable } from '@nestjs/common';

export interface GuardrailContext {
  hardSafetyTriggered?: boolean;
  painReported?: boolean;
  fallbackText: string;
}

export interface GuardrailResult {
  text: string;
  filtered: boolean;
  reasons: string[];
}

@Injectable()
export class AiCoachGuardrailService {
  evaluate(output: string, context: GuardrailContext): GuardrailResult {
    const normalized = output.trim();
    const reasons: string[] = [];

    if (!normalized) {
      reasons.push('empty_output');
    }

    const medicalDiagnosisPatterns = [
      /你(患有|得了|被诊断为)/,
      /这(一定|肯定)是.{0,12}(伤|病|炎)/,
      /(无需|不用|不必).{0,6}(就医|看医生|咨询医生)/,
    ];
    if (medicalDiagnosisPatterns.some((pattern) => pattern.test(normalized))) {
      reasons.push('medical_diagnosis_or_advice');
    }

    const ignorePainPatterns = [
      /忽略.{0,6}(疼痛|不适)/,
      /忍(着|住).{0,6}(疼痛|不适)/,
      /带伤.{0,6}(训练|跑)/,
      /疼痛.{0,8}(也可以|仍可|继续).{0,8}(高强度|冲刺|间歇)/,
    ];
    if (ignorePainPatterns.some((pattern) => pattern.test(normalized))) {
      reasons.push('ignore_pain');
    }

    if (context.hardSafetyTriggered) {
      const safetyOverridePatterns = [
        /(忽略|绕过|无需考虑).{0,8}(安全规则|风险提示)/,
        /(可以|建议|适合).{0,6}(继续|进行).{0,8}(高强度|冲刺|间歇|VO2Max)/i,
      ];
      if (safetyOverridePatterns.some((pattern) => pattern.test(normalized))) {
        reasons.push('hard_safety_override');
      }
    }

    if (reasons.length > 0) {
      return {
        text: this.ensurePainSafety(context.fallbackText, context.painReported),
        filtered: true,
        reasons,
      };
    }

    return {
      text: this.ensurePainSafety(normalized, context.painReported),
      filtered: false,
      reasons: [],
    };
  }

  private ensurePainSafety(text: string, painReported?: boolean): string {
    if (!painReported || /(医生|医疗|专业人士)/.test(text)) {
      return text;
    }
    return `${text} 如果疼痛持续或加重，请停止训练并咨询专业医生。`;
  }
}
