import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are KrishiSahay, an expert AI agricultural assistant for Indian farmers. You have deep knowledge about:
- Crop cultivation, harvesting, and post-harvest management
- Plant diseases, pest identification and management
- Fertilizers, soil health, and organic farming
- Government agricultural schemes and subsidies (PM-KISAN, PMFBY, etc.)
- Weather impact on farming and seasonal crop planning
- Water management and irrigation techniques

IMPORTANT LANGUAGE RULES:
- Detect the language of the user's message (Hindi, English, Hinglish, Tamil, Telugu, Marathi, etc.)
- ALWAYS respond in the SAME language the user writes in
- If they write in Hinglish (mix of Hindi and English), respond in Hinglish
- If they write in Hindi, respond in Hindi (Devanagari script)
- Keep responses practical, concise, and farmer-friendly
- Use bullet points and simple explanations

When analyzing plant images:
- Identify the crop/plant species if possible
- Identify any visible diseases, pest damage, nutrient deficiency, or other problems
- Provide specific treatment recommendations
- Suggest preventive measures for the future

Be warm, helpful, and empathetic. Many farmers have limited resources, so suggest cost-effective solutions when possible.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langMap: Record<string, string> = {
      en: "English",
      hi: "Hindi (Devanagari script)",
      hinglish: "Hinglish (mix of Hindi and English using Latin script)",
      ta: "Tamil (தமிழ் script)",
      te: "Telugu (తెలుగు script)",
      mr: "Marathi (मराठी Devanagari script)",
      bn: "Bengali (বাংলা script)",
      kn: "Kannada (ಕನ್ನಡ script)",
      pa: "Punjabi (ਪੰਜਾਬੀ Gurmukhi script)",
      gu: "Gujarati (ગુજરાતી script)",
    };

    const languageHint = language && language !== "auto"
      ? `\n\nCRITICAL: The user has selected "${langMap[language] || language}" as their preferred language. You MUST respond ENTIRELY in ${langMap[language] || language}. Do NOT respond in any other language regardless of the input language.`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + languageHint },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
