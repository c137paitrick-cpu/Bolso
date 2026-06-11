function getConfig(){
 const provider=(process.env.AI_PROVIDER||"openrouter").toLowerCase();
 if(provider==="openrouter")return{provider,apiKey:process.env.OPENROUTER_API_KEY,model:process.env.OPENROUTER_MODEL||"openrouter/free",url:"https://openrouter.ai/api/v1/chat/completions"};
 return{provider:"openai",apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||"gpt-4.1-mini",url:"https://api.openai.com/v1/chat/completions"};
}
function systemPrompt(){return `Você é o Vendedor de Bolso para vendedor de loja no Brasil.
Responda curto, natural e prático. Não use CRM, lead, pipeline, prospect.
Não invente preço, estoque, promoção, prazo ou condição.
APONTE: A Aborde positivamente; P Pesquise o cliente; O Ofereça benefícios; N Neutralize objeções; T Feche a venda; E Estenda relacionamento.
Responda em JSON válido.`}
function prompt(mode,p){
 if(mode==="improve")return `Melhore esse texto para vendedor de loja. Seja curto, natural e útil.
Contexto: ${p.context||""}
Texto:
${p.text||""}
Responda JSON: {"text":"texto melhorado"}`;
 if(mode==="whatsapp")return `Crie WhatsApp curto.
Tipo: ${p.type||""}
Cliente: ${p.client||""}
Produto: ${p.product||""}
Valor: ${p.price||""}
Obs: ${p.note||""}
JSON: {"message":"mensagem","followUp":"se não responder"}`;
 if(mode==="routine")return `Rotina vendedor. Clientes: ${JSON.stringify(p.leads||[])} Avisos: ${JSON.stringify(p.alerts||[])} Contexto:${p.context||""}
JSON: {"focus":"foco","tasks":["4 tarefas"],"clientsToCall":["clientes"],"approach":"abordagem","study":"estudar","messageOfDay":"mensagem"}`;
 return `JSON útil para loja: ${JSON.stringify(p||{})}`;
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
  const r=await fetch(cfg.url,{method:"POST",headers,body:JSON.stringify({model:cfg.model,temperature:.6,messages:[{role:"system",content:systemPrompt()},{role:"user",content:prompt(mode,payload||{})}]})});
  const text=await r.text(); let body={}; try{body=JSON.parse(text)}catch{body={raw:text}}
  if(!r.ok){const msg=body?.error?.message||body?.error||body?.message||text;return res.status(r.status).json({ok:false,error:`Erro da IA: ${msg}`})}
  return res.status(200).json({ok:true,data:parseJson(body?.choices?.[0]?.message?.content||"{}")});
 }catch(e){return res.status(500).json({ok:false,error:`Erro técnico: ${e.message||e}`})}
}