import { InstanceDto } from '@api/dto/instance.dto';
import { SendAudioDto, SendButtonsDto, SendMediaDto, SendPtvDto, SendTextDto } from '@api/dto/sendMessage.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { CacheService } from '@api/services/cache.service';
import { ChannelStartupService } from '@api/services/channel.service';
import { Events, Integration, wa } from '@api/types/wa.types';
import { Chatwoot, ConfigService, Database, Openai, S3 } from '@config/env.config';
import { BadRequestException, NotFoundException } from '@exceptions';
import { Logger } from '@config/logger.config';
import { ProviderFiles } from '@api/provider/sessions';
import { isBase64, isURL } from 'class-validator';
import EventEmitter2 from 'eventemitter2';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import * as s3Service from '@api/integrations/storage/s3/libs/minio.server';

/**
 * Serviço de inicialização para o canal WhatsApp Web.js
 * Esta classe implementa a integração com a biblioteca whatsapp-web.js
 */
export class WebJSStartupService extends ChannelStartupService {
  constructor(
    public readonly configService: ConfigService,
    public readonly eventEmitter: EventEmitter2,
    public readonly prismaRepository: PrismaRepository,
    public readonly chatwootCache: CacheService,
    public readonly cache: CacheService,
    public readonly baileysCache: CacheService,
    private readonly providerFiles: ProviderFiles,
  ) {
    super(configService, eventEmitter, prismaRepository, chatwootCache);
    this.logger = new Logger('WebJSStartupService');
  }

  private logger: Logger;
  public client: Client;
  public stateConnection: wa.StateConnection = { state: 'close' };

  /**
   * Retorna o status atual da conexão
   */
  public get connectionStatus() {
    return this.stateConnection;
  }

