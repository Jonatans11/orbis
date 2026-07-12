/**
 * DIF Presentation Exchange Specification.
 *
 * Standardizes how a verifier requests specific claims from a holder's credential
 * (e.g., age constraints or credential type filters) and how the holder's wallet
 * can automatically evaluate and generate a matching ZK selective disclosure presentation.
 *
 * References:
 * - https://identity.foundation/presentation-exchange/
 */

import { createZKProof, type ZKProof } from "./zk.js";

export interface PresentationDefinition {
  id: string;
  input_descriptors: Array<{
    id: string;
    purpose?: string;
    constraints: {
      fields?: Array<{
        path: string[]; // e.g. ["$.credentialSubject.age", "$.credentialSubject.dateOfBirth"]
        filter?: {
          type: string; // e.g. "integer", "string"
          minimum?: number;
          const?: any;
        };
      }>;
    };
  }>;
}

/**
 * Evaluate if a Verifiable Credential satisfies a DIF Presentation Definition constraints.
 * Returns a list of matching/requested fields that must be revealed.
 */
export function evaluateCredential(
  credential: any,
  definition: PresentationDefinition
): { satisfies: boolean; revealFields: string[]; error?: string } {
  const revealFields = new Set<string>();

  for (const descriptor of definition.input_descriptors) {
    const fields = descriptor.constraints.fields || [];
    for (const fieldConstraint of fields) {
      let matched = false;
      let matchedField = "";

      for (const path of fieldConstraint.path) {
        // e.g. "$.credentialSubject.age" -> parse key "age"
        const subjectPrefix = "$.credentialSubject.";
        if (!path.startsWith(subjectPrefix)) continue;

        const key = path.slice(subjectPrefix.length);
        const value = credential.credentialSubject?.[key];

        if (value !== undefined) {
          if (fieldConstraint.filter) {
            const filter = fieldConstraint.filter;
            if (filter.type === "integer" && typeof value === "number") {
              if (filter.minimum !== undefined && value < filter.minimum) continue;
            }
            if (filter.const !== undefined && value !== filter.const) continue;
          }

          matched = true;
          matchedField = key;
          revealFields.add(key);
          break;
        }
      }

      if (!matched) {
        return {
          satisfies: false,
          revealFields: [],
          error: `Credential does not satisfy constraint: ${fieldConstraint.path.join(" or ")}`
        };
      }
    }
  }

  return {
    satisfies: true,
    revealFields: Array.from(revealFields)
  };
}

/**
 * Automatically generate a signed ZK Selective Disclosure Presentation from a DIF query.
 */
export async function generatePresentationFromQuery(options: {
  credential: any;
  definition: PresentationDefinition;
  holderDID: string;
  holderSecretKey: Uint8Array;
  challenge?: string;
  domain?: string;
}): Promise<ZKProof> {
  const { credential, definition, holderDID, holderSecretKey, challenge, domain } = options;

  const evaluation = evaluateCredential(credential, definition);
  if (!evaluation.satisfies) {
    throw new Error(`Cannot generate presentation: ${evaluation.error}`);
  }

  // Generate ZK proof automatically revealing only the requested fields
  const result = await createZKProof({
    credential,
    holderDID,
    holderSecretKey,
    revealFields: evaluation.revealFields,
    challenge,
    domain
  });

  return result.proof;
}
