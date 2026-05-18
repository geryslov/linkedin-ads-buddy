import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const MAX_TOOL_ITERATIONS = 5;

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const systemPrompts: Record<string, string> = {
  creative_performance: `You are a senior LinkedIn Ads performance analyst. The user will provide their creative performance data as JSON and ask questions about it.

Your role:
- Analyze creative performance trends and anomalies
- Evaluate cost efficiency (CPL, CPC, CTR) across time periods (7d, 14d, 30d, Last Month)
- Detect creative fatigue signals (rising CPL, declining CTR)
- Provide actionable optimization recommendations
- Suggest budget reallocation between creatives
- Identify top and bottom performers

Data context: Each creative has metrics across 4 time periods: Last 7 Days, Last 14 Days, Last 30 Days, and Last Month. Each creative may run across multiple campaigns. Key metrics are Spend, CPL (Cost Per Lead), and CTR (Click-Through Rate).

Trend flags: A creative is flagged if 7d CPL is >15% above 30d CPL, or 7d CTR is >15% below 30d CTR.

Be concise and data-driven. Use specific numbers from the data. Format your response in markdown with headers and bullet points.`,

  creative_analysis: `You are a senior LinkedIn Ads creative strategist and performance analyst. You specialize in engagement objective campaigns. The user provides structured creative performance data and fatigue signals.

## Your Analysis Framework

### 1. CREATIVE FATIGUE DETECTION
- Compare metrics across time windows (7d vs 14d vs 30d vs last month)
- Flag creatives with declining CTR trends (even small declines over consecutive periods = early fatigue)
- Flag creatives with declining impression delivery (LinkedIn throttles fatigued ads)
- Identify the fatigue stage: early (slight CTR dip), mid (CTR + delivery decline), late (all metrics declining)
- For engagement campaigns: CTR and engagement rate are the primary fatigue indicators

### 2. CREATIVE PATTERN ANALYSIS
- Look at creative names for patterns in messaging/themes (headlines, descriptions, CTAs)
- Group creatives by naming patterns and compare aggregate performance
- Identify which messaging angles, themes, or formats are working vs not
- Note: creative names often encode the headline or theme (e.g., "Webinar-Q2-CTA-LearnMore")

### 3. PERFORMANCE BREAKDOWNS
For each creative, analyze:
- **CTR trend**: 7d vs 14d vs 30d — is it improving, stable, or declining?
- **Delivery trend**: impression volume changes — is LinkedIn delivering less?
- **Cost efficiency**: CPC trend across periods
- **Engagement quality**: clicks relative to impressions at different scales
- **Campaign-level variance**: same creative performing differently across campaigns?

### 4. ACTIONABLE RECOMMENDATIONS
Be SPECIFIC — reference exact creative names and campaigns:
- Which creatives to pause (fatigued beyond recovery)
- Which to keep running (still performing)
- Which patterns to double down on (create new variations of winners)
- What new creative angles to test based on what's working
- Budget shift suggestions between creatives/campaigns

### Output Format
Structure your analysis as:
1. **Executive Summary** (2-3 sentences: biggest finding + recommended action)
2. **Fatigue Report** (table or list: creative name, status, key metric trend)
3. **What's Working** (patterns/themes with strong performance)
4. **What's Not Working** (patterns/themes underperforming)
5. **Specific Actions** (numbered list: pause X, create variation of Y, shift budget from A to B)

Use specific numbers. Reference creative names. Be direct — no fluff.`,

  lead_gen_analysis: `You are a senior LinkedIn Ads lead generation specialist. The user provides structured data about their LEAD_GENERATION campaigns including form metadata, creative performance, and audience insights.

## Your Analysis Framework

### 1. CPL EFFICIENCY
- Compare CPL across forms, creatives, and time periods (7d vs 30d trend)
- Identify what drives cheap leads vs expensive leads
- Flag forms or creatives with rising CPL (fatigue signal)

### 2. FORM QUALITY AUDIT
For each form analyze:
- **Headline clarity**: Is the value proposition clear in 6 words or less?
- **Description persuasiveness**: Does it address a pain point or promise a specific outcome?
- **Field count**: Fewer fields = higher completion rate. >5 fields = friction risk
- **CTA alignment**: Does the ad CTA match the form offer? (e.g., "Download" CTA → gated content makes sense)
- **lgfRate (form fill rate)**: Low rate = form friction or targeting mismatch

### 3. CREATIVE PERFORMANCE
- Which ad creatives/CTAs (Download, Sign Up, Learn More, etc.) drive most leads at lowest CPL
- Identify creative themes/angles working for lead gen
- Flag creative fatigue (rising CPL trend, declining form open rate)

### 4. AUDIENCE FIT
- Which job functions and seniorities convert at lowest CPL
- Identify wasted spend on segments with high impressions + zero leads
- Recommend targeting focus based on top-converting segments

### 5. FATIGUE SIGNALS
- Rising CPL trend (7d CPL > 30d CPL by >20%) = creative or audience fatigue
- Low lgfRate (<20%) with high impressions = ad/form mismatch or landing page issue
- Declining formOpens with stable impressions = declining ad relevance

## Output Format
Structure as:
1. **Executive Summary** (3 sentences: biggest win, biggest problem, top action)
2. **CPL Performance Table** (form → CPL 30d | CPL 7d | trend arrow)
3. **Form Quality Audit** (each form: headline grade A/B/C/F, field count, CTA match, lgfRate)
4. **Creative Winners & Losers** (top 3 by CPL, bottom 3 by CPL)
5. **Audience Insights** (top 2 converting segments, 1 waste segment to cut)
6. **Specific Actions** (numbered, reference exact form/creative names)

Use real numbers. Be direct. No fluff.`,

  agentic: `You are a senior LinkedIn Ads strategist with direct access to real-time account data via tools.

You have tools to fetch:
- Creative performance metrics (multi-period: 7d, 14d, 30d, last month)
- Creative fatigue signals (CTR and delivery trends)
- Campaign-level analytics for any date range
- Demographic audience breakdowns
- Budget pacing and spend data

## Behavior
- Use tools when the user's question requires fresh or specific data you don't have yet
- If the initial context already contains the answer, respond directly without calling tools
- Call tools in parallel when fetching independent data (e.g., fatigue + performance together)
- After tool results, synthesize findings concisely — don't just repeat raw numbers
- Be specific: name exact creatives, campaigns, and metrics
- Format in markdown with headers and bullets

## When to use tools
- "What's happening with X creative right now?" → get_creative_performance
- "Which creatives are fatigued?" → get_creative_fatigue
- "How's our budget tracking?" → get_budget_pacing
- "Who's seeing our ads?" → get_demographic_breakdown
- "How did campaign Y perform last week?" → get_campaign_analytics`,
};

