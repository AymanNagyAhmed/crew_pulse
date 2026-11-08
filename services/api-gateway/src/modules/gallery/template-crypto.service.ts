import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  decryptEmbedding,
  encryptEmbedding,
  parseTemplateKey,
} from './template-crypto.js';

@Injectable()
export class TemplateCryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    this.key = parseTemplateKey(
      this.config.get<string>('BIOMETRIC_TEMPLATE_KEY'),
    );
  }

  encrypt(embedding: number[]): { ciphertext: Buffer; kid: string } {
    return encryptEmbedding(embedding, this.key);
  }

  decrypt(ciphertext: Buffer): number[] {
    return decryptEmbedding(ciphertext, this.key);
  }
}
