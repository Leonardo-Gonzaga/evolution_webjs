# Plano de Implementação do whatsapp-web.js no Evolution API

## Visão Geral

Este documento descreve os passos necessários para implementar a biblioteca whatsapp-web.js como um novo provedor de conexão no Evolution API, complementando as opções existentes (Baileys e WhatsApp Business API).

## Pré-requisitos

1. Instalar a biblioteca whatsapp-web.js:
   ```bash
   npm install whatsapp-web.js
   ```

2. Instalar dependências adicionais que o whatsapp-web.js possa precisar:
   ```bash
   npm install puppeteer
   ```

## Passos de Implementação

### 1. Atualizar Tipos e Enumerações

Adicionar o novo tipo de integração em `src/api/types/wa.types.ts`:

```typescript
export const Integration = {
  WHATSAPP_BUSINESS: 'WHATSAPP-BUSINESS',
  WHATSAPP_BAILEYS: 'WHATSAPP-BAILEYS',
  EVOLUTION: 'EVOLUTION',
  WHATSAPP_WEB_JS: 'WHATSAPP-WEB-JS', // Nova integração
};
```

### 2. Criar Serviço de Inicialização para whatsapp-web.js

Criar um novo arquivo em `src/api/integrations/channel/whatsapp/whatsapp.webjs.service.ts` que estenda a classe `ChannelStartupService` e implemente a lógica de conexão usando whatsapp-web.js.

### 3. Criar Controlador para whatsapp-web.js

Criar um novo arquivo em `src/api/integrations/channel/whatsapp/webjs.controller.ts` que implemente os endpoints específicos para a biblioteca whatsapp-web.js.

### 4. Criar Router para whatsapp-web.js

Criar um novo arquivo em `src/api/integrations/channel/whatsapp/webjs.router.ts` que defina as rotas específicas para a biblioteca whatsapp-web.js.

### 5. Atualizar o Router de Canais

Modificar o arquivo `src/api/integrations/channel/channel.router.ts` para incluir o novo router:

```typescript
import { Router } from 'express';

import { EvolutionRouter } from './evolution/evolution.router';
import { MetaRouter } from './meta/meta.router';
import { BaileysRouter } from './whatsapp/baileys.router';
import { WebJSRouter } from './whatsapp/webjs.router';

export class ChannelRouter {
  public readonly router: Router;

  constructor(configService: any, ...guards: any[]) {
    this.router = Router();

    this.router.use('/', new EvolutionRouter(configService).router);
    this.router.use('/', new MetaRouter(configService).router);
    this.router.use('/baileys', new BaileysRouter(...guards).router);
    this.router.use('/webjs', new WebJSRouter(...guards).router);
  }
}
```

### 6. Atualizar o Controlador de Canais

Modificar o arquivo `src/api/integrations/channel/channel.controller.ts` para incluir o novo serviço:

```typescript
// Adicionar importação
import { WebJSStartupService } from './whatsapp/whatsapp.webjs.service';

// Na função init, adicionar:
if (instanceData.integration === Integration.WHATSAPP_WEB_JS) {
  return new WebJSStartupService(
    data.configService,
    data.eventEmitter,
    this.prismaRepository,
    data.chatwootCache,
    data.cache,
    data.baileysCache,
    data.providerFiles
  );
}
```

### 7. Atualizar o Arquivo .env.example

Adicionar configurações específicas para whatsapp-web.js no arquivo `.env.example`:

```
# WhatsApp Web.js configuration
WHATSAPP_WEB_JS_HEADLESS=true
WHATSAPP_WEB_JS_PROXY=
```

### 8. Atualizar o Serviço de Configuração

Modificar o arquivo `src/config/env.config.ts` para incluir as novas configurações:

```typescript
export type WhatsAppWebJS = {
  HEADLESS: boolean;
  PROXY: string;
};

// Na interface Env, adicionar:
WHATSAPP_WEB_JS: WhatsAppWebJS;

// No método envProcess, adicionar:
WHATSAPP_WEB_JS: {
  HEADLESS: process.env?.WHATSAPP_WEB_JS_HEADLESS === 'true',
  PROXY: process.env?.WHATSAPP_WEB_JS_PROXY || '',
},
```

## Implementação do Serviço whatsapp-web.js

O serviço `WebJSStartupService` deve implementar as seguintes funcionalidades principais:

1. Inicialização e autenticação do cliente whatsapp-web.js
2. Gerenciamento de QR Code para autenticação
3. Mapeamento de eventos do whatsapp-web.js para o formato do Evolution API
4. Implementação de métodos para envio de mensagens e outras operações

## Considerações Adicionais

1. **Gerenciamento de Sessão**: Implementar mecanismo para salvar e restaurar sessões do whatsapp-web.js
2. **Tratamento de Eventos**: Mapear todos os eventos do whatsapp-web.js para o sistema de eventos do Evolution API
3. **Compatibilidade de API**: Garantir que a API exposta seja compatível com as outras integrações
4. **Documentação**: Atualizar a documentação para incluir informações sobre a nova integração

## Testes

1. Teste de autenticação e conexão
2. Teste de envio e recebimento de mensagens
3. Teste de funcionalidades específicas do whatsapp-web.js
4. Teste de integração com outros sistemas (Chatwoot, Typebot, etc.)

## Próximos Passos

Após a implementação básica, considerar:

1. Otimizações de desempenho
2. Recursos adicionais específicos do whatsapp-web.js
3. Melhorias na interface de usuário para configuração