// ---------------------------------------------------------------------------
// Tool definitions for agentic mode
// ---------------------------------------------------------------------------

const agenticTools = [
  {
    name: "get_creative_performance",
    description: "Fetch multi-period creative performance (Last 7d, 14d, 30d, last month): spend, impressions, clicks, CTR, CPL, and trend per creative.",
    input_schema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "LinkedIn Ad Account ID" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_creative_fatigue",
    description: "Detect creative fatigue: compares last 7d vs prior 7d CTR and delivery. Returns fatigued/warning/healthy status with signals per creative.",
    input_schema: {
      type: "object",
      properties: {
        accountId:            { type: "string",  description: "LinkedIn Ad Account ID" },
        ctrDeclineThreshold:  { type: "number",  description: "CTR decline % threshold for warning (default 15)" },
        minImpressions:       { type: "number",  description: "Minimum impressions to include (default 500)" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_campaign_analytics",
    description: "Fetch campaign-level analytics (impressions, clicks, spend, conversions) for a date range.",
    input_schema: {
      type: "object",
      properties: {
        accountId:  { type: "string", description: "LinkedIn Ad Account ID" },
        startDate:  { type: "string", description: "Start date YYYY-MM-DD" },
        endDate:    { type: "string", description: "End date YYYY-MM-DD" },
        campaignIds: { type: "array", items: { type: "string" }, description: "Filter to specific campaign IDs (optional)" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_demographic_breakdown",
    description: "Fetch ad performance broken down by a demographic pivot: job function, seniority, country, or industry.",
    input_schema: {
      type: "object",
      properties: {
        accountId:  { type: "string", description: "LinkedIn Ad Account ID" },
        pivot:      { type: "string", enum: ["MEMBER_JOB_FUNCTION", "MEMBER_SENIORITY", "MEMBER_COUNTRY", "MEMBER_INDUSTRY"], description: "Demographic dimension" },
        startDate:  { type: "string", description: "Start date YYYY-MM-DD (default: 30d ago)" },
        endDate:    { type: "string", description: "End date YYYY-MM-DD (default: today)" },
        campaignIds: { type: "array", items: { type: "string" }, description: "Filter to specific campaigns (optional)" },
      },
      required: ["accountId", "pivot"],
    },
  },
  {
    name: "get_budget_pacing",
    description: "Fetch current month daily spend data and pacing status. Pass monthlyBudget to get on-track/underspend/overspend calculation.",
    input_schema: {
      type: "object",
      properties: {
        accountId:     { type: "string", description: "LinkedIn Ad Account ID" },
        monthlyBudget: { type: "number", description: "Monthly budget target in account currency (optional)" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_lead_gen_overview",
    description: "Fetch a comprehensive lead generation overview: form metadata (headline, description, fields, CTA), CPL by form and creative for 7d vs 30d, audience breakdown by job function and seniority, and campaign list.",
    input_schema: {
      type: "object",
      properties: {
        accountId:   { type: "string", description: "LinkedIn Ad Account ID" },
        campaignIds: { type: "array", items: { type: "string" }, description: "Filter to specific campaign IDs (optional)" },
      },
      required: ["accountId"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor: calls linkedin-api edge function internally
// ---------------------------------------------------------------------------

async function executeTool(toolName: string, input: Record<string, unknown>, accessToken: string): Promise<unknown> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env vars not configured");

  const actionMap: Record<string, string> = {
    get_creative_performance: "get_creative_performance_report",
    get_creative_fatigue:     "get_creative_fatigue",
    get_campaign_analytics:   "get_analytics",
    get_demographic_breakdown:"get_demographic_analytics",
    get_budget_pacing:        "get_budget_pacing",
    get_lead_gen_overview:    "get_lead_gen_overview",
  };

  const action = actionMap[toolName];
  if (!action) throw new Error(`Unknown tool: ${toolName}`);

  const { accountId, ...rest } = input;

  // Build params specific to each action
  let params: Record<string, unknown> = { accountId, ...rest };

  if (toolName === "get_creative_performance") {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    params = {
      accountId,
      dateRanges: [
        { key: "last7d",    start: fmt(new Date(now.getTime() - 7  * 86400000)), end: fmt(now) },
        { key: "last14d",   start: fmt(new Date(now.getTime() - 14 * 86400000)), end: fmt(now) },
        { key: "last30d",   start: fmt(new Date(now.getTime() - 30 * 86400000)), end: fmt(now) },
        { key: "lastMonth", start: fmt(lastMonthStart), end: fmt(lastMonthEnd) },
      ],
    };
  }

  if (toolName === "get_creative_fatigue") {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    params = {
      accountId,
      dateRange: {
        start: fmt(new Date(now.getTime() - 30 * 86400000)),
        end:   fmt(now),
      },
      thresholds: {
        ctrDecline:     (input.ctrDeclineThreshold as number) ?? 15,
        cplIncrease:    20,
        minImpressions: (input.minImpressions as number) ?? 500,
      },
    };
  }

  if (toolName === "get_campaign_analytics") {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    params = {
      accountId,
      startDate: input.startDate ?? fmt(new Date(now.getTime() - 30 * 86400000)),
      endDate:   input.endDate ?? fmt(now),
      ...(input.campaignIds ? { campaignIds: input.campaignIds } : {}),
    };
  }

  if (toolName === "get_demographic_breakdown") {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    params = {
      accountId,
      pivot:     input.pivot,
      startDate: input.startDate ?? fmt(new Date(now.getTime() - 30 * 86400000)),
      endDate:   input.endDate ?? fmt(now),
      ...(input.campaignIds ? { campaignIds: input.campaignIds } : {}),
    };
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/linkedin-api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, accessToken, params }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Tool ${toolName} failed (${resp.status}): ${err.slice(0, 200)}`);
  }

  return await resp.json();
}

// ---------------------------------------------------------------------------
// Agentic loop handler
// ---------------------------------------------------------------------------

async function handleAgentic(
  question: string,
  initialData: unknown,
  accountId: string,
  accessToken: string,
  apiKey: string,
): Promise<Response> {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const messages: Array<{ role: string; content: unknown }> = [
        {
          role: "user",
          content: question + (initialData
            ? `\n\n<context>\n${JSON.stringify(initialData, null, 2)}\n</context>`
            : ""),
        },
      ];

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: MODEL,
              system: systemPrompts.agentic,
              messages,
              tools: agenticTools,
              max_tokens: MAX_TOKENS,
            }),
          });

          if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Anthropic error ${resp.status}: ${err.slice(0, 300)}`);
          }

          const data = await resp.json();
          const toolUseBlocks = (data.content as any[]).filter((b: any) => b.type === "tool_use");
          const textBlocks    = (data.content as any[]).filter((b: any) => b.type === "text");

          // No more tool calls → stream the final text
          if (toolUseBlocks.length === 0 || data.stop_reason === "end_turn") {
            const text = textBlocks.map((b: any) => b.text).join("");
            // Emit in sentence-sized chunks for a streaming feel
            const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
            for (const chunk of sentences) {
              send({ choices: [{ delta: { content: chunk } }] });
            }
            break;
          }

          // Append assistant response to conversation
          messages.push({ role: "assistant", content: data.content });

          // Execute each tool call and collect results
          const toolResults: any[] = [];
          for (const block of toolUseBlocks) {
            // Notify frontend: tool is running
            send({ type: "tool_call", tool: block.name, id: block.id });

            try {
              const result = await executeTool(block.name, block.input as Record<string, unknown>, accessToken);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
              send({ type: "tool_result", tool: block.name, id: block.id, done: true });
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Error: ${msg}`,
                is_error: true,
              });
              send({ type: "tool_result", tool: block.name, id: block.id, done: true, error: true });
            }
          }

          messages.push({ role: "user", content: toolResults });
        }
      } catch (e) {
        console.error("[agentic] error:", e);
        send({ choices: [{ delta: { content: `\n\n_Error: ${e instanceof Error ? e.message : "Unknown"}_` } }] });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, data, reportType, mode, accountId, accessToken } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // ── Agentic mode ──────────────────────────────────────────────────────────
    if (mode === "agentic" && accountId && accessToken) {
      return handleAgentic(question, data ?? null, accountId, accessToken, ANTHROPIC_API_KEY);
    }

    // ── Standard streaming mode ───────────────────────────────────────────────
    const systemPrompt = systemPrompts[reportType || "creative_performance"] || systemPrompts.creative_performance;

    const userContent = `Report type: ${reportType || "creative_performance"}

Creative Performance Data:
${JSON.stringify(data, null, 2)}

Question: ${question}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        max_tokens: MAX_TOKENS,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid Anthropic API key." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate Anthropic SSE → OpenAI-compatible SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const evt = JSON.parse(jsonStr);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  const chunk = JSON.stringify({ choices: [{ delta: { content: evt.delta.text } }] });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }
              } catch { /* skip unparseable lines */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
