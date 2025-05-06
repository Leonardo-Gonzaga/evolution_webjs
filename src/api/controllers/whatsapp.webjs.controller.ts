import { Request, Response } from 'express';
import { whatsappWebJSService } from '../services/whatsapp.webjs.service';
import { Logger } from '../../config/logger.config';
import { InstanceDto } from '../dto/instance.dto';

export class WhatsAppWebJSController {
  private readonly logger = new Logger(WhatsAppWebJSController.name);

  /**
   * Cria uma nova instância do WhatsApp Web.js
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async createInstance(req: Request, res: Response) {
    try {
      const { instanceName, proxy } = req.body;

      if (!instanceName) {
        return res.status(400).json({
          status: false,
          message: 'Nome da instância é obrigatório',
        });
      }

      // Verifica se a instância já existe
      const existingInstance = whatsappWebJSService.getInstance(instanceName);
      if (existingInstance) {
        return res.status(409).json({
          status: false,
          message: `Instância ${instanceName} já existe`,
        });
      }

      // Cria a instância
      await whatsappWebJSService.createInstance(instanceName, proxy);

      return res.status(201).json({
        status: true,
        message: `Instância ${instanceName} criada com sucesso`,
        instance: { instanceName },
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }

  /**
   * Obtém o QR Code para uma instância
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async getQRCode(req: Request, res: Response) {
    try {
      const { instanceName } = req.params;

      // Verifica se a instância existe
      const instance = whatsappWebJSService.getInstance(instanceName);
      if (!instance) {
        return res.status(404).json({
          status: false,
          message: `Instância ${instanceName} não encontrada`,
        });
      }

      // Obtém o QR Code
      const qrCode = whatsappWebJSService.getQRCode(instanceName);
      if (!qrCode) {
        return res.status(404).json({
          status: false,
          message: `QR Code não disponível para instância ${instanceName}`,
        });
      }

      return res.status(200).json({
        status: true,
        qrcode: qrCode,
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }

  /**
   * Envia uma mensagem de texto
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { instanceName } = req.params;
      const { to, text } = req.body;

      if (!to || !text) {
        return res.status(400).json({
          status: false,
          message: 'Destinatário e texto da mensagem são obrigatórios',
        });
      }

      // Verifica se a instância existe
      const instance = whatsappWebJSService.getInstance(instanceName);
      if (!instance) {
        return res.status(404).json({
          status: false,
          message: `Instância ${instanceName} não encontrada`,
        });
      }

      // Envia a mensagem
      const message = await whatsappWebJSService.sendTextMessage(instanceName, to, text);

      return res.status(200).json({
        status: true,
        message: 'Mensagem enviada com sucesso',
        data: message,
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }

  /**
   * Lista todos os grupos da instância
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async listGroups(req: Request, res: Response) {
    try {
      const { instanceName } = req.params;

      // Verifica se a instância existe
      const instance = whatsappWebJSService.getInstance(instanceName);
      if (!instance) {
        return res.status(404).json({
          status: false,
          message: `Instância ${instanceName} não encontrada`,
        });
      }

      // Lista os grupos
      const groups = await whatsappWebJSService.listGroups(instanceName);

      return res.status(200).json({
        status: true,
        groups,
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }

  /**
   * Cria um novo grupo
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async createGroup(req: Request, res: Response) {
    try {
      const { instanceName } = req.params;
      const { groupName, participants } = req.body;

      if (!groupName || !participants || !Array.isArray(participants)) {
        return res.status(400).json({
          status: false,
          message: 'Nome do grupo e lista de participantes são obrigatórios',
        });
      }

      // Verifica se a instância existe
      const instance = whatsappWebJSService.getInstance(instanceName);
      if (!instance) {
        return res.status(404).json({
          status: false,
          message: `Instância ${instanceName} não encontrada`,
        });
      }

      // Cria o grupo
      const group = await whatsappWebJSService.createGroup(instanceName, groupName, participants);

      return res.status(201).json({
        status: true,
        message: 'Grupo criado com sucesso',
        group,
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }

  /**
   * Deleta uma instância
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async deleteInstance(req: Request, res: Response) {
    try {
      const { instanceName } = req.params;

      // Verifica se a instância existe
      const instance = whatsappWebJSService.getInstance(instanceName);
      if (!instance) {
        return res.status(404).json({
          status: false,
          message: `Instância ${instanceName} não encontrada`,
        });
      }

      // Deleta a instância
      const deleted = await whatsappWebJSService.deleteInstance(instanceName);

      return res.status(200).json({
        status: deleted,
        message: deleted
          ? `Instância ${instanceName} deletada com sucesso`
          : `Erro ao deletar instância ${instanceName}`,
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }

  /**
   * Lista todas as instâncias ativas
   * @param req Requisição Express
   * @param res Resposta Express
   */
  async listInstances(req: Request, res: Response) {
    try {
      const instances = whatsappWebJSService.getAllInstances();
      const instanceList = Array.from(instances.keys()).map(instanceName => ({
        instanceName,
        connected: true,
      }));

      return res.status(200).json({
        status: true,
        instances: instanceList,
      });
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({
        status: false,
        message: error.message,
      });
    }
  }
}

// Exporta uma instância singleton do controlador
export const whatsappWebJSController = new WhatsAppWebJSController();