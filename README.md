# Vendedor de Bolso Mobile V1

App mobile para ajudar em atendimento de loja, objeções, WhatsApp, rotina e controle simples de clientes interessados.

## Como funciona

- O app fica online.
- A IA roda pela API no servidor da Vercel.
- Os dados ficam salvos no navegador do celular.
- Tem exportar/importar backup para trocar de celular.

## Como colocar online na Vercel

1. Crie uma conta em https://vercel.com
2. Envie/importe este projeto na Vercel.
3. Em `Settings > Environment Variables`, cadastre:

Para OpenRouter:
```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sua_chave_openrouter
OPENROUTER_MODEL=openrouter/free
```

Para OpenAI:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sua_chave_openai
OPENAI_MODEL=gpt-4.1-mini
```

4. Faça o deploy.
5. Abra o link no celular.
6. No navegador do celular, use "Adicionar à tela inicial".

## Abas

- Hoje
- Atendimento
- Objeções
- WhatsApp
- Interessados
- Treino
- Backup

## Cuidados

Não salve CPF, endereço, cartão, dados bancários ou informações sensíveis do cliente.
Use só nome/apelido, produto de interesse, valor, status e observações simples.
