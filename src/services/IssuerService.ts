import { ServiceAddons, HookContext } from '@feathersjs/feathers';
import createService, { MikroOrmService } from 'feathers-mikro-orm';
import axios from 'axios';

import { Application } from '../declarations';
import { Issuer } from '../entities/Issuer';
import { config } from '../config';

declare module '../declarations' {
  interface ServiceTypes {
    issuer: MikroOrmService & ServiceAddons<MikroOrmService>
  }
}

export async function registerIssuer (ctx: HookContext): Promise<HookContext> {
  const { data } = ctx;

  const companyService = ctx.app.service('company');

  const companyList = await companyService.find();
  const company = companyList[0];

  const url = `${config.ISSUER_URL}/api/register`;
  const issuerOptions = {
    ...data,
    apiKey: company.unumIdApiKey,
    customerUuid: company.unumIdCustomerUuid
  };

  const response = await axios.post(url, issuerOptions);

  return {
    ...ctx,
    data: {
      name: response.data.name,
      privateKey: response.data.keys.signing.privateKey,
      did: response.data.did,
      authToken: response.headers['x-auth-token'],
      uriScheme: data.holderUriScheme,
      companyUuid: company.uuid
    }
  };
}

const hooks = {
  before: {
    create: registerIssuer
  }
};

export default function (app: Application): void {
  if (!app.mikro) {
    throw new Error('error configuring IssuerService, app.mikro is not properly initialized');
  }

  const repository = app.mikro.issuerRepository;

  if (!repository) {
    throw new Error('error configuring IssuerService, repository is not properly initialized');
  }

  const companyService = createService({
    repository,
    Entity: Issuer,
    name: 'Issuer'
  });

  app.use('/issuer', companyService);
  const service = app.service('issuer');
  service.hooks(hooks);
}
