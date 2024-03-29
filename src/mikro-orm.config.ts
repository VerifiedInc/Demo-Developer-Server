import { EntityCaseNamingStrategy } from 'mikro-orm';

import { config, isTest } from './config';
import { BaseEntity } from './entities/BaseEntity';
import { Company } from './entities/Company';
import { Issuer } from './entities/Issuer';
import { User } from './entities/User';
import { IssuedCredential } from './entities/IssuedCredential';
import { Verifier } from './entities/Verifier';
import { SharedCredential } from './entities/SharedCredential';
import { PresentationRequest } from './entities/PresentationRequest';
import { HolderApp } from './entities/HolderApp';
import { Username } from './entities/Username';

export default {
  baseDir: process.cwd(),
  type: 'postgresql',
  dbName: config.DB_NAME,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  host: config.DB_HOST,
  entities: [
    BaseEntity,
    Company,
    Issuer,
    User,
    IssuedCredential,
    Verifier,
    SharedCredential,
    PresentationRequest,
    HolderApp,
    Username
  ],
  entitiesDirs: ['lib/entities'],
  entitiesDirsTs: ['src/entities'],
  tsNode: true,
  cache: { enabled: true },
  debug: !isTest(),
  namingStrategy: EntityCaseNamingStrategy,
  migrations: {
    path: `${process.cwd()}/src/migrations`
  }
};
