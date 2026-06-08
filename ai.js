function getConfig() {
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();
  if (provider === "openrouter") {
    return {
      provider,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      url: "https://openrouter.ai/api/v1/chat/completions"
    };
  }
  return {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    url: "https://api.openai.com/v1/chat/completions"
  };
}

function systemPrompt() {
  return `Você é um assistente de vendas para um vendedor de loja no Brasil.
Ajude com atendimento, objeções, WhatsApp, rotina e treino.
Linguagem brasileira, simples, natural e respeitosa.
Não invente promoções, preços, estoque, prazos ou condições da loja.
Não peça dados sensíveis. Ajude a vender com honestidade.
Responda em JSON válido quando possível.`;
}

function buildPrompt(mode, p) {
  if (mode === "quick") return `ATENDIMENTO RÁPIDO.
Tipo de cliente: ${p.clientType || ""}
Produto/interesse: ${p.product || ""}
Situação: ${p.situation || ""}
Responda em JSON:
{"opening":"frase inicial","questions":["pergunta 1","pergunta 2","pergunta 3"],"pitch":"argumento curto","objectionPrevention":"como evitar objeção","closing":"fechamento leve","avoid":["evitar 1","evitar 2"]}`;

  if (mode === "objection") return `QUEBRA DE OBJEÇÃO.
Cliente disse: ${p.objection || ""}
Produto/interesse: ${p.product || ""}
Contexto: ${p.context || ""}
Responda em JSON:
{"understanding":"frase para acolher","answers":[{"style":"calma","text":"resposta"},{"style":"comparação","text":"resposta"},{"style":"fechamento","text":"resposta"}],"questionBack":"pergunta de volta","nextStep":"próximo passo"}`;

  if (mode === "whatsapp") return `WHATSAPP.
Tipo: ${p.messageType || ""}
Cliente: ${p.client || ""}
Produto: ${p.product || ""}
Valor/condição: ${p.price || ""}
Observação: ${p.note || ""}
Responda em JSON:
{"message":"mensagem pronta","shortMessage":"versão curta","followUp":"mensagem se não responder"}`;

  if (mode === "routine") return `ROTINA DO VENDEDOR.
Hoje: ${p.date || ""}
Clientes interessados: ${JSON.stringify(p.leads || [])}
Contexto: ${p.context || ""}
Responda em JSON:
{"focus":"foco do dia","tasks":[{"title":"tarefa curta","note":"como fazer"}],"approachToTest":"abordagem para testar","productToStudy":"produto para estudar","whatsappAction":"ação de WhatsApp","smallGoal":"meta pequena"}`;

  if (mode === "training") return `TREINO DE VENDA.
Cenário: ${p.scenario || ""}
Responda em JSON:
{"clientProfile":"perfil provável","whatToAsk":["pergunta 1","pergunta 2"],"bestArgument":"argumento","badAnswer":"resposta ruim","goodAnswer":"resposta boa","closing":"fechamento","lesson":"aprendizado"}`;

  return `Responda em JSON útil para vendedor de loja. Dados: ${JSON.stringify(p || {})}`;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return { raw: text };
}

function fallbackData(mode, raw) {
  if (mode === "quick") return {
    opening: "Oi! Posso te ajudar a encontrar a melhor opção para o que você precisa?",
    questions: ["Você pretende usar para quê?", "Tem algum valor em mente?", "O que é mais importante: preço, durabilidade ou conforto?"],
    pitch: "Vamos achar uma opção que encaixe no seu uso e no seu orçamento.",
    objectionPrevention: "Antes de falar preço, entenda necessidade e prioridade.",
    closing: "Quer que eu te mostre duas opções para comparar?",
    avoid: ["Falar só preço", "Pressionar demais", "Prometer condição que não existe"]
  };
  return { raw: raw || "A IA respondeu fora do formato esperado." };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(200).json({ ok:false, error:"Use POST." });

  try {
    const cfg = getConfig();
    if (!cfg.apiKey || cfg.apiKey.includes("cole_sua_chave")) {
      return res.status(400).json({ ok:false, error:`Chave não configurada para ${cfg.provider}. Confira Environment Variables na Vercel.` });
    }

    const { mode, payload } = req.body || {};
    const headers = {
      "Authorization": `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    };

    if (cfg.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://bolso-six.vercel.app";
      headers["X-Title"] = "Vendedor de Bolso";
    }

    const response = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.75,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: buildPrompt(mode, payload || {}) }
        ]
      })
    });

    const text = await response.text();
    let body = {};
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    if (!response.ok) {
      const msg = body?.error?.message || body?.error || body?.message || text || `Erro HTTP ${response.status}`;
      return res.status(response.status).json({ ok:false, error:`Erro da IA: ${msg}`, provider:cfg.provider, model:cfg.model });
    }

    const content = body?.choices?.[0]?.message?.content || "";
    const data = parseJson(content);

    return res.status(200).json({
      ok: true,
      provider: cfg.provider,
      model: cfg.model,
      data: data.raw ? fallbackData(mode, data.raw) : data
    });
  } catch (err) {
    return res.status(500).json({ ok:false, error:`Erro técnico: ${err?.message || String(err)}` });
  }
}
