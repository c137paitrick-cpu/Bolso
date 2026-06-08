import OpenAI from "openai";

function getConfig() {
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();

  if (provider === "openrouter") {
    return {
      provider,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      baseURL: "https://openrouter.ai/api/v1"
    };
  }

  return {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    baseURL: undefined
  };
}

function makeClient() {
  const cfg = getConfig();
  const options = { apiKey: cfg.apiKey };

  if (cfg.baseURL) {
    options.baseURL = cfg.baseURL;
    options.defaultHeaders = {
      "HTTP-Referer": "https://vendedor-de-bolso.vercel.app",
      "X-Title": "Vendedor de Bolso Mobile"
    };
  }

  return new OpenAI(options);
}

function systemPrompt() {
  return `
Você é um assistente de vendas para um vendedor de loja no Brasil.

Objetivo:
- Ajudar no atendimento de clientes.
- Dar respostas naturais para objeções.
- Criar mensagens curtas para WhatsApp.
- Ajudar o vendedor a conduzir a venda sem ser forçado.

Contexto:
- O usuário trabalha como vendedor em loja.
- Ele precisa de respostas rápidas no celular.
- Linguagem brasileira, simples, natural e respeitosa.
- Foco em escutar o cliente, entender necessidade, apresentar valor e fechar com educação.

Regras:
- Responda sempre em JSON válido.
- Não invente promoções, preços, estoque, prazos ou condições da loja.
- Se faltar informação, sugira perguntar ao cliente.
- Não peça dados sensíveis.
- Não use manipulação pesada.
- Ajude a vender com honestidade.
`;
}

function buildPrompt(mode, p) {
  if (mode === "quick") {
    return `
Modo: ATENDIMENTO RÁPIDO.

Tipo de cliente: ${p.clientType || ""}
Produto/interesse: ${p.product || ""}
Situação: ${p.situation || ""}

Gere JSON:
{
  "opening": "frase inicial para abordar",
  "questions": ["3 perguntas boas para descobrir necessidade"],
  "pitch": "argumento curto sem forçar",
  "objectionPrevention": "como evitar a objeção antes dela aparecer",
  "closing": "fechamento leve",
  "avoid": ["o que evitar falar"]
}
`;
  }

  if (mode === "objection") {
    return `
Modo: QUEBRA DE OBJEÇÃO.

Cliente disse:
${p.objection || ""}

Produto/interesse: ${p.product || ""}
Contexto: ${p.context || ""}

Gere JSON:
{
  "understanding": "frase para acolher a objeção",
  "answers": [
    {"style":"calma", "text":"resposta natural"},
    {"style":"comparação", "text":"resposta natural"},
    {"style":"fechamento", "text":"resposta natural"}
  ],
  "questionBack": "pergunta para entender melhor",
  "nextStep": "próximo passo sugerido"
}
`;
  }

  if (mode === "whatsapp") {
    return `
Modo: MENSAGEM DE WHATSAPP.

Tipo de mensagem: ${p.messageType || ""}
Cliente: ${p.client || ""}
Produto: ${p.product || ""}
Valor/condição: ${p.price || ""}
Observação: ${p.note || ""}

Gere JSON:
{
  "message": "mensagem pronta para WhatsApp",
  "shortMessage": "versão mais curta",
  "followUp": "mensagem para mandar depois se a pessoa não responder"
}

Regras:
- Natural e curta.
- Não invente promoção.
- Não pressione demais.
`;
  }

  if (mode === "routine") {
    return `
Modo: ROTINA DO VENDEDOR.

Hoje: ${p.date || ""}
Clientes interessados:
${JSON.stringify(p.leads || [], null, 2)}

Contexto do dia:
${p.context || ""}

Gere JSON:
{
  "focus": "foco do dia",
  "tasks": [
    {"title":"tarefa curta", "note":"como fazer"}
  ],
  "approachToTest": "abordagem para testar hoje",
  "productToStudy": "produto ou tipo de produto para estudar",
  "whatsappAction": "ação simples de WhatsApp",
  "smallGoal": "meta pequena e realista do dia"
}

Gere de 4 a 6 tarefas.
`;
  }

  if (mode === "training") {
    return `
Modo: TREINO DE VENDA.

Cenário:
${p.scenario || ""}

Gere JSON:
{
  "clientProfile": "perfil provável do cliente",
  "whatToAsk": ["perguntas para fazer"],
  "bestArgument": "melhor argumento",
  "badAnswer": "resposta ruim que deve evitar",
  "goodAnswer": "resposta boa",
  "closing": "fechamento leve",
  "lesson": "aprendizado do treino"
}
`;
  }

  return `
Modo genérico.
Dados:
${JSON.stringify(p, null, 2)}
Gere JSON útil para vendedor de loja.
`;
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  try {
    const cfg = getConfig();

    if (!cfg.apiKey || cfg.apiKey.includes("cole_sua_chave")) {
      return res.status(400).json({ error: `Chave não configurada para ${cfg.provider}.` });
    }

    const { mode, payload } = req.body || {};
    const client = makeClient();

    const response = await client.chat.completions.create({
      model: cfg.model,
      temperature: 0.75,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: buildPrompt(mode, payload || {}) }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.choices?.[0]?.message?.content || "{}";
    const data = parseJson(text);

    return res.status(200).json({
      ok: true,
      provider: cfg.provider,
      model: cfg.model,
      data
    });
  } catch (err) {
    const status = err?.status || 500;
    let friendly = err?.message || "Erro desconhecido.";
    if (status === 401) friendly = "Chave API inválida.";
    if (status === 402) friendly = "Sem crédito/billing no provedor.";
    if (status === 429) friendly = "Limite da API atingido. Tente mais tarde.";
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: friendly,
      detail: err?.message || String(err)
    });
  }
}
