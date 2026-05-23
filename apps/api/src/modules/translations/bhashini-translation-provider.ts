import { Injectable, Logger } from '@nestjs/common';
import { TranslationProvider } from './translation-provider';

/**
 * Bhashini (https://bhashini.gov.in/) translation provider.
 *
 * Set the following env vars to enable:
 *   BHASHINI_USER_ID       — from the Bhashini dashboard
 *   BHASHINI_API_KEY       — the "ULCA API Key"
 *   BHASHINI_PIPELINE_ID   — optional, defaults to the IndicTrans v2 pipeline
 *
 * Sign-up is free at https://bhashini.gov.in (project → Inference → create a
 * user). Copy the userID and ulcaApiKey shown after creation.
 */
@Injectable()
export class BhashiniTranslationProvider implements TranslationProvider {
  private readonly logger = new Logger(BhashiniTranslationProvider.name);
  private readonly authUrl =
    'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
  private readonly pipelineId =
    process.env.BHASHINI_PIPELINE_ID ?? '64392f96daac500b55c543cd';

  /** cache: `${from}-${to}` → { callbackUrl, authKey, authValue, serviceId } */
  private readonly cache = new Map<
    string,
    { callbackUrl: string; authKey: string; authValue: string; serviceId: string }
  >();

  async translate(text: string, fromCode: string, toCode: string): Promise<string> {
    if (!text) return text;
    if (fromCode === toCode) return text;

    const cfg = await this.getPipeline(fromCode, toCode);
    const res = await fetch(cfg.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [cfg.authKey]: cfg.authValue,
      },
      body: JSON.stringify({
        pipelineTasks: [
          {
            taskType: 'translation',
            config: {
              language: { sourceLanguage: fromCode, targetLanguage: toCode },
              serviceId: cfg.serviceId,
            },
          },
        ],
        inputData: { input: [{ source: text }] },
      }),
      // Cap inference latency so a slow Bhashini doesn't block menu writes.
      // The caller (translations.service) catches and falls back to source.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bhashini inference ${res.status}: ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const out = data?.pipelineResponse?.[0]?.output?.[0]?.target;
    if (typeof out !== 'string' || !out.trim()) {
      throw new Error(`Bhashini returned no translation: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return out;
  }

  private async getPipeline(from: string, to: string) {
    const key = `${from}-${to}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const userId = process.env.BHASHINI_USER_ID;
    const apiKey = process.env.BHASHINI_API_KEY;
    if (!userId || !apiKey) {
      throw new Error('BHASHINI_USER_ID / BHASHINI_API_KEY are not set');
    }

    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        userID: userId,
        ulcaApiKey: apiKey,
      },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        pipelineTasks: [
          {
            taskType: 'translation',
            config: { language: { sourceLanguage: from, targetLanguage: to } },
          },
        ],
        pipelineRequestConfig: { pipelineId: this.pipelineId },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bhashini pipeline ${res.status}: ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const ep = data?.pipelineInferenceAPIEndPoint;
    const serviceId = data?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
    if (!ep?.callbackUrl || !ep?.inferenceApiKey?.name || !ep?.inferenceApiKey?.value || !serviceId) {
      throw new Error('Bhashini pipeline response missing fields');
    }
    const cfg = {
      callbackUrl: ep.callbackUrl,
      authKey: ep.inferenceApiKey.name,
      authValue: ep.inferenceApiKey.value,
      serviceId,
    };
    this.cache.set(key, cfg);
    return cfg;
  }
}
