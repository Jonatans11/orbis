import { describe, it, expect, beforeAll } from "vitest";
import { initDatabase } from "../src/db/metadata.js";
import * as didRegistry from "../src/did/index.js";
import { issueCredential } from "../src/vc/issue.js";
import { evaluateCredential, generatePresentationFromQuery, type PresentationDefinition } from "../src/vc/presentation-exchange.js";
import { verifyZKProof } from "../src/vc/zk.js";

beforeAll(() => {
  initDatabase();
});

describe("DIF Presentation Exchange Query Engine", () => {
  it("should evaluate and verify standard constraints on Verifiable Credentials", async () => {
    const issuer = await didRegistry.createDIDKey();
    const holder = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: holder.did,
      claims: {
        name: "Alice",
        age: 25,
        country: "EE"
      }
    });

    const definition: PresentationDefinition = {
      id: "age-check-query",
      input_descriptors: [
        {
          id: "age_descriptor",
          constraints: {
            fields: [
              {
                path: ["$.credentialSubject.age"],
                filter: {
                  type: "integer",
                  minimum: 18
                }
              },
              {
                path: ["$.credentialSubject.country"],
                filter: {
                  type: "string",
                  const: "EE"
                }
              }
            ]
          }
        }
      ]
    };

    // 1. Evaluate credential matching
    const evalResult = evaluateCredential(credential, definition);
    expect(evalResult.satisfies).toBe(true);
    expect(evalResult.revealFields).toContain("age");
    expect(evalResult.revealFields).toContain("country");

    // 2. Generate automatic ZK Selective Disclosure Presentation
    const presentation = await generatePresentationFromQuery({
      credential,
      definition,
      holderDID: holder.did,
      holderSecretKey: holder.keyPair.secretKey
    });

    expect(presentation).toBeTruthy();
    expect(presentation.revealedFields).toContain("age");
    expect(presentation.revealedFields).toContain("country");
    expect(presentation.hiddenFields).toContain("name"); // "name" was hidden automatically because it was not requested!

    // 3. Verify the generated presentation
    const verifyResult = await verifyZKProof(presentation);
    expect(verifyResult.verified).toBe(true);
  });
});