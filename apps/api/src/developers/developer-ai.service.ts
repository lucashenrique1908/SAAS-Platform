import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeveloperAiService {
  constructor(private readonly config: ConfigService) {}

  async generateCvSummary(source: {
    profile: {
      name: string;
      title: string | null;
      biography: string | null;
    } | null;
    skills: string[];
    experience: Array<{ role: string; company: string; description: string }>;
    education: Array<{
      course: string;
      institution: string;
      degree: string | null;
    }>;
    certifications: Array<{ name: string; issuingInstitution: string }>;
    projects: Array<{
      name: string;
      description: string;
      technologies: string[];
    }>;
  }) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException(
        'AI CV generation is not configured.',
      );
    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-4.1-mini';
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions:
            'Write a concise professional CV summary using only the supplied facts. Do not add or infer qualifications, employers, dates, achievements, or skills. Return only the summary text.',
          input: JSON.stringify(source),
          max_output_tokens: 220,
          store: false,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error('provider failure');
      const payload: unknown = await response.json();
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('output' in payload) ||
        !Array.isArray(payload.output)
      )
        throw new Error('invalid response');
      const text = payload.output
        .flatMap((item) =>
          typeof item === 'object' &&
          item !== null &&
          'content' in item &&
          Array.isArray(item.content)
            ? item.content
            : [],
        )
        .find(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            'type' in item &&
            item.type === 'output_text' &&
            'text' in item &&
            typeof item.text === 'string',
        );
      if (
        !text ||
        !('text' in text) ||
        typeof text.text !== 'string' ||
        !text.text.trim() ||
        text.text.length > 2500
      )
        throw new Error('invalid output');
      return text.text.trim();
    } catch {
      throw new ServiceUnavailableException(
        'AI could not generate a CV summary. Your saved profile was not changed.',
      );
    }
  }

  async generateRoadmap(
    goal: string,
    currentSkills: string[],
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      completed: boolean;
    }>
  > {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException(
        'AI roadmap generation is not configured.',
      );
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4.1-mini',
          instructions:
            'Create a practical learning roadmap with 3 to 8 tasks for the stated goal and current skills. Do not invent or claim certifications. Do not create URLs or specific resources. Output only a JSON array of objects with title and description.',
          input: JSON.stringify({
            goal,
            currentSkills: currentSkills.slice(0, 50),
          }),
          max_output_tokens: 900,
          store: false,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error('provider failure');
      const payload: unknown = await response.json();
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('output' in payload) ||
        !Array.isArray(payload.output)
      )
        throw new Error('invalid response');
      const output = payload.output
        .flatMap((item) =>
          typeof item === 'object' &&
          item !== null &&
          'content' in item &&
          Array.isArray(item.content)
            ? item.content
            : [],
        )
        .find(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            'type' in item &&
            item.type === 'output_text' &&
            'text' in item &&
            typeof item.text === 'string',
        );
      if (!output || !('text' in output) || typeof output.text !== 'string')
        throw new Error('invalid output');
      const decoded: unknown = JSON.parse(output.text);
      if (!Array.isArray(decoded) || decoded.length < 3 || decoded.length > 8)
        throw new Error('invalid roadmap');
      return decoded.map((item, index) => {
        if (
          typeof item !== 'object' ||
          item === null ||
          !('title' in item) ||
          typeof item.title !== 'string' ||
          !('description' in item) ||
          typeof item.description !== 'string' ||
          !item.title.trim() ||
          item.title.length > 160 ||
          item.description.length > 2000
        )
          throw new Error('invalid roadmap item');
        return {
          id: `ai-${index + 1}`,
          title: item.title.trim(),
          description: item.description.trim(),
          completed: false,
        };
      });
    } catch {
      throw new ServiceUnavailableException(
        'AI could not generate a valid roadmap. Existing roadmaps were not changed.',
      );
    }
  }
}