  /**
   * Inicializa o cliente WhatsApp Web.js e configura os listeners de eventos
   */
  public async connectToWhatsapp(number?: string): Promise<Client> {
    try {
      this.logger.info('Iniciando conexão com WhatsApp Web.js...');
      
      // Configuração do cliente WhatsApp Web.js
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: this.instance.name }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Configurar eventos
      this.configureClientEvents();
      
      // Iniciar o cliente
      await this.client.initialize();
      
      return this.client;
    } catch (error) {
      this.logger.error(`Erro ao conectar com WhatsApp Web.js: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configura os listeners de eventos do cliente WhatsApp Web.js
   */
  private configureClientEvents() {
    // Evento de QR Code
    this.client.on('qr', async (qr) => {
      try {
        // Gerar QR Code como base64
        const qrBase64 = await qrcode.toDataURL(qr);
        
        // Atualizar QR Code na instância
        if (!this.instance.qrcode) {
          this.instance.qrcode = {
            count: 0,
            base64: qrBase64,
            code: qr
          };
        } else {
          this.instance.qrcode.count += 1;
          this.instance.qrcode.base64 = qrBase64;
          this.instance.qrcode.code = qr;
        }

        // Enviar evento de QR Code atualizado
        this.sendDataWebhook(Events.QRCODE_UPDATED, {
          qrcode: {
            base64: qrBase64,
            code: qr
          },
        });

        // Enviar evento para Chatwoot se estiver habilitado
        if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled) {
          this.chatwootService.eventWhatsapp(
            Events.QRCODE_UPDATED,
            { instanceName: this.instance.name },
            {
              qrcode: qrBase64,
            },
          );
        }

        this.logger.info(`QR Code gerado para instância ${this.instance.name}`);
      } catch (error) {
        this.logger.error(`Erro ao processar QR Code: ${error.message}`);
      }
    });

    // Evento de autenticação
    this.client.on('authenticated', () => {
      this.logger.info(`Instância ${this.instance.name} autenticada com sucesso`);
    });

    // Evento de falha de autenticação
    this.client.on('auth_failure', (error) => {
      this.logger.error(`Falha na autenticação da instância ${this.instance.name}: ${error.message}`);
      this.stateConnection = { state: 'close' };
      
      this.sendDataWebhook(Events.CONNECTION_UPDATE, {
        instance: this.instance.name,
        state: 'close',
        statusReason: 401, // Código para falha de autenticação
      });
    });

    // Evento de pronto (conexão estabelecida)
    this.client.on('ready', () => {
      this.stateConnection = { state: 'open' };
      this.logger.info(`Instância ${this.instance.name} conectada e pronta`);
      
      // Atualizar status da conexão
      this.sendDataWebhook(Events.CONNECTION_UPDATE, {
        instance: this.instance.name,
        state: 'open',
      });

      // Enviar evento para Chatwoot se estiver habilitado
      if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled) {
        this.chatwootService.eventWhatsapp(
          Events.CONNECTION_UPDATE,
          { instanceName: this.instance.name },
          {
            instance: this.instance.name,
            status: 'open',
          },
        );
      }
    });

    // Evento de desconexão
    this.client.on('disconnected', (reason) => {
      this.stateConnection = { state: 'close' };
      this.logger.warn(`Instância ${this.instance.name} desconectada: ${reason}`);
      
      this.sendDataWebhook(Events.CONNECTION_UPDATE, {
        instance: this.instance.name,
        state: 'close',
        statusReason: 0, // Código genérico para desconexão
      });

      // Enviar evento para Chatwoot se estiver habilitado
      if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled) {
        this.chatwootService.eventWhatsapp(
          Events.CONNECTION_UPDATE,
          { instanceName: this.instance.name },
          {
            instance: this.instance.name,
            status: 'close',
          },
        );
      }
    });

    // Evento de mensagem recebida
    this.client.on('message', async (message) => {
      try {
        // Processar mensagem recebida
        await this.processIncomingMessage(message);
      } catch (error) {
        this.logger.error(`Erro ao processar mensagem: ${error.message}`);
      }
    });
  }

  /**
   * Processa mensagens recebidas
   */
  private async processIncomingMessage(message: Message) {
    try {
      // Converter mensagem para o formato do Evolution API
      const messageData = {
        key: {
          remoteJid: message.from,
          fromMe: message.fromMe,
          id: message.id._serialized,
        },
        message: {
          conversation: message.body,
        },
        messageTimestamp: Math.floor(message.timestamp),
        pushName: (await message.getContact()).pushname,
      };

      // Enviar evento de mensagem recebida
      this.sendDataWebhook(Events.MESSAGES_UPSERT, {
        instance: this.instance.name,
        messages: [messageData],
        type: 'notify',
      });

      // Salvar mensagem no banco de dados se configurado
      if (this.configService.get<Database>('DATABASE').SAVE_DATA.NEW_MESSAGE) {
        await this.prismaRepository.message.create({
          data: {
            key: message.id._serialized,
            remoteJid: message.from,
            fromMe: message.fromMe,
            timestamp: new Date(message.timestamp * 1000),
            pushName: (await message.getContact()).pushname,
            message: JSON.stringify(messageData),
            messageType: 'text',
            instanceId: this.instance.id,
          },
        });
      }

      // Enviar evento para Chatwoot se estiver habilitado
      if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled) {
        this.chatwootService.eventWhatsapp(
          Events.MESSAGES_UPSERT,
          { instanceName: this.instance.name },
          {
            messages: [messageData],
          },
        );
      }
    } catch (error) {
      this.logger.error(`Erro ao processar mensagem recebida: ${error.message}`);
    }
  }

  /**
   * Envia uma mensagem de texto
   */
  public async textMessage(data: SendTextDto, isIntegration = false) {
    try {
      // Verificar se o número existe no WhatsApp
      const isRegistered = await this.client.isRegisteredUser(data.number);
      if (!isRegistered) {
        throw new NotFoundException('Número não está registrado no WhatsApp');
      }

      // Enviar mensagem
      const message = await this.client.sendMessage(data.number, data.text);

      // Converter mensagem para o formato do Evolution API
      const messageData = {
        key: {
          remoteJid: message.to,
          fromMe: true,
          id: message.id._serialized,
        },
        message: {
          conversation: message.body,
        },
        status: 'PENDING',
      };

      // Enviar evento de mensagem enviada
      this.sendDataWebhook(Events.SEND_MESSAGE, {
        instance: this.instance.name,
        message: messageData,
      });

      // Enviar evento para Chatwoot se estiver habilitado e não for uma integração
      if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled && !isIntegration) {
        this.chatwootService.eventWhatsapp(
          Events.SEND_MESSAGE,
          { instanceName: this.instance.name },
          {
            message: messageData,
          },
        );
      }

      return { key: { id: message.id._serialized } };
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem de texto: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia uma mensagem de mídia
   */
  public async mediaMessage(data: SendMediaDto, file?: any, isIntegration = false) {
    try {
      // Verificar se o número existe no WhatsApp
      const isRegistered = await this.client.isRegisteredUser(data.number);
      if (!isRegistered) {
        throw new NotFoundException('Número não está registrado no WhatsApp');
      }

      let media;
      
      // Processar mídia de diferentes fontes
      if (file) {
        // Arquivo enviado diretamente
        media = file.buffer;
      } else if (isBase64(data.media)) {
        // Mídia em formato base64
        const base64Data = data.media.split(',')[1] || data.media;
        media = Buffer.from(base64Data, 'base64');
      } else if (isURL(data.media)) {
        // Mídia como URL
        media = data.media;
      } else {
        throw new BadRequestException('Formato de mídia inválido');
      }

      // Enviar mensagem com mídia
      const message = await this.client.sendMessage(data.number, media, {
        caption: data.caption,
      });

      // Converter mensagem para o formato do Evolution API
      const messageData = {
        key: {
          remoteJid: message.to,
          fromMe: true,
          id: message.id._serialized,
        },
        message: {
          [message.type]: {
            caption: message.body,
            mimetype: file?.mimetype || 'application/octet-stream',
          },
        },
        status: 'PENDING',
      };

      // Enviar evento de mensagem enviada
      this.sendDataWebhook(Events.SEND_MESSAGE, {
        instance: this.instance.name,
        message: messageData,
      });

      // Enviar evento para Chatwoot se estiver habilitado e não for uma integração
      if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled && !isIntegration) {
        this.chatwootService.eventWhatsapp(
          Events.SEND_MESSAGE,
          { instanceName: this.instance.name },
          {
            message: messageData,
          },
        );
      }

      return { key: { id: message.id._serialized } };
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem de mídia: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia uma mensagem de áudio
   */
  public async audioWhatsapp(data: SendAudioDto, file?: any, isIntegration = false) {
    try {
      // Verificar se o número existe no WhatsApp
      const isRegistered = await this.client.isRegisteredUser(data.number);
      if (!isRegistered) {
        throw new NotFoundException('Número não está registrado no WhatsApp');
      }

      let media;
      
      // Processar áudio de diferentes fontes
      if (file) {
        // Arquivo enviado diretamente
        media = file.buffer;
      } else if (isBase64(data.audio)) {
        // Áudio em formato base64
        const base64Data = data.audio.split(',')[1] || data.audio;
        media = Buffer.from(base64Data, 'base64');
      } else if (isURL(data.audio)) {
        // Áudio como URL
        media = data.audio;
      } else {
        throw new BadRequestException('Formato de áudio inválido');
      }

      // Enviar mensagem com áudio
      const message = await this.client.sendMessage(data.number, media, {
        sendAudioAsVoice: true,
      });

      // Converter mensagem para o formato do Evolution API
      const messageData = {
        key: {
          remoteJid: message.to,
          fromMe: true,
          id: message.id._serialized,
        },
        message: {
          audioMessage: {
            mimetype: 'audio/ogg; codecs=opus',
          },
        },
        status: 'PENDING',
      };

      // Enviar evento de mensagem enviada
      this.sendDataWebhook(Events.SEND_MESSAGE, {
        instance: this.instance.name,
        message: messageData,
      });

      // Enviar evento para Chatwoot se estiver habilitado e não for uma integração
      if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled && !isIntegration) {
        this.chatwootService.eventWhatsapp(
          Events.SEND_MESSAGE,
          { instanceName: this.instance.name },
          {
            message: messageData,
          },
        );
      }

      return { key: { id: message.id._serialized } };
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem de áudio: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia uma mensagem com botões
   * Nota: Esta funcionalidade pode não ser suportada pelo whatsapp-web.js
   */
  public async buttonMessage(data: SendButtonsDto, isIntegration = false) {
    throw new BadRequestException('Método não disponível no serviço WhatsApp Web.js');
  }

  /**
   * Verifica se um número está registrado no WhatsApp
   */
  public async whatsappNumber(data: any) {
    try {
      const results = [];
      
      for (const number of data.numbers) {
        try {
          const isRegistered = await this.client.isRegisteredUser(number);
          results.push({
            jid: number,
            exists: isRegistered,
            number: number,
          });
        } catch (error) {
          results.push({
            jid: number,
            exists: false,
            number: number,
          });
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Erro ao verificar números no WhatsApp: ${error.message}`);
      throw error;
    }
  }

  /**
   * Desconecta o cliente WhatsApp Web.js
   */
  public async logout() {
    try {
      await this.client.logout();
      this.stateConnection = { state: 'close' };
      this.logger.info(`Instância ${this.instance.name} desconectada com sucesso`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao desconectar instância ${this.instance.name}: ${error.message}`);
      throw error;
    }
  }
}