# Implementação do WhatsApp Web.js na Evolution API

Este documento descreve como utilizar a implementação do WhatsApp Web.js na Evolution API, que permite gerenciar múltiplas instâncias do WhatsApp com suporte a proxies e autenticação persistente.

## Configuração

As seguintes variáveis de ambiente estão disponíveis para configurar o WhatsApp Web.js:

```
# WhatsApp Web.js configuration
WHATSAPP_WEB_JS_HEADLESS=true
WHATSAPP_WEB_JS_PROXY=
```

- `WHATSAPP_WEB_JS_HEADLESS`: Define se o navegador será executado em modo headless (sem interface gráfica). O valor padrão é `true`.
- `WHATSAPP_WEB_JS_PROXY`: Define um proxy para todas as instâncias. Você também pode definir um proxy específico para cada instância ao criá-la.

## Endpoints da API

Todos os endpoints estão disponíveis na rota base `/whatsapp-webjs` e requerem autenticação via API Key.

### Gerenciamento de Instâncias

#### Criar uma nova instância

```
POST /whatsapp-webjs/instance
```

Corpo da requisição:
```json
{
  "instanceName": "instance01",
  "proxy": "http://proxy.example.com:8080" // Opcional
}
```

Resposta:
```json
{
  "status": true,
  "message": "Instância instance01 criada com sucesso",
  "instance": {
    "instanceName": "instance01"
  }
}
```

#### Listar todas as instâncias

```
GET /whatsapp-webjs/instances
```

Resposta:
```json
{
  "status": true,
  "instances": [
    {
      "instanceName": "instance01",
      "connected": true
    }
  ]
}
```

#### Deletar uma instância

```
DELETE /whatsapp-webjs/instance/:instanceName
```

Resposta:
```json
{
  "status": true,
  "message": "Instância instance01 deletada com sucesso"
}
```

### QR Code

#### Obter QR Code para autenticação

```
GET /whatsapp-webjs/instance/:instanceName/qrcode
```

Resposta:
```json
{
  "status": true,
  "qrcode": "data:image/png;base64,..."
}
```

### Mensagens

#### Enviar mensagem de texto

```
POST /whatsapp-webjs/instance/:instanceName/send-message
```

Corpo da requisição:
```json
{
  "to": "5511999999999", // Número de telefone com código do país
  "text": "Olá, esta é uma mensagem de teste!"
}
```

Resposta:
```json
{
  "status": true,
  "message": "Mensagem enviada com sucesso",
  "data": {
    "id": {
      "fromMe": true,
      "remote": "5511999999999@c.us",
      "id": "3EB0XXXX",
      "_serialized": "true_5511999999999@c.us_3EB0XXXX"
    },
    "body": "Olá, esta é uma mensagem de teste!",
    "type": "chat",
    "timestamp": 1621500000
  }
}
```

### Grupos

#### Listar grupos

```
GET /whatsapp-webjs/instance/:instanceName/groups
```

Resposta:
```json
{
  "status": true,
  "groups": [
    {
      "id": {
        "server": "g.us",
        "user": "5511999999999-1621500000",
        "_serialized": "5511999999999-1621500000@g.us"
      },
      "name": "Grupo de Teste",
      "isGroup": true,
      "participants": [...]
    }
  ]
}
```

#### Criar um grupo

```
POST /whatsapp-webjs/instance/:instanceName/group
```

Corpo da requisição:
```json
{
  "groupName": "Novo Grupo",
  "participants": ["5511999999999", "5511888888888"]
}
```

Resposta:
```json
{
  "status": true,
  "message": "Grupo criado com sucesso",
  "group": {
    "id": {
      "server": "g.us",
      "user": "5511999999999-1621500000",
      "_serialized": "5511999999999-1621500000@g.us"
    },
    "name": "Novo Grupo"
  }
}
```

## Fluxo de Uso Típico

1. Crie uma nova instância do WhatsApp Web.js
2. Obtenha o QR Code para autenticação
3. Escaneie o QR Code com o WhatsApp do seu celular
4. Após a autenticação, você pode enviar mensagens, listar e criar grupos

## Considerações Importantes

- Cada instância do WhatsApp Web.js consome recursos significativos, pois executa um navegador Chromium em segundo plano.
- As sessões são persistidas localmente usando a estratégia LocalAuth, o que permite reconexões sem precisar escanear o QR Code novamente.
- O uso de proxies pode ajudar a evitar bloqueios por parte do WhatsApp.
- Esta implementação é não oficial e pode estar sujeita a bloqueios pelo WhatsApp. Use com responsabilidade e considere a API oficial do WhatsApp Business para ambientes de produção.

## Dependências

- whatsapp-web.js: ^1.27.0
- puppeteer: ^22.0.0 (instalado automaticamente como dependência do whatsapp-web.js)