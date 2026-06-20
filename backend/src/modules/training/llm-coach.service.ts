import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CredentialEncryptionService } from '../../shared/security/credential-encryption.service';
import { AiCoachGuardrailService } from './ai-coach-guardrail.service';

export type AiCoachInteractionType =
  | 'training_explanation'
  | 'feedback_explanation'
  | 'training_analysis'
  | 'activity_analysis'
  | 'question';

export interface AiCoachTextResult {
  text: string;
  usedLlm: boolean;
  safetyFiltered: boolean;
  fallbackUsed: boolean;
  guardrailReasons: string[];
}

interface CoachRequest {
  userId: string;
  interactionType: AiCoachInteractionType;
  fallbackText: string;
  evidence: Record<string, unknown>;
  ruleResult?: Record<string, unknown>;
  hardSafetyTriggered?: boolean;
  painReported?: boolean;
  instruction: string;
  userQuestion?: string;
}

@Injectable()
export class LlmCoachService {
  private readonly logger = new Logger(LlmCoachService.name);
  private readonly inFlight = new Map<string, Promise<AiCoachTextResult>>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly guardrail: AiCoachGuardrailService,
    private readonly credentials: CredentialEncryptionService,
  ) {}

  polishTrainingExplanation(params: {
    userId: string;
    fallbackText: string;
    evidence: Record<string, unknown>;
    ruleResult: Record<string, unknown>;
    hardSafetyTriggered: boolean;
  }) {
    return this.generate({
      ...params,
      interactionType: 'training_explanation',
      instruction: '用简洁自然的中文润色今日训练解释。保留事实，不增加数据，不改变训练类型、时长、TSS、强度、风险等级或安全规则。',
    });
  }

  explainFeedback(params: {
    userId: string;
    fallbackText: string;
    evidence: Record<string, unknown>;
    ruleResult: Record<string, unknown>;
    hardSafetyTriggered: boolean;
    painReported: boolean;
  }) {
    return this.generate({
      ...params,
      interactionType: 'feedback_explanation',
      instruction: '用清楚、有同理心的中文解释为什么训练被调整。只能解释已经完成的规则结果，不得提出新的训练负荷或改变调整结果。',
    });
  }

  summarizeTrainingAnalysis(params: {
    userId: string;
    fallbackText: string;
    evidence: Record<string, unknown>;
    ruleResult?: Record<string, unknown>;
  }) {
    return this.generate({
      ...params,
      interactionType: 'training_analysis',
      instruction: '根据周报、模型覆盖和恢复趋势，生成 2 到 4 句中文训练分析。明确数据不足之处，不编造指标，不做医学判断。',
    });
  }

  analyzeActivity(params: {
    userId: string;
    fallbackText: string;
    evidence: Record<string, unknown>;
    ruleResult?: Record<string, unknown>;
  }) {
    return this.generate({
      ...params,
      interactionType: 'activity_analysis',
      instruction: [
        '根据单次训练的运动类型、时长、距离、训练负荷、心率、配速或骑行功率等证据，',
        '用专业但容易理解的中文给出 3 到 5 句训练评价。',
        '评价应覆盖主要训练刺激、对运动员的益处、完成质量、注意点和恢复重点。',
        '不得编造分区、阈值、伤病或未提供的数据，不得做医学诊断。',
      ].join(''),
    });
  }

  answerQuestion(params: {
    userId: string;
    question: string;
    fallbackText: string;
    evidence: Record<string, unknown>;
    ruleResult?: Record<string, unknown>;
    hardSafetyTriggered?: boolean;
    painReported?: boolean;
  }) {
    return this.generate({
      ...params,
      interactionType: 'question',
      userQuestion: params.question,
      instruction: '仅依据提供的 AthleteOS 证据回答用户问题。可以解释和总结，但不得修改训练决策、不得给出医学诊断、不得建议忽略疼痛。',
    });
  }

  private async generate(request: CoachRequest): Promise<AiCoachTextResult> {
    const setting = await this.prisma.llmSetting.findUnique({
      where: { userId: request.userId },
    });

    if (!setting?.enabled || !setting.model || !setting.baseUrl) {
      return {
        text: request.fallbackText,
        usedLlm: false,
        safetyFiltered: false,
        fallbackUsed: true,
        guardrailReasons: [],
      };
    }

    const compatibleProviders = new Set([
      'openai-compatible',
      'openai',
      'deepseek',
      'volcengine',
      'local',
    ]);
    if (!compatibleProviders.has(setting.provider)) {
      return this.auditAndReturn(request, setting, {
        rawOutput: null,
        finalOutput: request.fallbackText,
        safetyFiltered: false,
        fallbackUsed: true,
        guardrailReasons: ['unsupported_provider'],
        errorMessage: `Unsupported LLM provider: ${setting.provider}`,
      });
    }

    const requestHash = this.createRequestHash(setting, request);
    const cached = await this.prisma.aiCoachAudit.findFirst({
      where: {
        userId: request.userId,
        requestHash,
        fallbackUsed: false,
        safetyFiltered: false,
        errorMessage: null,
        createdAt: { gte: new Date(Date.now() - this.cacheTtlMs) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (cached) {
      return this.auditAndReturn(request, setting, {
        requestHash,
        rawOutput: cached.rawOutput,
        finalOutput: cached.finalOutput,
        safetyFiltered: false,
        fallbackUsed: false,
        cacheHit: true,
        guardrailReasons: (cached.guardrailReasons as string[] | null) ?? [],
      });
    }

    const pending = this.inFlight.get(requestHash);
    if (pending) {
      return pending;
    }

    const generation = this.generateAndAudit(setting, request, requestHash);
    this.inFlight.set(requestHash, generation);
    try {
      return await generation;
    } finally {
      this.inFlight.delete(requestHash);
    }
  }

  private async generateAndAudit(
    setting: {
      provider: string;
      model: string | null;
      baseUrl: string | null;
      apiKey: string | null;
    },
    request: CoachRequest,
    requestHash: string,
  ): Promise<AiCoachTextResult> {
    try {
      const rawOutput = await this.callOpenAiCompatible(setting, request);
      const guarded = this.guardrail.evaluate(rawOutput, {
        fallbackText: request.fallbackText,
        hardSafetyTriggered: request.hardSafetyTriggered,
        painReported: request.painReported,
      });

      return this.auditAndReturn(request, setting, {
        requestHash,
        rawOutput,
        finalOutput: guarded.text,
        safetyFiltered: guarded.filtered,
        fallbackUsed: guarded.filtered,
        cacheHit: false,
        guardrailReasons: guarded.reasons,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI Coach fallback (${request.interactionType}): ${message}`);
      return this.auditAndReturn(request, setting, {
        requestHash,
        rawOutput: null,
        finalOutput: request.fallbackText,
        safetyFiltered: false,
        fallbackUsed: true,
        cacheHit: false,
        guardrailReasons: ['llm_error'],
        errorMessage: message,
      });
    }
  }

  private createRequestHash(
    setting: { provider: string; model: string | null; baseUrl: string | null },
    request: CoachRequest,
  ): string {
    return createHash('sha256')
      .update(this.stableStringify({
        version: 1,
        provider: setting.provider,
        model: setting.model,
        baseUrl: setting.baseUrl,
        interactionType: request.interactionType,
        instruction: request.instruction,
        userQuestion: request.userQuestion,
        evidence: request.evidence,
        ruleResult: request.ruleResult,
        hardSafetyTriggered: request.hardSafetyTriggered ?? false,
        painReported: request.painReported ?? false,
      }))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private async callOpenAiCompatible(
    setting: {
      provider: string;
      model: string | null;
      baseUrl: string | null;
      apiKey: string | null;
    },
    request: CoachRequest,
  ): Promise<string> {
    const baseUrl = setting.baseUrl!.replace(/\/+$/, '');
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;
    const response = await axios.post(
      endpoint,
      {
        model: setting.model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: [
              '你是 AthleteOS AI Coach 的沟通层。',
              '训练负荷、训练类型、时长、TSS、风险和安全结论已经由规则引擎决定，你无权修改。',
              'Hard Safety Rules 优先级最高。',
              '不得医疗诊断，不得建议用户忽略疼痛，不得编造未提供的数据。',
              '只输出最终中文文本，不要输出 JSON、Markdown 标题或分析过程。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: request.instruction,
              question: request.userQuestion,
              fallback_text: request.fallbackText,
              evidence: request.evidence,
              rule_result: request.ruleResult,
              hard_safety_triggered: request.hardSafetyTriggered ?? false,
              pain_reported: request.painReported ?? false,
            }),
          },
        ],
      },
      {
        timeout: 30_000,
        headers: {
          'Content-Type': 'application/json',
          ...(setting.apiKey
            ? {
                Authorization: `Bearer ${this.credentials.decrypt(
                  setting.apiKey,
                )}`,
              }
            : {}),
        },
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('LLM response did not contain message content');
    }
    return content.trim();
  }

  private async auditAndReturn(
    request: CoachRequest,
    setting: { provider: string; model: string | null },
    result: {
      rawOutput: string | null;
      finalOutput: string;
      safetyFiltered: boolean;
      fallbackUsed: boolean;
      requestHash?: string;
      cacheHit?: boolean;
      guardrailReasons: string[];
      errorMessage?: string;
    },
  ): Promise<AiCoachTextResult> {
    try {
      await this.prisma.aiCoachAudit.create({
        data: {
          userId: request.userId,
          interactionType: request.interactionType,
          provider: setting.provider,
          model: setting.model,
          requestHash: result.requestHash,
          inputEvidence: {
            ...request.evidence,
            ...(request.userQuestion ? { question: request.userQuestion } : {}),
          } as any,
          ruleResult: request.ruleResult as any,
          rawOutput: result.rawOutput,
          finalOutput: result.finalOutput,
          guardrailReasons: result.guardrailReasons as any,
          safetyFiltered: result.safetyFiltered,
          fallbackUsed: result.fallbackUsed,
          cacheHit: result.cacheHit ?? false,
          errorMessage: result.errorMessage,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist AI Coach audit: ${error.message}`);
    }

    return {
      text: result.finalOutput,
      usedLlm: !result.fallbackUsed,
      safetyFiltered: result.safetyFiltered,
      fallbackUsed: result.fallbackUsed,
      guardrailReasons: result.guardrailReasons,
    };
  }
}
