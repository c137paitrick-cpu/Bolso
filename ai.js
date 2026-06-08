function getConfig(){
 const provider=(process.env.AI_PROVIDER||"openrouter").toLowerCase();
 if(provider==="openrouter")return{provider,apiKey:process.env.OPENROUTER_API_KEY,model:process.env.OPENROUTER_MODEL||"openrouter/free",url:"https://openrouter.ai/api/v1/chat/completions"};
 return{provider:"openai",apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||"gpt-4.1-mini",url:"https://api.openai.com/v1/chat/completions"};
}
function systemPrompt(){return `Você é o Vendedor de Bolso para vendedor de loja no Brasil.
Responda curto, natural e prático. Não use CRM, lead, pipeline, prospect.
Use linguagem de loja. Não invente preço, estoque, promoção, prazo ou condição.
Técnica APONTE:
A = Aborde positivamente.
P = Pesquise o cliente.
O = Ofereça benefícios, ex: este forno esquenta mais, este sofá é mais confortável.
N = Neutralize objeções.
T = Feche a venda.
E = Estenda o relacionamento, pegue WhatsApp, acompanhe até a porta, mantenha contato.
Não peça dados sensíveis. Responda em JSON válido.`}
function prompt(mode,p){
 if(mode==="aponte")return `Etapa APONTE: ${p.step}
Produto: ${p.product||""}
Cliente: ${p.clientType||""}
Gere JSON curto:
{"title":"etapa","say":["3 frases curtas para falar"],"ask":["2 perguntas rápidas"],"next":"próximo passo"}`;
 if(mode==="objection")return `Objeção: ${p.objection}
Produto: ${p.product||""}
Gere JSON curto:
{"main":"resposta principal curta","options":["2 alternativas curtas"],"question":"pergunta para continuar","close":"fechamento leve"}`;
 if(mode==="whatsapp")return `WhatsApp.
Tipo: ${p.type}
Cliente: ${p.client||""}
Produto: ${p.product||""}
Valor/condição: ${p.price||""}
Observação: ${p.note||""}
Gere JSON:
{"message":"mensagem pronta curta","followUp":"mensagem se não responder"}`;
 if(mode==="pipe")return `Ajuda com conexão de cano.
Situação: ${p.situation||""}
Medida/cano: ${p.measure||""}
Objetivo: ${p.goal||""}
Gere JSON:
{"askCustomer":["perguntas para o cliente"],"likelyParts":["peças prováveis"],"warning":"cuidado importante","simpleExplanation":"explicação simples"}`;
 if(mode==="routine")return `Rotina vendedor.
Clientes: ${JSON.stringify(p.leads||[])}
Avisos: ${JSON.stringify(p.alerts||[])}
Contexto: ${p.context||""}
Gere JSON curto:
{"focus":"foco do dia","tasks":["4 tarefas práticas"],"clientsToCall":["clientes para chamar"],"approach":"abordagem do dia","study":"produto/argumento para estudar","messageOfDay":"mensagem curta"}`;
 return `Gere JSON útil para loja. Dados: ${JSON.stringify(p||{})}`;
}
function parseJson(text){try{return JSON.parse(text)}catch{} const s=text.indexOf("{"),e=text.lastIndexOf("}"); if(s>=0&&e>s){try{return JSON.parse(text.slice(s,e+1))}catch{}} return{raw:text}}
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Content-Type");
 if(req.method==="OPTIONS")return res.status(200).end();
 if(req.method!=="POST")return res.status(200).json({ok:false,error:"Use POST."});
 try{
  const cfg=getConfig();
  if(!cfg.apiKey||cfg.apiKey.includes("sua_chave"))return res.status(400).json({ok:false,error:"Chave da IA não configurada."});
  const {mode,payload}=req.body||{};
  const headers={"Authorization":`Bearer ${String(cfg.apiKey).trim()}`,"Content-Type":"application/json"};
  if(cfg.provider==="openrouter"){headers["HTTP-Referer"]="https://bolso-six.vercel.app";headers["X-Title"]="Vendedor de Bolso";}
  const r=await fetch(cfg.url,{method:"POST",headers,body:JSON.stringify({model:cfg.model,temperature:.62,messages:[{role:"system",content:systemPrompt()},{role:"user",content:prompt(mode,payload||{})}]})});
  const text=await r.text(); let body={}; try{body=JSON.parse(text)}catch{body={raw:text}}
  if(!r.ok){const msg=body?.error?.message||body?.error||body?.message||text;return res.status(r.status).json({ok:false,error:`Erro da IA: ${msg}`})}
  const content=body?.choices?.[0]?.message?.content||"";
  return res.status(200).json({ok:true,data:parseJson(content)});
 }catch(e){return res.status(500).json({ok:false,error:`Erro técnico: ${e.message||e}`})}
}