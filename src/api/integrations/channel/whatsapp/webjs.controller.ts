import { InstanceDto } from '@api/dto/instance.dto';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';

/**
 * Controlador para o canal WhatsApp Web.js
 * Esta classe implementa os endpoints específicos para a biblioteca whatsapp-web.js
 */
export class WebJSController {
  constructor(private readonly waMonitor: WAMonitoringService) {}

  private readonly logger = new Logger('WebJSController');

  /**
   * Verifica se um número está registrado no WhatsApp
   */
  public async checkNumberStatus({ instanceName }: InstanceDto, body: any) {
    const instance = this.waMonitor.waInstances[instanceName];
    return instance.whatsappNumber(body);
  }

  /**
   * Obtém informações do perfil de um contato
   */
  public async getProfilePicture({ instanceName }: InstanceDto, body: any) {
    const instance = this.waMonitor.waInstances[instanceName];
    const contact = await instance.client.getContactById(body.number);
    return {
      profilePictureUrl: await contact.getProfilePicUrl(),
    };
  }

  /**
   * Obtém o status da conexão
   */
  public async getConnectionState({ instanceName }: InstanceDto) {
    const instance = this.waMonitor.waInstances[instanceName];
    return {
      state: instance.connectionStatus.state,
    };
  }

  /**
   * Desconecta a instância
   */
  public async logout({ instanceName }: InstanceDto) {
    const instance = this.waMonitor.waInstances[instanceName];
    return instance.logout();
  }

  /**
   * Obtém todos os contatos
   */
  public async getAllContacts({ instanceName }: InstanceDto) {
    const instance = this.waMonitor.waInstances[instanceName];
    const contacts = await instance.client.getContacts();
    return contacts.map(contact => ({
      id: contact.id._serialized,
      name: contact.name || contact.pushname || '',
      number: contact.number,
      isGroup: contact.isGroup,
      isWAContact: contact.isWAContact,
    }));
  }

  /**
   * Obtém todos os chats
   */
  public async getAllChats({ instanceName }: InstanceDto) {
    const instance = this.waMonitor.waInstances[instanceName];
    const chats = await instance.client.getChats();
    return chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      timestamp: chat.timestamp,
      unreadCount: chat.unreadCount,
    }));
  }

  /**
   * Obtém mensagens de um chat
   */
  public async getChatMessages({ instanceName }: InstanceDto, body: any) {
    const instance = this.waMonitor.waInstances[instanceName];
    const chat = await instance.client.getChatById(body.chatId);
    const messages = await chat.fetchMessages({
      limit: body.limit || 50,
    });
    
    return messages.map(message => ({
      id: message.id._serialized,
      body: message.body,
      type: message.type,
      timestamp: message.timestamp,
      from: message.from,
      to: message.to,
      fromMe: message.fromMe,
      hasMedia: message.hasMedia,
    }));
  }
}