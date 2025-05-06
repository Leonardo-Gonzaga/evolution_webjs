import { RouterBroker } from '@api/abstract/abstract.router';
import { InstanceDto } from '@api/dto/instance.dto';
import { HttpStatus } from '@api/routes/index.router';
import { instanceSchema } from '@validate/instance.schema';
import { RequestHandler, Router } from 'express';

/**
 * Roteador para o canal WhatsApp Web.js
 * Esta classe implementa as rotas específicas para a biblioteca whatsapp-web.js
 */
export class WebJSRouter extends RouterBroker {
  constructor(readonly webJSController: any, ...guards: RequestHandler[]) {
    super();
    this.router
      .post(this.routerPath('checkNumberStatus'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.checkNumberStatus(instance, req.body),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .post(this.routerPath('getProfilePicture'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.getProfilePicture(instance, req.body),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('getConnectionState'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.getConnectionState(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .post(this.routerPath('logout'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.logout(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('getAllContacts'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.getAllContacts(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('getAllChats'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.getAllChats(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .post(this.routerPath('getChatMessages'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => webJSController.getChatMessages(instance, req.body),
        });

        res.status(HttpStatus.OK).json(response);
      });
  }

  public readonly router: Router = Router();
}