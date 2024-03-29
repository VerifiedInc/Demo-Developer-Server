import { Params, ServiceAddons } from '@feathersjs/feathers';
import { GeneralError } from '@feathersjs/errors';
import axios from 'axios';

import { Application } from '../declarations';
import { config } from '../config';
import { SuccessResponse } from '../types';

interface SmsOptions {
  to: string;
  deeplink: string
}

export class SmsService {
  private app!: Application;

  async create (data: SmsOptions, params: Params): Promise<SuccessResponse> {
    const verifierService = this.app.service('verifier');
    const [verifier] = await verifierService.find();

    try {
      const url = `${config.VERIFIER_URL}/api/sendSms`;

      // Needed to roll over the old attribute value that wasn't storing the Bearer as part of the token. Ought to remove once the roll over is complete. Figured simple to enough to just handle in app code.
      const authToken = verifier.authToken.startsWith('Bearer ') ? verifier.authToken : `Bearer ${verifier.authToken}`;
      const headers = { Authorization: authToken, version: params.headers?.version }; // ought to be defined via the global before hook

      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (e) {
      throw new GeneralError(`Error sending sms. ${e}`);
    }
  }

  setup (app: Application): void {
    this.app = app;
  }
}

declare module '../declarations' {
  interface ServiceTypes {
    sms: SmsService & ServiceAddons<SmsService>;
  }
}

export default function (app: Application): void {
  app.use('/sms', new SmsService());
}
