import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, data, reportType } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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
    };

    const systemPrompt = systemPrompts[reportType || 'creative_performance'] || systemPrompts.creative_performance;

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
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 4096,
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
