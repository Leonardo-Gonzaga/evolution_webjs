import { Client, LocalAuth } from 'whatsapp-web.js';
import { configService } from '../../config/env.config';
import { Logger } from '../../config/logger.config';
import { makeProxyAgent } from '../../utils/makeProxyAgent';

export class WhatsAppWebJSService {
  private readonly logger = new Logger(WhatsAppWebJSService.name);
  private instances: Map<string, Client> = new Map();
  private qrCodes: Map<string, { qr: string, count: number }> = new Map();
  private readonly config = configService.get('WHATSAPP_WEB_JS');

  /**
   * Cria uma nova instância do WhatsApp Web.js
   * @param instanceName Nome único da instância
   * @param proxyConfig Configuração de proxy opcional
   * @returns A instância criada
   */
  async createInstance(instanceName: string, proxyConfig?: string): Promise<Client> {
    if (this.instances.has(instanceName)) {
      this.logger.warn(`Instância ${instanceName} já existe`);
      return this.instances.get(instanceName);
    }

    try {
      const puppeteerOptions: any = {
        headless: this.config.HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      };

      // Adiciona configuração de proxy se fornecida
      const proxyUrl = proxyConfig || this.config.PROXY;
      if (proxyUrl) {
        this.logger.info(`Usando proxy para instância ${instanceName}: ${proxyUrl}`);
        puppeteerOptions.args.push(`--proxy-server=${proxyUrl}`);
      }

      // Cria a instância do cliente WhatsApp Web.js
      const client = new Client({
        authStrategy: new LocalAuth({ clientId: instanceName }),
        puppeteer: puppeteerOptions
      });

      // Configura os eventos da instância
      this.setupEvents(client, instanceName);

      // Inicia a instância
      await client.initialize();

      // Armazena a instância no mapa
      this.instances.set(instanceName, client);
      this.logger.info(`Instância ${instanceName} criada com sucesso`);

      return client;
    } catch (error) {
      this.logger.error(`Erro ao criar instância ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configura os eventos para a instância do WhatsApp Web.js
   * @param client Cliente WhatsApp Web.js
   * @param instanceName Nome da instância
   */
  private setupEvents(client: Client, instanceName: string): void {
    // Evento de QR Code
    client.on('qr', (qr) => {
      this.logger.info(`QR Code recebido para instância ${instanceName}`);
      
      // Armazena o QR Code e incrementa o contador
      const qrInfo = this.qrCodes.get(instanceName) || { qr: '', count: 0 };
      qrInfo.qr = qr;
      qrInfo.count += 1;
      this.qrCodes.set(instanceName, qrInfo);

      // Verifica se atingiu o limite de QR Codes
      const qrLimit = configService.get('QRCODE').LIMIT;
      if (qrInfo.count > qrLimit) {
        this.logger.warn(`Limite de QR Codes atingido para instância ${instanceName}`);
        this.deleteInstance(instanceName);
      }
    });

    // Evento de autenticação
    client.on('authenticated', () => {
      this.logger.info(`Instância ${instanceName} autenticada com sucesso`);
      // Limpa o QR Code após autenticação
      this.qrCodes.delete(instanceName);
    });

    // Evento de pronto
    client.on('ready', () => {
      this.logger.info(`Instância ${instanceName} está pronta`);
    });

    // Evento de desconexão
    client.on('disconnected', (reason) => {
      this.logger.warn(`Instância ${instanceName} desconectada: ${reason}`);
      this.deleteInstance(instanceName);
    });

    // Evento de mensagem recebida
    client.on('message', (message) => {
      this.logger.debug(`Mensagem recebida na instância ${instanceName}: ${message.body}`);
      // Aqui você pode implementar a lógica para processar mensagens recebidas
    });
  }

  /**
   * Obtém uma instância existente pelo nome
   * @param instanceName Nome da instância
   * @returns A instância ou undefined se não existir
   */
  getInstance(instanceName: string): Client | undefined {
    return this.instances.get(instanceName);
  }

  /**
   * Obtém o QR Code para uma instância
   * @param instanceName Nome da instância
   * @returns O QR Code ou null se não disponível
   */
  getQRCode(instanceName: string): string | null {
    const qrInfo = this.qrCodes.get(instanceName);
    return qrInfo ? qrInfo.qr : null;
  }

  /**
   * Deleta uma instância
   * @param instanceName Nome da instância
   * @returns true se a instância foi deletada, false caso contrário
   */
  async deleteInstance(instanceName: string): Promise<boolean> {
    const client = this.instances.get(instanceName);
    if (!client) {
      return false;
    }

    try {
      // Desconecta o cliente
      await client.destroy();
      
      // Remove do mapa de instâncias
      this.instances.delete(instanceName);
      
      // Remove do mapa de QR Codes
      this.qrCodes.delete(instanceName);
      
      this.logger.info(`Instância ${instanceName} deletada com sucesso`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao deletar instância ${instanceName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Envia uma mensagem de texto
   * @param instanceName Nome da instância
   * @param to Número de telefone de destino (formato: 5511999999999@c.us)
   * @param text Texto da mensagem
   * @returns Mensagem enviada ou null em caso de erro
   */
  async sendTextMessage(instanceName: string, to: string, text: string): Promise<any> {
    const client = this.instances.get(instanceName);
    if (!client) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }

    try {
      // Verifica se o número está no formato correto
      if (!to.includes('@c.us')) {
        to = `${to}@c.us`;
      }

      const message = await client.sendMessage(to, text);
      this.logger.debug(`Mensagem enviada pela instância ${instanceName} para ${to}`);
      return message;
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem pela instância ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista todos os grupos da instância
   * @param instanceName Nome da instância
   * @returns Lista de grupos
   */
  async listGroups(instanceName: string): Promise<any[]> {
    const client = this.instances.get(instanceName);
    if (!client) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }

    try {
      const chats = await client.getChats();
      const groups = chats.filter(chat => chat.isGroup);
      return groups;
    } catch (error) {
      this.logger.error(`Erro ao listar grupos da instância ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cria um novo grupo
   * @param instanceName Nome da instância
   * @param groupName Nome do grupo
   * @param participants Array de números de telefone dos participantes
   * @returns Informações do grupo criado
   */
  async createGroup(instanceName: string, groupName: string, participants: string[]): Promise<any> {
    const client = this.instances.get(instanceName);
    if (!client) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }

    try {
      // Formata os números dos participantes
      const formattedParticipants = participants.map(p => {
        if (!p.includes('@c.us')) {
          return `${p}@c.us`;
        }
        return p;
      });

      const group = await client.createGroup(groupName, formattedParticipants);
      this.logger.info(`Grupo ${groupName} criado pela instância ${instanceName}`);
      return group;
    } catch (error) {
      this.logger.error(`Erro ao criar grupo pela instância ${instanceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém todas as instâncias ativas
   * @returns Mapa de instâncias
   */
  getAllInstances(): Map<string, Client> {
    return this.instances;
  }
}

// Exporta uma instância singleton do serviço
export const whatsappWebJSService = new WhatsAppWebJSService();