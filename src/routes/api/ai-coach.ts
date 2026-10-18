import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { GoogleGenAI } from "@google/genai";

export const Route = createAPIFileRoute("/api/ai-coach")({
  POST: async ({ request }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return json({ error: "GEMINI_API_KEY is not configured in Vercel." }, { status: 500 });
      }

      const body = await request.json();
      const userMessage = body.message || "";
      const deskContext = body.context || "";

      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `
You are an expert, highly intelligent JEE mentor, strategist, and academic coach. 
The student is tracking their JEE preparation using a personal dashboard. 
Student's live dashboard data:
${deskContext}

Guidelines:
1. Provide concise, grounded, realistic, and high-impact study advice tailored specifically to what the student asks.
2. If they ask about concepts (Physics, Chemistry, Maths), explain them clearly using precise formulas and problem-solving intuition.
3. If they feel unmotivated, overwhelmed, or behind schedule, give clear micro-targets rather than generic lectures.
4. Keep answers focused, practical, engaging, and conversational. Never repeat canned or fixed responses.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return json({ reply: response.text });
    } catch (err: any) {
      return json({ error: err.message || "Failed to generate AI response." }, { status: 500 });
    }
  },
});
