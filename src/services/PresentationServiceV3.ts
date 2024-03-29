import { Params, ServiceAddons } from '@feathersjs/feathers';
import { BadRequest, GeneralError } from '@feathersjs/errors';
import axios from 'axios';
import { Channel } from '@feathersjs/transport-commons/lib/channels/channel/base';

import { Application } from '../declarations';
import { config } from '../config';
import logger from '../logger';
import { isArrayNotEmpty } from '../utils/isArrayEmpty';

import { EncryptedPresentation, PresentationReceiptInfo, VerificationResponse, PresentationPb, CredentialPb } from '@unumid/types';
import { DecryptedPresentation, extractCredentialInfo, Presentation, CredentialInfo, convertCredentialSubject } from '@unumid/server-sdk';
import { DemoPresentationDto } from '@unumid/demo-types';
import { handleIssuerVerifierWebAppError } from '../utils/errorHandler';

/**
 * This service handles encrypted presentations from the saas where v1 handle plain text presentation from the holder sdk.
 */
export class PresentationServiceV3 {
  private app!: Application;

  async create (presentation: EncryptedPresentation, params: Params): Promise<VerificationResponse> {
    const { presentationRequestInfo, encryptedPresentation } = presentation;
    const presentationRequestId = presentationRequestInfo.presentationRequest.id;

    const presentationRequestService = this.app.service('presentationRequest');
    const presentationWebsocketService = this.app.service('presentationWebsocket');
    let presentationRequest;
    try {
      // Note: although I could uuid because this is most recent version of the service opting to use id for so no changes will be necessary when working on v4.
      presentationRequest = await presentationRequestService.get(null, { where: { id: presentationRequestId } });
    } catch (e) {
      logger.error(`error grabbing request ${e}`);
      throw e;
    }

    const verifier = await presentationRequest._verifier.init();
    const verifierService = this.app.service('verifier');
    const version = params.headers?.version; // ought to be defined via the global before hook

    // verify presentation
    const url = `${config.VERIFIER_URL}/api/verifyPresentation`;

    // Needed to roll over the old attribute value that wasn't storing the Bearer as part of the token. Ought to remove once the roll over is complete. Figured simple to enough to just handle in app code.
    const authToken = verifier.authToken.startsWith('Bearer ') ? verifier.authToken : `Bearer ${verifier.authToken}`;
    // const headers = { Authorization: `${authToken}`, params: presentation.version };
    const headers = { Authorization: `${authToken}`, version };

    try {
      // forward request to verifier
      const response = await axios.post(url, { encryptedPresentation, verifier: verifier.did, encryptionPrivateKey: verifier.encryptionPrivateKey }, { headers });
      const result: DecryptedPresentation = response.data;

      logger.info(`response from verifier app ${result}`);

      // update the verifier's auth token if it was reissued
      const authTokenResponse = response.headers['x-auth-token'];
      if (authTokenResponse !== verifier.authToken) {
        await verifierService.patch(verifier.uuid, { authToken: authTokenResponse });
      }

      // return early if the presentation could not be verified
      if (!result.isVerified) {
        logger.warn(`Presentation verification failed: ${result.message}`);
        throw new BadRequest(`Verification failed: ${result.message}`);
      }
      const decryptedPresentation: PresentationPb = result.presentation as PresentationPb;

      if (result.type === 'VerifiablePresentation' && isArrayNotEmpty(decryptedPresentation.verifiableCredential)) {
      // save shared credentials
        const sharedCredentialService = this.app.service('sharedCredential');
        const issuerService = this.app.service('issuer');
        const userService = this.app.service('user');

        for (const credential of (decryptedPresentation.verifiableCredential as CredentialPb[])) {
        // get saved issuer and user by their dids
        // note that the saved dids will not include key identifier fragments, which may be included in the credential
          const issuer = await issuerService.get(null, { where: { did: credential.issuer.split('#')[0] } });

          const credentialSubject = convertCredentialSubject(credential.credentialSubject);
          const user = await userService.get(null, { where: { did: credentialSubject.id.split('#')[0] } });

          const options = {
            verifierUuid: verifier.uuid,
            issuerUuid: issuer.uuid,
            userUuid: user.uuid,
            credential
          };

          await sharedCredentialService.create(options);
        }
      }

      // Handle passing to the presentation websokcet service for web client consuming the plaintext presentation, which should not be returned to UnumID's saas.
      const demoVerification: DemoPresentationDto = {
        isVerified: true,
        presentation: decryptedPresentation as unknown as Presentation,
        uuid: '', // unused in this demo
        createdAt: new Date(), // unused in this demo
        updatedAt: new Date() // unused in this demo
      };
      await presentationWebsocketService.create(demoVerification, params);

      // extract the relevant credential info to send back to UnumID's SaaS for analytics.
      const credentialInfo: CredentialInfo = extractCredentialInfo(decryptedPresentation as PresentationPb);

      const presentationReceiptInfo: PresentationReceiptInfo = {
        subjectDid: credentialInfo.subjectDid,
        credentialTypes: credentialInfo.credentialTypes,
        verifierDid: verifier.did,
        holderApp: presentationRequest.holderApp.uuid,
        issuers: result.type === 'VerifiablePresentation' ? presentationRequest.issuers : undefined,
        presentationRequestUuid: presentationRequestInfo.presentationRequest.uuid,
        presentationRequestId: presentationRequestInfo.presentationRequest.id
      };

      return { isVerified: true, type: result.type, presentationReceiptInfo };
    } catch (error) {
      if (error instanceof BadRequest) {
        throw error; // isVerifier is false
      }

      logger.error(`Issue handling verifying a v3 presentation ${error.response && error.response.data ? JSON.stringify(error.response.data) : JSON.stringify(error)}`);
      if (error.response) {
        handleIssuerVerifierWebAppError(error.response);
      }

      throw new GeneralError(`Issue handling verifying a v3 presentation ${error.response && error.response.data ? error.response.data : error}`);
    }
  }

  setup (app: Application): void {
    this.app = app;
  }
}

declare module '../declarations' {
  interface ServiceTypes {
    presentationV3: PresentationServiceV3 & ServiceAddons<PresentationServiceV3>
  }
}

export default function (app: Application): void {
  app.use('/presentationV3', new PresentationServiceV3());
  const service = app.service('presentationV3');
}
