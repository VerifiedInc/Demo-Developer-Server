import { Server } from 'http';
import supertest from 'supertest';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { BadRequest } from '@feathersjs/errors';

import generateApp from '../../src/generate-app';
import { Presentation, NoPresentation } from '../../src/types';
import { Application } from '../../src/declarations';
import { Verifier } from '../../src/entities/Verifier';
import { config } from '../../src/config';
import { resetDb } from '../resetDb';

jest.mock('axios');
const mockAxiosPost = axios.post as jest.Mock;

describe('PresentationService', () => {
  describe('initializing the service', () => {
    it('registers with the app', async () => {
      const app = await generateApp();
      const service = app.service('presentation');
      expect(service).toBeDefined();
    });
  });

  describe('/presentation endpoint', () => {
    let presentation: Presentation;
    let app: Application;
    let server: Server;
    let verifier: Verifier;
    let mockReturnedHeaders;

    beforeAll(async () => {
      // set up app and wait until server is ready
      app = await generateApp();
      server = app.listen();
      await new Promise((resolve) => server.once('listening', resolve));
    });

    afterAll(async () => {
      // wait until server is closed
      await new Promise(resolve => server.close(resolve));
    });

    beforeEach(async () => {
      // seed the db with a company
      const companyOptions = {
        unumIdApiKey: '3n5jhT2vXDEEXlRj09oI9pP6DmWNXNCghUMC/ybK2Lw=',
        name: 'ACME, Inc.',
        unumIdCustomerUuid: '8125068d-e8c9-4706-83a0-be1485bf7265'
      };
      const companyResponse = await supertest(app).post('/company').send(companyOptions);

      // set up mock responses from issuer and verifier apps
      const now = new Date();

      mockReturnedHeaders = {
        'x-auth-token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoidmVyaWZpZXIiLCJ1dWlkIjoiM2VjYzVlZDMtZjdhMC00OTU4LWJjOTgtYjc5NTQxMThmODUyIiwiZGlkIjoiZGlkOnVudW06ZWVhYmU0NGItNjcxMi00NTRkLWIzMWItNTM0NTg4NTlmMTFmIiwiZXhwIjoxNTk1NDcxNTc0LjQyMiwiaWF0IjoxNTk1NTI5NTExfQ.4iJn_a8fHnVsmegdR5uIsdCjXmyZ505x1nA8NVvTEBg'
      };

      const mockReturnedVerifier = {
        uuid: uuidv4(),
        createdAt: now,
        updatedAt: now,
        did: `did:unum:${uuidv4()}`,
        customerUuid: companyOptions.unumIdCustomerUuid,
        name: 'ACME Inc. TEST Verifier',
        keys: {
          privateKey: '-----BEGIN EC PRIVATE KEY-----MHcCAQEEIIFtwDWUzCbfeikEgD4m6G58hQo51d2Qz6bL11AHDMbDoAoGCCqGSM49AwEHoUQDQgAEwte3H5BXDcJy+4z4avMsNuqXFGYfL3ewcU0pe+UrYbhh6B7oCdvSPocO55BZO5pAOF/qxa/NhwixxqFf9eWVFg==-----END EC PRIVATE KEY-----'
        }
      };

      const mockReturnedIssuer = {
        uuid: uuidv4(),
        createdAt: now,
        updatedAt: now,
        did: `did:unum:${uuidv4()}`,
        customerUuid: companyOptions.unumIdCustomerUuid,
        name: 'ACME Inc. TEST Issuer',
        keys: {
          signing: {
            privateKey: '-----BEGIN EC PRIVATE KEY-----MHcCAQEEIIFtwDWUzCbfeikEgD4m6G58hQo51d2Qz6bL11AHDMbDoAoGCCqGSM49AwEHoUQDQgAEwte3H5BXDcJy+4z4avMsNuqXFGYfL3ewcU0pe+UrYbhh6B7oCdvSPocO55BZO5pAOF/qxa/NhwixxqFf9eWVFg==-----END EC PRIVATE KEY-----'
          }
        }
      };

      mockAxiosPost.mockReturnValueOnce({ data: mockReturnedVerifier, headers: mockReturnedHeaders });
      mockAxiosPost.mockReturnValueOnce({ data: mockReturnedIssuer, headers: mockReturnedHeaders });

      // seed the db with the other objects we'll need
      const verifierOptions = {
        name: 'ACME Inc. TEST Verifier',
        companyUuid: companyResponse.body.uuid
      };

      const issuerOptions = {
        name: 'ACME Inc. TEST Issuer',
        companyUuid: companyResponse.body.uuid,
        holderUriScheme: 'acme://'
      };

      const userOptions = {
        name: 'Testy McTesterson',
        companyUuid: companyResponse.body.uuid,
        did: `did:unum:${uuidv4()}`
      };

      const verifierResponse = await supertest(app).post('/verifier').send(verifierOptions);
      await supertest(app).post('/user').send(userOptions);
      await supertest(app).post('/issuer').send(issuerOptions);

      verifier = verifierResponse.body;

      presentation = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1'
        ],
        type: [
          'VerifiablePresentation'
        ],
        verifiableCredential: [
          {
            '@context': [
              'https://www.w3.org/2018/credentials/v1'
            ],
            credentialStatus: {
              id: 'https://api.dev-unumid.org//credentialStatus/b2acd26a-ab18-4d18-9ad1-3b77f55c564b',
              type: 'CredentialStatus'
            },
            credentialSubject: {
              id: userOptions.did,
              test: 'test'
            },
            issuer: mockReturnedIssuer.did,
            type: [
              'VerifiableCredential',
              'TestCredential'
            ],
            id: 'b2acd26a-ab18-4d18-9ad1-3b77f55c564b',
            issuanceDate: new Date('2020-09-03T18:42:30.645Z'),
            proof: {
              created: '2020-09-03T18:42:30.658Z',
              signatureValue: '381yXYx2wa7qR4XMEWeLPWVR7xhksi4684VCZL7Yx9jXneVMxXoa3eT3dA5QU1tofsH4XrGbU8d4pNTiLRpa8iUWvWmAdnfE',
              type: 'secp256r1Signature2020',
              verificationMethod: 'did:unum:2e05967f-216f-44c4-ae8e-d6f71cd17c5a',
              proofPurpose: 'AssertionMethod'
            }
          }
        ],
        presentationRequestUuid: '0cebee3b-3295-4ef6-a4d6-7dfea413b3aa',
        proof: {
          created: '2020-09-03T18:50:52.105Z',
          signatureValue: 'iKx1CJLYue7vopUo2fqGps3TWmxqRxoBDTupumLkaNp2W3UeAjwLUf5WxLRCRkDzEFeKCgT7JdF5fqbpvqnBZoHyYzWYbmW4YQ',
          type: 'secp256r1Signature2020',
          verificationMethod: 'did:unum:3ff2f020-50b0-4f4c-a267-a9f104aedcd8#1e126861-a51b-491f-9206-e2c6b8639fd1',
          proofPurpose: 'AssertionMethod'
        }
      };
    });

    afterEach(async () => {
      await resetDb(app.mikro.em);
    });

    describe('post', () => {
      it('throws if not given the verifier query param', async () => {
        try {
          await supertest(app).post('/presentation').send(presentation);
        } catch (e) {
          expect(e).toEqual(new BadRequest('Verifier query param is required.'));
        }
      });

      it('sends the presentation to the verifier app for verification', async () => {
        await supertest(app).post('/presentation').query({ verifier: verifier.uuid }).send(presentation);
        const expectedUrl = `${config.VERIFIER_URL}/api/verifyPresentation`;
        const expectedHeaders = { 'x-auth-token': verifier.authToken };
        const expectedData = {
          ...presentation,
          verifiableCredential: [{
            ...presentation.verifiableCredential[0],
            issuanceDate: '2020-09-03T18:42:30.645Z'
          }]
        };

        expect((axios.post as jest.Mock)).toBeCalledWith(expectedUrl, expectedData, { headers: expectedHeaders });
      });

      it('returns a success response if the presentation is valid', async () => {
        (axios.post as jest.Mock).mockReturnValueOnce({ data: { verifiedStatus: true }, headers: mockReturnedHeaders });
        const response = await supertest(app).post('/presentation').query({ verifier: verifier.uuid }).send(presentation);
        expect(response.body).toEqual({ isVerified: true, type: 'VerifiablePresentation' });
      });

      it('saves the shared credentials contained in the presentation', async () => {
        (axios.post as jest.Mock).mockReturnValueOnce({ data: { verifiedStatus: true }, headers: mockReturnedHeaders });
        await supertest(app).post('/presentation').query({ verifier: verifier.uuid }).send(presentation);

        const sharedCredentialsResponse = await supertest(app).get('/sharedCredential').send();

        expect(sharedCredentialsResponse.body.length).toEqual(1);

        // convert dates to ISO string format
        // TODO: write a helper function to do this for any object
        const expected = {
          ...presentation.verifiableCredential[0],
          issuanceDate: presentation.verifiableCredential[0].issuanceDate.toISOString()
        };

        expect(sharedCredentialsResponse.body[0].credential).toEqual(expected);
      });

      describe('handling a NoPresentation', () => {
        const noPresentation: NoPresentation = {
          type: ['NoPresentation'],
          presentationRequestUuid: '0cebee3b-3295-4ef6-a4d6-7dfea413b3aa',
          proof: {
            created: '2020-09-03T18:50:52.105Z',
            signatureValue: 'iKx1CJLYue7vopUo2fqGps3TWmxqRxoBDTupumLkaNp2W3UeAjwLUf5WxLRCRkDzEFeKCgT7JdF5fqbpvqnBZoHyYzWYbmW4YQ',
            type: 'secp256r1Signature2020',
            verificationMethod: 'did:unum:3ff2f020-50b0-4f4c-a267-a9f104aedcd8#1e126861-a51b-491f-9206-e2c6b8639fd1',
            proofPurpose: 'AssertionMethod'
          },
          holder: 'did:unum:3ff2f020-50b0-4f4c-a267-a9f104aedcd8'
        };

        it('returns a success response if the NoPresentation is valid', async () => {
          (axios.post as jest.Mock).mockReturnValueOnce({ data: { isVerified: true } });
          const response = await supertest(app).post('/presentation').query({ verifier: verifier.uuid }).send(noPresentation);
          expect(response.body).toEqual({ isVerified: true, type: 'NoPresentation' });
        });

        it('returns a 400 status code if the NoPresentation is not verified', async () => {
          (axios.post as jest.Mock).mockReturnValueOnce({ data: { isVerified: false } });
          const response = await supertest(app).post('/presentation').query({ verifier: verifier.uuid }).send(noPresentation);
          expect(response.status).toEqual(400);
        });
      });

      it('returns 400 status code if the Presentation is not verified', async () => {
        (axios.post as jest.Mock).mockReturnValueOnce({ data: { verifiedStatus: false }, headers: mockReturnedHeaders });
        const response = await supertest(app).post('/presentation').query({ verifier: verifier.uuid }).send(presentation);
        expect(response.status).toEqual(400);
      });
    });
  });
});
