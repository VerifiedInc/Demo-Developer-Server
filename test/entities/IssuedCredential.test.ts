import { MikroORM } from 'mikro-orm';
import { v4 } from 'uuid';

import config from '../../src/mikro-orm.config';
import { IssuedCredential, IssuedCredentialOptions } from '../../src/entities/IssuedCredential';
import { Company } from '../../src/entities/Company';
import { User } from '../../src/entities/User';
import { Issuer } from '../../src/entities/Issuer';
import { resetDb } from '../resetDb';

describe('IssuedCredential entity', () => {
  let options: IssuedCredentialOptions;
  let orm;

  beforeEach(async () => {
    orm = await MikroORM.init(config);

    const companyOptions = {
      unumIdApiKey: '3n5jhT2vXDEEXlRj09oI9pP6DmWNXNCghUMC/ybK2Lw=',
      name: 'ACME, Inc.',
      unumIdCustomerUuid: '8125068d-e8c9-4706-83a0-be1485bf7265'
    };
    const company = new Company(companyOptions);
    orm.em.persistLater(company);

    const issuerOptions = {
      name: 'ACME, Inc. Issuer',
      did: 'did:unum:e9305322-f642-45c4-9efc-cf4f5326cd6a',
      privateKey: '-----BEGIN EC PRIVATE KEY-----MHcCAQEEIIFtwDWUzCbfeikEgD4m6G58hQo51d2Qz6bL11AHDMbDoAoGCCqGSM49AwEHoUQDQgAEwte3H5BXDcJy+4z4avMsNuqXFGYfL3ewcU0pe+UrYbhh6B7oCdvSPocO55BZO5pAOF/qxa/NhwixxqFf9eWVFg==-----END EC PRIVATE KEY-----',
      authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoidmVyaWZpZXIiLCJ1dWlkIjoiM2VjYzVlZDMtZjdhMC00OTU4LWJjOTgtYjc5NTQxMThmODUyIiwiZGlkIjoiZGlkOnVudW06ZWVhYmU0NGItNjcxMi00NTRkLWIzMWItNTM0NTg4NTlmMTFmIiwiZXhwIjoxNTk1NDcxNTc0LjQyMiwiaWF0IjoxNTk1NTI5NTExfQ.4iJn_a8fHnVsmegdR5uIsdCjXmyZ505x1nA8NVvTEBg',
      companyUuid: company.uuid
    };

    const issuer = new Issuer(issuerOptions);
    orm.em.persistLater(issuer);

    const userOptions = {
      companyUuid: company.uuid,
      did: `did:unum:${v4()}`,
      name: 'Testy McTesterson'
    };

    const user = new User(userOptions);
    orm.em.persistLater(user);

    await orm.em.flush();

    options = {
      issuerUuid: issuer.uuid,
      userUuid: user.uuid,
      credential: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: '0c93beb0-2605-4650-b698-3fd92eb110b9',
        credentialSubject: {
          id: 'did:unum:c92aed65-21c1-438f-b723-d2ee4a637a47#e939fbf0-7c81-49c9-b369-8ca502fcd19f',
          value: 'dummy value'
        },
        credentialStatus: {
          id: 'https://api.dev-unumid.org/credentialStatus/0c93beb0-2605-4650-b698-3fd92eb110b9',
          type: 'CredentialStatus'
        },
        issuer: 'did:unum:e1281297-268b-4700-8f17-7fa826effe35',
        type: ['VerifiableCredential', 'DummyCredential'],
        issuanceDate: new Date('2020-05-26T23:07:12.770Z'),
        proof: {
          created: '2020-05-26T23:07:12.770Z',
          signatureValue: 'AN1rKqzbXLkDeDiqPAdddiwYoH4v4ZBpga81RmPGtz8AxH2PuNETE9enHofQGZfyduEMA2rPzyWGaPfHMQQgmMZADecRchjJE',
          proofPurpose: 'assertionMethod',
          type: 'secp256r1Signature2020',
          verificationMethod: 'did:unum:880e33d9-888c-4fc2-a98c-602293793ce4#79064dc8-1367-4c98-a8b5-ad601e49e196'
        }
      }
    };

    // clear the identity map
    orm.em.clear();
  });

  afterEach(async () => {
    await resetDb(orm.em);
  });

  describe('constructor behavior', () => {
    it('generates uuid, createdAt, and updatedAt properties', () => {
      const issuedCredential = new IssuedCredential(options);
      expect(issuedCredential.uuid).toBeDefined();
      expect(issuedCredential.createdAt).toBeDefined();
      expect(issuedCredential.updatedAt).toBeDefined();
    });

    it('sets issuerUuid, userUuid, and credential from options', () => {
      const issuedCredential = new IssuedCredential(options);
      expect(issuedCredential.issuerUuid).toEqual(options.issuerUuid);
      expect(issuedCredential.userUuid).toEqual(options.userUuid);
      expect(issuedCredential.credential).toEqual(options.credential);
    });
  });

  describe('storage behavior', () => {
    it('saves and restores the IssuedCredential', async () => {
      const repository = orm.em.getRepository(IssuedCredential);
      const initial = new IssuedCredential(options);
      await repository.persistAndFlush(initial);

      // clear the identity map
      orm.em.clear();

      // find it by UUID
      const saved = await repository.findOneOrFail(initial.uuid);
      expect(saved).toEqual({ ...initial, credential: { ...initial.credential, issuanceDate: initial.credential.issuanceDate.toISOString() } });
    });
  });
});
